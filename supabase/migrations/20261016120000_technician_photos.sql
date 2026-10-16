-- Foto dos técnicos de implantação.
--
-- Coluna photo_url (URL pública) + bucket público "technician-photos" com os
-- arquivos em <technician_id>/<arquivo>. Ler: quem vê a agenda. Enviar e
-- remover: quem gerencia técnicos (agenda_tecnicos.edit) do mesmo tenant.
-- A tela reduz a foto para 400×400 antes de enviar; o bucket aceita até 1 MB.

ALTER TABLE public.implantation_technicians ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.implantation_technicians DROP CONSTRAINT IF EXISTS implantation_technicians_photo_url_check;
ALTER TABLE public.implantation_technicians ADD CONSTRAINT implantation_technicians_photo_url_check
  CHECK (photo_url IS NULL OR photo_url LIKE '%/storage/v1/object/public/technician-photos/%');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('technician-photos', 'technician-photos', true, 1048576, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Caminho <technician_id>/... de um técnico do tenant de quem gerencia técnicos
CREATE OR REPLACE FUNCTION public.can_manage_technician_photo(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit')
     AND EXISTS (SELECT 1 FROM public.implantation_technicians t
                 WHERE t.id::text = (storage.foldername(_name))[1] AND public.tenant_guard(t.tenant_id))
$$;
REVOKE ALL ON FUNCTION public.can_manage_technician_photo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_technician_photo(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "agenda: ver fotos de tecnicos" ON storage.objects;
DROP POLICY IF EXISTS "agenda: enviar fotos de tecnicos" ON storage.objects;
DROP POLICY IF EXISTS "agenda: remover fotos de tecnicos" ON storage.objects;
CREATE POLICY "agenda: ver fotos de tecnicos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'technician-photos' AND public.agenda_can_view());
CREATE POLICY "agenda: enviar fotos de tecnicos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'technician-photos' AND public.can_manage_technician_photo(name));
CREATE POLICY "agenda: remover fotos de tecnicos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'technician-photos' AND public.can_manage_technician_photo(name));

-- ─── Área do Implantador: devolve a foto do técnico e dos colegas ──────────
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
    'technician', jsonb_build_object('id', v_tech_row.id, 'full_name', v_tech_row.full_name, 'area', v_tech_row.area,
                                     'email', v_tech_row.email, 'photo_url', v_tech_row.photo_url),
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
            SELECT jsonb_agg(jsonb_build_object('id', t2.id, 'full_name', t2.full_name, 'photo_url', t2.photo_url) ORDER BY t2.full_name)
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
REVOKE ALL ON FUNCTION public.get_implantation_agenda(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_implantation_agenda(uuid) TO authenticated;
