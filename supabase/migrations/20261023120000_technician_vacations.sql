-- Agenda de Implantação: férias dos técnicos.
-- No período de férias o técnico fica indisponível: a aprovação recusa escalá-lo
-- (aqui no banco) e o portal o mostra como "De férias" na aprovação, na
-- solicitação e no calendário.
-- Leitura: quem vê qualquer tela da agenda. Cadastro: quem gerencia os técnicos.

CREATE TABLE public.implantation_technician_vacations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.implantation_technicians(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text CHECK (note IS NULL OR length(note) <= 200),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT implantation_technician_vacations_period_chk CHECK (end_date >= start_date),
  -- evita erro de digitação no ano (ex.: 2062 em vez de 2026)
  CONSTRAINT implantation_technician_vacations_length_chk CHECK (end_date - start_date <= 366)
);
CREATE INDEX idx_implantation_technician_vacations_tech
  ON public.implantation_technician_vacations(technician_id, start_date);

-- Empresa vem do técnico; períodos do mesmo técnico não podem se sobrepor.
CREATE OR REPLACE FUNCTION public.implantation_technician_vacations_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_other record;
BEGIN
  NEW.tenant_id := (SELECT tenant_id FROM public.implantation_technicians WHERE id = NEW.technician_id);
  IF NEW.tenant_id IS NULL THEN RAISE EXCEPTION 'Técnico não encontrado.'; END IF;
  NEW.note := nullif(trim(coalesce(NEW.note, '')), '');
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'O fim das férias deve ser no mesmo dia do início ou depois.';
  END IF;
  SELECT start_date, end_date INTO v_other
  FROM public.implantation_technician_vacations
  WHERE technician_id = NEW.technician_id AND id <> NEW.id
    AND daterange(start_date, end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ORDER BY start_date
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Já há férias cadastradas de % a % que se sobrepõem a este período.',
      to_char(v_other.start_date, 'DD/MM/YYYY'), to_char(v_other.end_date, 'DD/MM/YYYY');
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_implantation_technician_vacations_before_write
  BEFORE INSERT OR UPDATE ON public.implantation_technician_vacations
  FOR EACH ROW EXECUTE FUNCTION public.implantation_technician_vacations_before_write();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.implantation_technician_vacations TO authenticated;
GRANT ALL ON public.implantation_technician_vacations TO service_role;
ALTER TABLE public.implantation_technician_vacations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda: ver ferias" ON public.implantation_technician_vacations FOR SELECT TO authenticated
  USING (public.agenda_can_view());
CREATE POLICY "agenda: cadastrar ferias" ON public.implantation_technician_vacations FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'));
CREATE POLICY "agenda: editar ferias" ON public.implantation_technician_vacations FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'));
CREATE POLICY "agenda: excluir ferias" ON public.implantation_technician_vacations FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'));
CREATE POLICY "tenant guard" ON public.implantation_technician_vacations AS RESTRICTIVE FOR ALL
  USING (public.tenant_guard(tenant_id));

-- ─── Aprovação: recusa técnico de férias em qualquer dia da visita ─────────
-- Mesmo corpo de 20261020150000_meeting_link_by_approver.sql, com a checagem de férias.
CREATE OR REPLACE FUNCTION public.approve_implantation_request(
  _request_id uuid, _start timestamptz, _end timestamptz, _technician_ids uuid[], _meeting_url text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.implantation_requests;
  v_conflict record;
  v_vacation record;
  v_url text := nullif(trim(coalesce(_meeting_url, '')), '');
  v_name text := (SELECT full_name FROM public.profiles WHERE user_id = auth.uid());
BEGIN
  IF NOT public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar.' USING ERRCODE = '42501';
  END IF;
  IF _end <= _start THEN RAISE EXCEPTION 'O fim deve ser depois do início.'; END IF;
  IF coalesce(array_length(_technician_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos 1 técnico.';
  END IF;

  -- serializa aprovações para a checagem de conflito ser confiável
  PERFORM pg_advisory_xact_lock(hashtext('implantation_conflict'));

  SELECT * INTO v_req FROM public.implantation_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND OR NOT public.tenant_guard(v_req.tenant_id) THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_req.status <> 'pendente' THEN RAISE EXCEPTION 'Esta solicitação não está mais pendente (status: %).', v_req.status; END IF;

  -- remoto: link informado agora (ou o que já veio na solicitação); presencial não tem link
  IF v_req.visit_format = 'remoto' THEN
    v_url := coalesce(v_url, v_req.meeting_url);
    IF v_url IS NULL THEN RAISE EXCEPTION 'Informe o link da reunião para aprovar a visita remota.'; END IF;
    IF v_url !~* '^https?://\S+$' OR length(v_url) > 2000 THEN
      RAISE EXCEPTION 'Link da reunião inválido. Use o endereço completo (ex.: https://meet.google.com/...).';
    END IF;
  ELSE
    v_url := v_req.meeting_url;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(_technician_ids) AS x(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.implantation_technicians t WHERE t.id = x.id AND t.tenant_id = v_req.tenant_id)
  ) THEN
    RAISE EXCEPTION 'Técnico inválido para este cliente.';
  END IF;

  -- férias: dias da visita no horário de Brasília (fim à meia-noite não ocupa o dia seguinte)
  SELECT t.full_name, v.start_date, v.end_date INTO v_vacation
  FROM public.implantation_technician_vacations v
  JOIN public.implantation_technicians t ON t.id = v.technician_id
  WHERE v.technician_id = ANY(_technician_ids)
    AND daterange(v.start_date, v.end_date, '[]') && daterange(
      (_start AT TIME ZONE 'America/Sao_Paulo')::date,
      ((_end - interval '1 microsecond') AT TIME ZONE 'America/Sao_Paulo')::date, '[]')
  ORDER BY v.start_date
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION '% está de férias de % a %. Escolha outro técnico ou ajuste o período.',
      v_vacation.full_name, to_char(v_vacation.start_date, 'DD/MM'), to_char(v_vacation.end_date, 'DD/MM');
  END IF;

  SELECT t.full_name, p.company_name, r.approved_start, r.approved_end INTO v_conflict
  FROM public.implantation_request_members m
  JOIN public.implantation_requests r ON r.id = m.request_id
  JOIN public.implantation_technicians t ON t.id = m.technician_id
  JOIN public.projects p ON p.id = r.project_id
  WHERE m.technician_id = ANY(_technician_ids)
    AND r.tenant_id = v_req.tenant_id
    AND r.status = 'aprovada' AND r.id <> _request_id
    AND tstzrange(r.approved_start, r.approved_end) && tstzrange(_start, _end)
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Conflito de agenda: % já está alocado(a) em % de % a %.',
      v_conflict.full_name, v_conflict.company_name,
      to_char(v_conflict.approved_start AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      to_char(v_conflict.approved_end AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI');
  END IF;

  DELETE FROM public.implantation_request_members WHERE request_id = _request_id;
  INSERT INTO public.implantation_request_members(request_id, technician_id)
    SELECT _request_id, unnest(_technician_ids);

  UPDATE public.implantation_requests
     SET status = 'aprovada', approved_start = _start, approved_end = _end, meeting_url = v_url,
         reviewed_by = auth.uid(), reviewer_name = v_name, reviewed_at = now()
   WHERE id = _request_id;

  IF _start <> v_req.requested_start OR _end <> v_req.requested_end THEN
    INSERT INTO public.implantation_request_history(request_id, action, actor_id, actor_name, details)
    VALUES (_request_id, 'periodo_alterado', auth.uid(), v_name,
      jsonb_build_object('from_start', v_req.requested_start, 'from_end', v_req.requested_end, 'start', _start, 'end', _end));
  END IF;
  INSERT INTO public.implantation_request_history(request_id, action, actor_id, actor_name, details)
  VALUES (_request_id, 'aprovada', auth.uid(), v_name,
    jsonb_build_object('start', _start, 'end', _end,
      'technicians', (SELECT jsonb_agg(full_name ORDER BY full_name) FROM public.implantation_technicians WHERE id = ANY(_technician_ids)))
    || CASE WHEN v_req.visit_format = 'remoto' THEN jsonb_build_object('meeting_url', v_url) ELSE '{}'::jsonb END);
END $$;

REVOKE ALL ON FUNCTION public.approve_implantation_request(uuid, timestamptz, timestamptz, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_implantation_request(uuid, timestamptz, timestamptz, uuid[], text) TO authenticated;
