-- Cadastro do projeto: cidades onde a operação roda (além da cidade do contrato). Uma operação
-- pode atender 2 ou 3 municípios; o mapa de calor das operadoras analisa cada um.
-- Lista de { "cod_ibge": 4203006, "municipio": "Caçador", "uf": "SC" }, escolhidos da lista
-- do IBGE (a mesma da cobertura da Anatel). Vazia: vale a cidade do contrato.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS operation_cities jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_operation_cities_chk;
ALTER TABLE public.projects ADD CONSTRAINT projects_operation_cities_chk
  CHECK (jsonb_typeof(operation_cities) = 'array' AND jsonb_array_length(operation_cities) <= 20);
