-- "Campos personalizados": 5 slots genéricos que cada tenant (fora da
-- Transdata) pode nomear e tipar do próprio jeito, sem precisar de mim pra
-- cada campo novo que um cliente pedir. A Transdata não usa isso — os
-- campos ficam null pra ela, sem nenhuma mudança de comportamento.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_field_1 text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_field_2 text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_field_3 text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_field_4 text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_field_5 text;

-- Configuração dos 5 slots (nome + tipo + ativo/inativo) por tenant, no
-- mesmo padrão de status_labels: o admin do próprio tenant edita só essa
-- coluna (logo/cores continuam exclusivos do Super Admin).
ALTER TABLE public.tenant_branding ADD COLUMN IF NOT EXISTS custom_fields jsonb;
GRANT UPDATE (custom_fields) ON public.tenant_branding TO authenticated;
