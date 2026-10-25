-- Cadastro do projeto: CNPJ do cliente, frota reserva (parte da frota contratada) e a
-- funcionalidade AtlasPay. Usados no e-mail ao Data Center do Gerenciamento.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS reserve_fleet integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS atlas_pay boolean NOT NULL DEFAULT false;

-- CNPJ com máscara (00.000.000/0000-00); a tela formata enquanto o GP digita
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_cnpj_format_chk;
ALTER TABLE public.projects ADD CONSTRAINT projects_cnpj_format_chk
  CHECK (cnpj IS NULL OR cnpj ~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$');

-- A reserva faz parte da frota contratada
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_reserve_fleet_chk;
ALTER TABLE public.projects ADD CONSTRAINT projects_reserve_fleet_chk
  CHECK (reserve_fleet >= 0 AND (fleet_size IS NULL OR reserve_fleet <= fleet_size));
