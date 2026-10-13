-- Agenda de Implantação sai da fase "só super_admin" e passa a obedecer o painel
-- de Permissões (role_presets / user_permission_overrides via has_permission):
--
--   agenda_solicitacao.view     ver a tela de Solicitação de agenda
--   agenda_solicitacao.create   solicitar visita (GP)
--   agenda_solicitacao.approve  aprovar / reprovar (Aprovador)
--   agenda_tecnicos.edit        cadastrar e editar técnicos
--   agenda_calendario.view      ver o Calendário de implantação
--
-- Admin e super_admin continuam com acesso total (regra do has_permission).
-- As ações do fluxo viram SECURITY DEFINER com checagem explícita de permissão
-- e de tenant — assim um GP não consegue "aprovar" por UPDATE direto na tabela.
--
-- Também cria o módulo "acervo" (Acervo Técnico) e o libera em todos os perfis,
-- para ninguém perder o acesso que já tinha.

-- ─── Policies ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "super admins only" ON public.implantation_technicians;
DROP POLICY IF EXISTS "super admins only" ON public.implantation_requests;
DROP POLICY IF EXISTS "super admins only" ON public.implantation_request_members;
DROP POLICY IF EXISTS "super admins only" ON public.implantation_request_history;

CREATE OR REPLACE FUNCTION public.agenda_can_view()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(auth.uid(), 'agenda_solicitacao', 'view')
      OR public.has_permission(auth.uid(), 'agenda_calendario', 'view')
$$;
REVOKE ALL ON FUNCTION public.agenda_can_view() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_can_view() TO authenticated, service_role;

-- Técnicos: quem vê a agenda lê; só quem gerencia técnicos escreve
CREATE POLICY "agenda: ver tecnicos" ON public.implantation_technicians FOR SELECT TO authenticated
  USING (public.agenda_can_view());
CREATE POLICY "agenda: inserir tecnicos" ON public.implantation_technicians FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'));
CREATE POLICY "agenda: editar tecnicos" ON public.implantation_technicians FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'));
CREATE POLICY "agenda: excluir tecnicos" ON public.implantation_technicians FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'));

-- Solicitações: ver = agenda; criar = solicitar; alterar/excluir direto = aprovador
CREATE POLICY "agenda: ver solicitacoes" ON public.implantation_requests FOR SELECT TO authenticated
  USING (public.agenda_can_view());
CREATE POLICY "agenda: solicitar" ON public.implantation_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'agenda_solicitacao', 'create'));
CREATE POLICY "agenda: aprovador altera" ON public.implantation_requests FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve'))
  WITH CHECK (public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve'));
CREATE POLICY "agenda: aprovador exclui" ON public.implantation_requests FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve'));

-- Técnicos alocados: leitura para quem vê a agenda; escrita só do aprovador
CREATE POLICY "agenda: ver alocacoes" ON public.implantation_request_members FOR SELECT TO authenticated
  USING (public.agenda_can_view());
CREATE POLICY "agenda: aprovador aloca" ON public.implantation_request_members FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve'))
  WITH CHECK (public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve'));

-- Histórico: só leitura (gravado por triggers e pelas funções abaixo)
CREATE POLICY "agenda: ver historico" ON public.implantation_request_history FOR SELECT TO authenticated
  USING (public.agenda_can_view());

-- ─── Ações do fluxo ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_implantation_request(
  _request_id uuid, _start timestamptz, _end timestamptz, _technician_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.implantation_requests;
  v_conflict record;
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
  IF EXISTS (
    SELECT 1 FROM unnest(_technician_ids) AS x(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.implantation_technicians t WHERE t.id = x.id AND t.tenant_id = v_req.tenant_id)
  ) THEN
    RAISE EXCEPTION 'Técnico inválido para este cliente.';
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
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.implantation_requests;
  v_name text := (SELECT full_name FROM public.profiles WHERE user_id = auth.uid());
BEGIN
  IF NOT public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve') THEN
    RAISE EXCEPTION 'Sem permissão para reprovar.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(_reason, ''))) < 5 THEN RAISE EXCEPTION 'A justificativa é obrigatória.'; END IF;
  SELECT * INTO v_req FROM public.implantation_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND OR NOT public.tenant_guard(v_req.tenant_id) THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_req.status <> 'pendente' THEN RAISE EXCEPTION 'Esta solicitação não está mais pendente (status: %).', v_req.status; END IF;

  UPDATE public.implantation_requests
     SET status = 'reprovada', rejection_reason = trim(_reason),
         reviewed_by = auth.uid(), reviewer_name = v_name, reviewed_at = now()
   WHERE id = _request_id;
  INSERT INTO public.implantation_request_history(request_id, action, actor_id, actor_name, details)
  VALUES (_request_id, 'reprovada', auth.uid(), v_name, jsonb_build_object('reason', trim(_reason)));
END $$;

-- Cancelar: o próprio solicitante ou um aprovador
CREATE OR REPLACE FUNCTION public.cancel_implantation_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req public.implantation_requests;
  v_name text := (SELECT full_name FROM public.profiles WHERE user_id = auth.uid());
BEGIN
  SELECT * INTO v_req FROM public.implantation_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND OR NOT public.tenant_guard(v_req.tenant_id) THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF NOT (v_req.requested_by = auth.uid() OR public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve')) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar.' USING ERRCODE = '42501';
  END IF;
  IF v_req.status <> 'pendente' THEN RAISE EXCEPTION 'Só é possível cancelar solicitações pendentes.'; END IF;

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

-- ─── Acervo Técnico: mantém o acesso que todos já tinham ───────────────────
UPDATE public.role_presets
   SET permissions = coalesce(permissions, '{}'::jsonb)
     || jsonb_build_object('modules', coalesce(permissions->'modules', '{}'::jsonb) || '{"acervo": {"view": true}}'::jsonb);

-- overrides substituem "modules" inteiro na mescla; quem tem override também recebe
UPDATE public.user_permission_overrides
   SET permissions = permissions
     || jsonb_build_object('modules', (permissions->'modules') || '{"acervo": {"view": true}}'::jsonb)
 WHERE permissions ? 'modules';
