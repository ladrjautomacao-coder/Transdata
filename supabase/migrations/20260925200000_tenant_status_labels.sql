-- Etapas do Kanban configuráveis por tenant. O enum project_status e os
-- valores gravados em projects.status continuam exatamente os mesmos pra
-- todo mundo (zero risco pra Transdata) — isso só guarda o TEXTO exibido
-- pra cada valor, por tenant. Sem override -> cai no rótulo padrão de hoje.
ALTER TABLE public.tenant_branding ADD COLUMN IF NOT EXISTS status_labels jsonb;

-- O próprio admin do tenant pode editar as ETAPAS (só essa coluna — logo,
-- cores e nome do portal continuam exclusivos do Super Admin via
-- Portal, combinando com a regra de "personalização só depois de fechar
-- negócio"). GRANT por coluna garante isso independente da política de RLS.
CREATE POLICY "tenant admin can update own status labels" ON public.tenant_branding
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.has_role(auth.uid(), 'admin'));
GRANT UPDATE (status_labels) ON public.tenant_branding TO authenticated;

-- get_public_tenant_branding passa a expor também status_labels (não é
-- sensível, só texto de exibição). Postgres não deixa trocar o formato de
-- retorno com CREATE OR REPLACE — precisa dropar a versão antiga primeiro.
DROP FUNCTION IF EXISTS public.get_public_tenant_branding(text);
CREATE OR REPLACE FUNCTION public.get_public_tenant_branding(_slug text)
RETURNS TABLE (slug text, portal_name text, logo_url text, primary_color text,
               sidebar_color text, accent_color text, status text, status_labels jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.slug, tb.portal_name, tb.logo_url, tb.primary_color, tb.sidebar_color,
         tb.accent_color, t.status, tb.status_labels
  FROM public.tenants t
  LEFT JOIN public.tenant_branding tb ON tb.tenant_id = t.id
  WHERE lower(t.slug) = lower(_slug)
$$;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_branding(text) TO anon, authenticated;
