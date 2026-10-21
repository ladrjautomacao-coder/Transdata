-- Área do Implantador: ficha do projeto para o técnico em campo (situação, prazos,
-- frota, escopo, equipe, acompanhamento do GP e visitas do projeto).
--
-- O técnico só abre a ficha dos projetos em que está ou esteve escalado; Aprovador
-- e admin abrem a de qualquer projeto (ao ver a área de outro técnico).

CREATE OR REPLACE FUNCTION public.get_implantation_project_brief(_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.projects;
  v_tech uuid := public.get_my_technician_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_p FROM public.projects WHERE id = _project_id;
  IF NOT FOUND OR NOT public.tenant_guard(v_p.tenant_id) THEN
    RAISE EXCEPTION 'Projeto não encontrado.' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    (v_tech IS NOT NULL
      AND public.has_permission(auth.uid(), 'area_implantador', 'view')
      AND EXISTS (
        SELECT 1 FROM public.implantation_requests r
        JOIN public.implantation_request_members m ON m.request_id = r.id AND m.technician_id = v_tech
        WHERE r.project_id = _project_id AND r.status IN ('aprovada', 'cancelada')))
    OR public.has_permission(auth.uid(), 'agenda_solicitacao', 'approve')
    OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ver este projeto.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_p.id, 'company_name', v_p.company_name, 'project_code', v_p.project_code,
      'city', v_p.city, 'state', v_p.state::text, 'country_code', v_p.country_code,
      'status', v_p.status::text, 'sub_phase', v_p.sub_phase, 'project_segment', v_p.project_segment,
      'project_type', (SELECT pt.name FROM public.project_types pt WHERE pt.id = v_p.project_type_id),
      'is_pilot', v_p.is_pilot, 'pilot_info', v_p.pilot_info,
      'contract_date', v_p.contract_date, 'd_zero_date', v_p.d_zero_date,
      'executive_project_date', v_p.executive_project_date, 'handover_date', v_p.handover_date,
      'implementation_deadline_days', v_p.implementation_deadline_days,
      'implementation_due', CASE WHEN coalesce(v_p.implementation_deadline_days, 0) > 0
                                 THEN v_p.contract_date + v_p.implementation_deadline_days END,
      'fleet_size', v_p.fleet_size, 'fleet_urbano', v_p.fleet_urbano, 'fleet_seccionado', v_p.fleet_seccionado,
      'complementary_sale', v_p.complementary_sale, 'complementary_fleet', v_p.complementary_fleet,
      'implemented_fleet', v_p.implemented_fleet,
      'installation_transmobile', v_p.installation_transmobile, 'installation_client', v_p.installation_client,
      'embedded_install_training', v_p.embedded_install_training,
      'observations', v_p.observations, 'updated_at', v_p.updated_at
    ),
    'manager', (SELECT jsonb_build_object('full_name', tm.full_name, 'email', tm.email) FROM public.team_members tm WHERE tm.id = v_p.manager_id),
    'executive', (SELECT jsonb_build_object('full_name', tm.full_name, 'email', tm.email) FROM public.team_members tm WHERE tm.id = v_p.executive_id),
    'products', coalesce((
      SELECT jsonb_agg(pr.name ORDER BY pr.name)
      FROM public.project_products pp JOIN public.products pr ON pr.id = pp.product_id
      WHERE pp.project_id = _project_id), '[]'::jsonb),
    'solutions', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', s.name, 'features', coalesce((
        SELECT jsonb_agg(sf.name ORDER BY sf.sort_order, sf.name)
        FROM public.project_solution_features psf JOIN public.solution_features sf ON sf.id = psf.solution_feature_id
        WHERE psf.project_id = _project_id AND sf.solution_id = s.id), '[]'::jsonb)) ORDER BY s.name)
      FROM public.project_solutions ps JOIN public.solutions s ON s.id = ps.solution_id
      WHERE ps.project_id = _project_id), '[]'::jsonb),
    'integrations', coalesce((
      SELECT jsonb_agg(i.name ORDER BY i.name)
      FROM public.project_integrations pi JOIN public.integrations i ON i.id = pi.integration_id
      WHERE pi.project_id = _project_id), '[]'::jsonb),
    'equipments', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', e.name, 'quantity', pe.quantity) ORDER BY e.sort_order, e.name)
      FROM public.project_equipments pe JOIN public.equipment_types e ON e.id = pe.equipment_type_id
      WHERE pe.project_id = _project_id AND pe.quantity > 0), '[]'::jsonb),
    'notes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', q.id, 'content', q.content, 'created_at', q.created_at, 'author', q.author) ORDER BY q.created_at DESC)
      FROM (
        SELECT pn.id, pn.content, pn.created_at, pf.full_name AS author
        FROM public.project_notes pn LEFT JOIN public.profiles pf ON pf.user_id = pn.created_by
        WHERE pn.project_id = _project_id
        ORDER BY pn.created_at DESC LIMIT 10
      ) q), '[]'::jsonb),
    'visits', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'status', r.status,
        'start', coalesce(r.approved_start, r.requested_start), 'end', coalesce(r.approved_end, r.requested_end),
        'visit_purpose', r.visit_purpose, 'visit_format', r.visit_format, 'attendance', r.attendance,
        'technicians', coalesce((
          SELECT jsonb_agg(t.full_name ORDER BY t.full_name)
          FROM public.implantation_request_members m JOIN public.implantation_technicians t ON t.id = m.technician_id
          WHERE m.request_id = r.id), '[]'::jsonb)
      ) ORDER BY coalesce(r.approved_start, r.requested_start))
      FROM public.implantation_requests r
      WHERE r.project_id = _project_id AND r.status IN ('pendente', 'aprovada')), '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.get_implantation_project_brief(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_implantation_project_brief(uuid) TO authenticated;
