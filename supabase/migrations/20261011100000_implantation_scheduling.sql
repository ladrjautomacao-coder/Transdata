-- Agenda de Implantação: "Solicitação de agenda" (GP solicita visita técnica,
-- Aprovador aprova/reprova) + "Calendário" (só agendamentos aprovados).
--
-- FASE DE DESENVOLVIMENTO: tudo restrito a super_admin via RLS. Para liberar
-- aos perfis reais depois, basta trocar as policies "super admins only" por
-- regras de GP/Aprovador — as funções abaixo já fazem as validações de fluxo.
--
-- Técnicos ficam numa tabela própria do módulo (não em team_members) para que
-- nada apareça nas telas existentes (ex.: Administração > Equipe) nesta fase.

-- ─── Técnicos ──────────────────────────────────────────────────────────────
CREATE TABLE public.implantation_technicians (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (length(trim(full_name)) > 0),
  email text,
  area text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_set_tenant_id BEFORE INSERT ON public.implantation_technicians
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_session();

-- ─── Solicitações ──────────────────────────────────────────────────────────
CREATE TABLE public.implantation_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requested_by uuid,
  requester_name text,
  visit_purpose text NOT NULL CHECK (length(trim(visit_purpose)) > 0),
  visit_purpose_is_custom boolean NOT NULL DEFAULT false,
  requested_start timestamptz NOT NULL,
  requested_end timestamptz NOT NULL,
  location text,
  notes text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','reprovada','cancelada')),
  approved_start timestamptz,
  approved_end timestamptz,
  reviewed_by uuid,
  reviewer_name text,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT implantation_requests_requested_dates_chk CHECK (requested_end > requested_start),
  CONSTRAINT implantation_requests_approved_dates_chk CHECK (
    status <> 'aprovada' OR (approved_start IS NOT NULL AND approved_end IS NOT NULL AND approved_end > approved_start)),
  CONSTRAINT implantation_requests_rejection_reason_chk CHECK (
    status <> 'reprovada' OR length(trim(coalesce(rejection_reason, ''))) >= 5)
);
CREATE INDEX idx_implantation_requests_status ON public.implantation_requests(tenant_id, status, requested_start);
CREATE INDEX idx_implantation_requests_project ON public.implantation_requests(project_id);
CREATE TRIGGER trg_implantation_requests_updated_at BEFORE UPDATE ON public.implantation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- tenant e solicitante vêm do servidor, nunca do cliente
CREATE OR REPLACE FUNCTION public.implantation_requests_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT tenant_id INTO NEW.tenant_id FROM public.projects WHERE id = NEW.project_id;
  IF auth.uid() IS NOT NULL THEN
    NEW.requested_by := auth.uid();
    NEW.requester_name := coalesce((SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), NEW.requester_name);
  END IF;
  NEW.status := 'pendente';
  NEW.approved_start := NULL; NEW.approved_end := NULL;
  NEW.reviewed_by := NULL; NEW.reviewer_name := NULL; NEW.reviewed_at := NULL; NEW.rejection_reason := NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_implantation_requests_before_insert BEFORE INSERT ON public.implantation_requests
  FOR EACH ROW EXECUTE FUNCTION public.implantation_requests_before_insert();

