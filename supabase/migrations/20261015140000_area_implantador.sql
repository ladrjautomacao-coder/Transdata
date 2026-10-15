-- Área do Implantador: o técnico (identificado pelo e-mail cadastrado em
-- Técnicos da agenda) vê a própria agenda; o Aprovador registra como cada
-- visita foi realizada (presencial/remota) e pode cancelar visitas aprovadas.
--
-- Permissão nova no painel: area_implantador.view (abre a tela).

-- ─── Resultado da visita e cancelamento após aprovação ─────────────────────
ALTER TABLE public.implantation_requests
  ADD COLUMN attendance text CHECK (attendance IN ('presencial', 'remoto')),
  ADD COLUMN attendance_note text,
  ADD COLUMN attended_by uuid,
  ADD COLUMN attended_by_name text,
  ADD COLUMN attended_at timestamptz,
  ADD COLUMN cancel_reason text;

-- remove a restrição atual da coluna action (qualquer que seja o nome gerado)
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.implantation_request_history'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%action%' LOOP
    EXECUTE format('ALTER TABLE public.implantation_request_history DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.implantation_request_history ADD CONSTRAINT implantation_request_history_action_check
  CHECK (action IN ('criada', 'aprovada', 'reprovada', 'cancelada', 'periodo_alterado', 'atendida'));

-- ─── Quem é o técnico logado ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_technician_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_tenant uuid;
  v_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  v_email := lower(public.current_user_email());
  IF v_email IS NULL OR v_email = '' THEN RETURN NULL; END IF;
  v_tenant := public.get_my_tenant_id();
  IF v_tenant IS NULL THEN RETURN NULL; END IF;
  SELECT array_agg(t.id) INTO v_ids
  FROM public.implantation_technicians t
  WHERE lower(t.email) = v_email AND t.active AND t.tenant_id = v_tenant;
  -- e-mail ambíguo (dois técnicos com o mesmo e-mail) não vincula ninguém
  IF coalesce(array_length(v_ids, 1), 0) <> 1 THEN RETURN NULL; END IF;
  RETURN v_ids[1];
END $$;
REVOKE ALL ON FUNCTION public.get_my_technician_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_technician_id() TO authenticated, service_role;

-- O técnico também lê os feriados da agenda
CREATE OR REPLACE FUNCTION public.agenda_can_view()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(auth.uid(), 'agenda_solicitacao', 'view')
      OR public.has_permission(auth.uid(), 'agenda_calendario', 'view')
      OR public.has_permission(auth.uid(), 'area_implantador', 'view')
$$;

-- ─── Aprovador registra o atendimento ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_implantation_attendance(_request_id uuid, _mode text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.implantation_requests;
  v_name text := (SELECT full_name FROM public.profiles WHERE user_id = auth.uid());
BEGIN
  IF NOT public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve') THEN
    RAISE EXCEPTION 'Sem permissão para registrar o atendimento.' USING ERRCODE = '42501';
  END IF;
  IF _mode NOT IN ('presencial', 'remoto') THEN RAISE EXCEPTION 'Informe se o atendimento foi presencial ou remoto.'; END IF;
  SELECT * INTO v_req FROM public.implantation_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND OR NOT public.tenant_guard(v_req.tenant_id) THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_req.status <> 'aprovada' THEN RAISE EXCEPTION 'Só é possível registrar atendimento de visitas aprovadas.'; END IF;
  IF v_req.approved_start > now() THEN RAISE EXCEPTION 'A visita ainda não começou.'; END IF;

  UPDATE public.implantation_requests
     SET attendance = _mode, attendance_note = nullif(trim(coalesce(_note, '')), ''),
         attended_by = auth.uid(), attended_by_name = v_name, attended_at = now()
   WHERE id = _request_id;
  INSERT INTO public.implantation_request_history(request_id, action, actor_id, actor_name, details)
  VALUES (_request_id, 'atendida', auth.uid(), v_name,
          jsonb_build_object('mode', _mode, 'note', nullif(trim(coalesce(_note, '')), '')));
END $$;

-- ─── Aprovador cancela uma visita já aprovada ──────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_approved_implantation_request(_request_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.implantation_requests;
  v_name text := (SELECT full_name FROM public.profiles WHERE user_id = auth.uid());
BEGIN
  IF NOT public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar a visita.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(_reason, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento.'; END IF;
  SELECT * INTO v_req FROM public.implantation_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND OR NOT public.tenant_guard(v_req.tenant_id) THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_req.status <> 'aprovada' THEN RAISE EXCEPTION 'Só é possível cancelar por aqui visitas aprovadas.'; END IF;
  IF v_req.attendance IS NOT NULL THEN RAISE EXCEPTION 'Esta visita já tem atendimento registrado.'; END IF;

  UPDATE public.implantation_requests
     SET status = 'cancelada', cancel_reason = trim(_reason), reviewed_at = now()
   WHERE id = _request_id;
  INSERT INTO public.implantation_request_history(request_id, action, actor_id, actor_name, details)
  VALUES (_request_id, 'cancelada', auth.uid(), v_name, jsonb_build_object('reason', trim(_reason), 'after_approval', true));
END $$;

-- ─── Agenda do técnico (própria, ou de outro para aprovador/admin) ─────────
CREATE OR REPLACE FUNCTION public.get_implantation_agenda(_technician_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tech uuid;
  v_tech_row public.implantation_technicians;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '42501'; END IF;

  IF _technician_id IS NULL OR _technician_id = public.get_my_technician_id() THEN
    IF NOT public.has_permission(auth.uid(), 'area_implantador', 'view') THEN
      RAISE EXCEPTION 'Sem permissão para a Área do Implantador.' USING ERRCODE = '42501';
    END IF;
    v_tech := public.get_my_technician_id();
  ELSE
    IF NOT (public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve')
            OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
      RAISE EXCEPTION 'Sem permissão para ver a agenda de outro técnico.' USING ERRCODE = '42501';
    END IF;
    v_tech := _technician_id;
  END IF;

  IF v_tech IS NULL THEN RETURN jsonb_build_object('technician', NULL, 'visits', '[]'::jsonb); END IF;

  SELECT * INTO v_tech_row FROM public.implantation_technicians WHERE id = v_tech;
  IF NOT FOUND OR NOT public.tenant_guard(v_tech_row.tenant_id) THEN
    RAISE EXCEPTION 'Técnico não encontrado.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'technician', jsonb_build_object('id', v_tech_row.id, 'full_name', v_tech_row.full_name, 'area', v_tech_row.area, 'email', v_tech_row.email),
    'visits', coalesce((
      SELECT jsonb_agg(v ORDER BY v->>'start')
      FROM (
        SELECT jsonb_build_object(
          'id', r.id,
          'status', r.status,
          'start', coalesce(r.approved_start, r.requested_start),
          'end', coalesce(r.approved_end, r.requested_end),
          'visit_purpose', r.visit_purpose,
          'location', r.location,
          'notes', r.notes,
          'requester_name', r.requester_name,
          'reviewer_name', r.reviewer_name,
          'attendance', r.attendance,
          'attendance_note', r.attendance_note,
          'attended_by_name', r.attended_by_name,
          'attended_at', r.attended_at,
          'cancel_reason', r.cancel_reason,
          'project', jsonb_build_object(
            'id', p.id, 'company_name', p.company_name, 'project_code', p.project_code,
            'city', p.city, 'state', p.state, 'country_code', p.country_code, 'status', p.status,
            'manager_name', mg.full_name),
          'colleagues', coalesce((
            SELECT jsonb_agg(jsonb_build_object('id', t2.id, 'full_name', t2.full_name) ORDER BY t2.full_name)
            FROM public.implantation_request_members m2
            JOIN public.implantation_technicians t2 ON t2.id = m2.technician_id
            WHERE m2.request_id = r.id AND t2.id <> v_tech), '[]'::jsonb)
        ) AS v
        FROM public.implantation_requests r
        JOIN public.implantation_request_members m ON m.request_id = r.id AND m.technician_id = v_tech
        JOIN public.projects p ON p.id = r.project_id
        LEFT JOIN public.team_members mg ON mg.id = p.manager_id
        WHERE r.status IN ('aprovada', 'cancelada') AND r.tenant_id = v_tech_row.tenant_id
      ) q
    ), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.register_implantation_attendance(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_approved_implantation_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_implantation_agenda(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_implantation_attendance(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_approved_implantation_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_implantation_agenda(uuid) TO authenticated;
