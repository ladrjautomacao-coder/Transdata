-- Gerenciamento: logo do cliente que vai no corpo do e-mail ao Data Center. O arquivo fica
-- público porque o Outlook busca a imagem ao colar o e-mail. Só PNG, até 2 MB.
-- Caminho: logos/<projeto>/<arquivo>.png (um arquivo novo a cada envio: e-mail já enviado não muda).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gerenciamento', 'gerenciamento', true, 2097152, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- logos/<projeto>/<arquivo>: o projeto precisa ser do tenant de quem envia
CREATE OR REPLACE FUNCTION public.can_upload_project_logo(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (storage.foldername(_name))[1] = 'logos'
     AND EXISTS (SELECT 1 FROM public.projects p
                 WHERE p.id::text = (storage.foldername(_name))[2] AND public.tenant_guard(p.tenant_id))
$$;
REVOKE ALL ON FUNCTION public.can_upload_project_logo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_upload_project_logo(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "gerenciamento: ver arquivos" ON storage.objects;
DROP POLICY IF EXISTS "gerenciamento: enviar logo" ON storage.objects;
DROP POLICY IF EXISTS "gerenciamento: substituir logo" ON storage.objects;
CREATE POLICY "gerenciamento: ver arquivos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'gerenciamento');
CREATE POLICY "gerenciamento: enviar logo" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gerenciamento' AND public.can_upload_project_logo(name));
CREATE POLICY "gerenciamento: substituir logo" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gerenciamento' AND public.can_upload_project_logo(name))
  WITH CHECK (bucket_id = 'gerenciamento' AND public.can_upload_project_logo(name));
