-- Agenda de Implantação: treinamento remoto ocupa só o turno de cada dia.
-- Um remoto de manhã (09h–12h) de 03 a 04/11 ocupa 03/11 09h–12h e 04/11 09h–12h,
-- e não mais o período corrido de 03/11 09h a 04/11 12h. Assim o mesmo técnico pode
-- receber um remoto à tarde (14h–17h) nos mesmos dias. Integral (09h–17h) ocupa os dois.
-- Presencial continua ocupando o período inteiro, do início ao fim.

-- Horários ocupados por uma visita (horário de Brasília para montar a janela de cada dia)
CREATE OR REPLACE FUNCTION public.implantation_visit_slots(_start timestamptz, _end timestamptz, _format text)
RETURNS TABLE (slot tstzrange) LANGUAGE sql STABLE SET search_path = public AS $$
  WITH l AS (
    SELECT (_start AT TIME ZONE 'America/Sao_Paulo') AS s, (_end AT TIME ZONE 'America/Sao_Paulo') AS e
  )
  SELECT tstzrange((d::date + l.s::time) AT TIME ZONE 'America/Sao_Paulo', (d::date + l.e::time) AT TIME ZONE 'America/Sao_Paulo')
  FROM l, generate_series(l.s::date, l.e::date, interval '1 day') AS d
  WHERE _format = 'remoto' AND _end > _start AND l.e::time > l.s::time
  UNION ALL
  SELECT tstzrange(_start, _end)
  FROM l
  WHERE NOT (_format IS NOT DISTINCT FROM 'remoto' AND _end > _start AND l.e::time > l.s::time)
$$;
REVOKE ALL ON FUNCTION public.implantation_visit_slots(timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.implantation_visit_slots(timestamptz, timestamptz, text) TO authenticated, service_role;

-- ─── Aprovação: conflito pelos horários ocupados ───────────────────────────
-- Mesmo corpo de 20261023120000_technician_vacations.sql, com a checagem de conflito por turno.
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
    -- remotos em turnos diferentes (manhã e tarde) dividem os mesmos dias sem conflito
    AND EXISTS (
      SELECT 1
      FROM public.implantation_visit_slots(r.approved_start, r.approved_end, r.visit_format) AS a,
           public.implantation_visit_slots(_start, _end, v_req.visit_format) AS b
      WHERE a.slot && b.slot)
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