-- ─── Técnicos alocados (definidos na aprovação) ────────────────────────────
CREATE TABLE public.implantation_request_members (
  request_id uuid NOT NULL REFERENCES public.implantation_requests(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.implantation_technicians(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, technician_id)
);
CREATE INDEX idx_implantation_request_members_tech ON public.implantation_request_members(technician_id);

-- ─── Histórico ─────────────────────────────────────────────────────────────
CREATE TABLE public.implantation_request_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.implantation_requests(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('criada','aprovada','reprovada','cancelada','periodo_alterado')),
  actor_id uuid,
  actor_name text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_implantation_request_history_req ON public.implantation_request_history(request_id, created_at);

CREATE OR REPLACE FUNCTION public.implantation_requests_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.implantation_request_history(request_id, action, actor_id, actor_name, details)
  VALUES (NEW.id, 'criada', NEW.requested_by, NEW.requester_name,
          jsonb_build_object('start', NEW.requested_start, 'end', NEW.requested_end, 'purpose', NEW.visit_purpose));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_implantation_requests_after_insert AFTER INSERT ON public.implantation_requests
  FOR EACH ROW EXECUTE FUNCTION public.implantation_requests_after_insert();

-- ─── Grants + RLS ──────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.implantation_technicians, public.implantation_requests,
  public.implantation_request_members, public.implantation_request_history TO authenticated;
GRANT ALL ON public.implantation_technicians, public.implantation_requests,
  public.implantation_request_members, public.implantation_request_history TO service_role;

ALTER TABLE public.implantation_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implantation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implantation_request_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implantation_request_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins only" ON public.implantation_technicians FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admins only" ON public.implantation_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admins only" ON public.implantation_request_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "super admins only" ON public.implantation_request_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "tenant guard" ON public.implantation_technicians AS RESTRICTIVE FOR ALL
  USING (public.tenant_guard(tenant_id));
CREATE POLICY "tenant guard" ON public.implantation_requests AS RESTRICTIVE FOR ALL
  USING (public.tenant_guard(tenant_id));
CREATE POLICY "tenant guard" ON public.implantation_request_members AS RESTRICTIVE FOR ALL
  USING (EXISTS (SELECT 1 FROM public.implantation_requests r WHERE r.id = request_id AND public.tenant_guard(r.tenant_id)));
CREATE POLICY "tenant guard" ON public.implantation_request_history AS RESTRICTIVE FOR ALL
  USING (EXISTS (SELECT 1 FROM public.implantation_requests r WHERE r.id = request_id AND public.tenant_guard(r.tenant_id)));

-- ─── Ações do fluxo (atômicas) ─────────────────────────────────────────────
-- SECURITY INVOKER: rodam com as permissões (RLS) de quem chama.

CREATE OR REPLACE FUNCTION public.approve_implantation_request(
  _request_id uuid, _start timestamptz, _end timestamptz, _technician_ids uuid[])
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_req public.implantation_requests;
  v_conflict record;
  v_name text := (SELECT full_name FROM public.profiles WHERE user_id = auth.uid());
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar.' USING ERRCODE = '42501';
  END IF;
  IF _end <= _start THEN RAISE EXCEPTION 'O fim deve ser depois do início.'; END IF;
  IF coalesce(array_length(_technician_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos 1 técnico.';
  END IF;

  -- serializa aprovações para a checagem de conflito ser confiável
  PERFORM pg_advisory_xact_lock(hashtext('implantation_conflict'));

  SELECT * INTO v_req FROM public.implantation_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_req.status <> 'pendente' THEN RAISE EXCEPTION 'Esta solicitação não está mais pendente (status: %).', v_req.status; END IF;

  SELECT t.full_name, p.company_name, r.approved_start, r.approved_end INTO v_conflict
  FROM public.implantation_request_members m
  JOIN public.implantation_requests r ON r.id = m.request_id
  JOIN public.implantation_technicians t ON t.id = m.technician_id
  JOIN public.projects p ON p.id = r.project_id
  WHERE m.technician_id = ANY(_technician_ids)
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
     SET status = 'aprovada', approved_start = _start, approved_end = _end,
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
      'technicians', (SELECT jsonb_agg(full_name ORDER BY full_name) FROM public.implantation_technicians WHERE id = ANY(_technician_ids))));
END $$;

CREATE OR REPLACE FUNCTION public.reject_implantation_request(_request_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_status text;
  v_name text := (SELECT full_name FROM public.profiles WHERE user_id = auth.uid());
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Sem permissão para reprovar.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(_reason, ''))) < 5 THEN RAISE EXCEPTION 'A justificativa é obrigatória.'; END IF;
  SELECT status INTO v_status FROM public.implantation_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_status <> 'pendente' THEN RAISE EXCEPTION 'Esta solicitação não está mais pendente (status: %).', v_status; END IF;

  UPDATE public.implantation_requests
     SET status = 'reprovada', rejection_reason = trim(_reason),
         reviewed_by = auth.uid(), reviewer_name = v_name, reviewed_at = now()
   WHERE id = _request_id;
  INSERT INTO public.implantation_request_history(request_id, action, actor_id, actor_name, details)
  VALUES (_request_id, 'reprovada', auth.uid(), v_name, jsonb_build_object('reason', trim(_reason)));
END $$;

CREATE OR REPLACE FUNCTION public.cancel_implantation_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_status text;
  v_name text := (SELECT full_name FROM public.profiles WHERE user_id = auth.uid());
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar.' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO v_status FROM public.implantation_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_status <> 'pendente' THEN RAISE EXCEPTION 'Só é possível cancelar solicitações pendentes.'; END IF;

  UPDATE public.implantation_requests SET status = 'cancelada', reviewed_at = now() WHERE id = _request_id;
  INSERT INTO public.implantation_request_history(request_id, action, actor_id, actor_name)
  VALUES (_request_id, 'cancelada', auth.uid(), v_name);
END $$;

REVOKE ALL ON FUNCTION public.approve_implantation_request(uuid, timestamptz, timestamptz, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_implantation_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_implantation_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_implantation_request(uuid, timestamptz, timestamptz, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_implantation_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_implantation_request(uuid) TO authenticated;
