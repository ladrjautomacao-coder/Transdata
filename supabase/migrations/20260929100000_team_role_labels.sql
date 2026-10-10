-- Nomes da Equipe personalizáveis por tenant (mesmo espírito de status_labels
-- e custom_fields): "Gerente Comercial"/"Executivo de Vendas" e "Gerente de
-- Projetos" viram texto configurável em vez de fixo. Sem override -> cada
-- tela continua mostrando exatamente o texto de hoje (Transdata inclusive).
ALTER TABLE public.tenant_branding ADD COLUMN IF NOT EXISTS team_role_labels jsonb;
GRANT UPDATE (team_role_labels) ON public.tenant_branding TO authenticated;

-- get_public_tenant_branding passa a expor também team_role_labels. Postgres
-- não deixa CREATE OR REPLACE mudar o formato de retorno, por isso o DROP.
DROP FUNCTION IF EXISTS public.get_public_tenant_branding(text);
CREATE OR REPLACE FUNCTION public.get_public_tenant_branding(_slug text)
RETURNS TABLE (slug text, portal_name text, logo_url text, primary_color text,
               sidebar_color text, accent_color text, status text, status_labels jsonb,
               team_role_labels jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.slug, tb.portal_name, tb.logo_url, tb.primary_color, tb.sidebar_color,
         tb.accent_color, t.status, tb.status_labels, tb.team_role_labels
  FROM public.tenants t
  LEFT JOIN public.tenant_branding tb ON tb.tenant_id = t.id
  WHERE lower(t.slug) = lower(_slug)
$$;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_branding(text) TO anon, authenticated;
