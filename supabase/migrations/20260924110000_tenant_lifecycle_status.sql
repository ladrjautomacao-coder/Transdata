-- Fase 4: status comercial do cliente (trial/ativo/inadimplente/bloqueado/
-- cancelado), gerenciado pelo Super Admin.
ALTER TABLE public.tenants
  ADD COLUMN status text NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'active', 'past_due', 'blocked', 'canceled')),
  ADD COLUMN trial_ends_at timestamptz,
  ADD COLUMN activated_at timestamptz,
  ADD COLUMN blocked_reason text;

-- Transdata é o cliente fundador, já ativo (não é trial).
UPDATE public.tenants SET status = 'active', activated_at = created_at
  WHERE id = 'a2f1c8e0-0000-4000-8000-000000000001';

-- Bloqueio de verdade: tenant_guard() passa a negar acesso a dados quando o
-- cliente está blocked/canceled. super_admin (operador da plataforma)
-- continua isento, para poder revisar/dar suporte a um cliente bloqueado.
CREATE OR REPLACE FUNCTION public.tenant_guard(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _tenant_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR (
        _tenant_id = public.get_my_tenant_id()
        AND EXISTS (
          SELECT 1 FROM public.tenants t
          WHERE t.id = _tenant_id AND t.status NOT IN ('blocked', 'canceled')
        )
      )
    )
$$;
