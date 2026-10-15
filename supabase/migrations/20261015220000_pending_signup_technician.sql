-- Liberação de autocadastro: mostra se o e-mail já é de um técnico da agenda
-- (o quadro sugere o perfil Implantação e o vínculo com as visitas é automático).
DROP FUNCTION IF EXISTS public.list_pending_signups();
CREATE FUNCTION public.list_pending_signups()
RETURNS TABLE (user_id uuid, email text, full_name text, created_at timestamptz, email_confirmed boolean, technician_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_super boolean := public.has_role(auth.uid(), 'super_admin');
  v_tenant uuid := public.get_my_tenant_id();
BEGIN
  IF NOT (v_super OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.user_id, u.email::text, p.full_name, u.created_at, u.email_confirmed_at IS NOT NULL,
           (SELECT t.full_name FROM public.implantation_technicians t
             WHERE t.tenant_id = p.tenant_id AND t.removed_at IS NULL
               AND lower(t.email) = lower(u.email)
             LIMIT 1)
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.access_status = 'pendente'
      AND (v_super OR p.tenant_id = v_tenant)
    ORDER BY u.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_pending_signups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_signups() TO authenticated, service_role;
