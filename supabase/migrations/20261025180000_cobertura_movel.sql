-- Cobertura das operadoras (Claro e Vivo) para o e-mail de cobertura dos projetos com Carrier.
--
-- Fonte: Anatel (cobertura estimada a partir das estações licenciadas), carregada a cada trimestre
-- por scripts/cobertura/atualizar.mjs com a chave de serviço. O portal só lê.
-- Bucket público "cobertura":
--   setores/<código IBGE>.json   mapa dos setores censitários de cada município (gravado pela carga)
--   mapas/<projeto>/<período>.png imagem do mapa de calor que vai no e-mail (o Outlook precisa abrir)

CREATE TABLE IF NOT EXISTS public.cobertura_movel_municipio (
  cod_ibge integer NOT NULL,
  municipio text NOT NULL,
  municipio_norm text NOT NULL,
  uf text NOT NULL,
  operadora text NOT NULL CHECK (operadora IN ('CLARO', 'VIVO')),
  tecnologia text NOT NULL CHECK (tecnologia IN ('4G', '5G', 'Todas')),
  pct_area numeric(5,2) NOT NULL DEFAULT 0,
  pct_moradores numeric(5,2) NOT NULL DEFAULT 0,
  pct_domicilios numeric(5,2) NOT NULL DEFAULT 0,
  area_km2 numeric(12,2),
  moradores integer,
  periodo text NOT NULL CHECK (periodo ~ '^\d{4}-\d{2}$'),
  PRIMARY KEY (cod_ibge, operadora, tecnologia)
);
-- o portal acha a cidade do cadastro pela UF + nome sem acento
CREATE INDEX IF NOT EXISTS cobertura_movel_municipio_busca_idx ON public.cobertura_movel_municipio (uf, municipio_norm);

CREATE TABLE IF NOT EXISTS public.cobertura_movel_meta (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  periodo text NOT NULL,
  fonte_publicada_em timestamptz,
  carregado_em timestamptz NOT NULL DEFAULT now()
);

-- Dados públicos, iguais para todos os tenants: qualquer usuário logado lê; só a carga grava
ALTER TABLE public.cobertura_movel_municipio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobertura_movel_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cobertura: ler municipios" ON public.cobertura_movel_municipio;
DROP POLICY IF EXISTS "cobertura: ler carga" ON public.cobertura_movel_meta;
CREATE POLICY "cobertura: ler municipios" ON public.cobertura_movel_municipio FOR SELECT TO authenticated USING (true);
CREATE POLICY "cobertura: ler carga" ON public.cobertura_movel_meta FOR SELECT TO authenticated USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cobertura', 'cobertura', true, 10485760, ARRAY['application/json', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- mapas/<projeto>/<arquivo>: o projeto precisa ser do tenant de quem envia
CREATE OR REPLACE FUNCTION public.can_upload_coverage_map(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (storage.foldername(_name))[1] = 'mapas'
     AND EXISTS (SELECT 1 FROM public.projects p
                 WHERE p.id::text = (storage.foldername(_name))[2] AND public.tenant_guard(p.tenant_id))
$$;
REVOKE ALL ON FUNCTION public.can_upload_coverage_map(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_upload_coverage_map(text) TO authenticated, service_role;

-- enviar de novo o mesmo mapa (upsert) precisa de ver, enviar e substituir
DROP POLICY IF EXISTS "cobertura: ver arquivos" ON storage.objects;
DROP POLICY IF EXISTS "cobertura: enviar mapa" ON storage.objects;
DROP POLICY IF EXISTS "cobertura: substituir mapa" ON storage.objects;
CREATE POLICY "cobertura: ver arquivos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cobertura');
CREATE POLICY "cobertura: enviar mapa" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cobertura' AND public.can_upload_coverage_map(name));
CREATE POLICY "cobertura: substituir mapa" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cobertura' AND public.can_upload_coverage_map(name))
  WITH CHECK (bucket_id = 'cobertura' AND public.can_upload_coverage_map(name));
