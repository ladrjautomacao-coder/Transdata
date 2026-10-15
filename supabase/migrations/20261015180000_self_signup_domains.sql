-- Autocadastro no portal: só e-mails corporativos (@itstransdata.com e
-- @mobilecomm.com) e, depois de confirmar o e-mail, a conta fica
-- "pendente" até um admin escolher o papel e liberar o acesso.
--
-- Contas criadas por um admin (Gestão de Usuários / Admin API) já nascem com o
-- e-mail confirmado: seguem livres de domínio e ativas, como hoje.

-- 1) Situação de acesso do perfil (quem já existe continua ativo).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_status text NOT NULL DEFAULT 'ativo';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_access_status_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_access_status_check CHECK (access_status IN ('pendente','ativo'));
  END IF;
END $$;

-- 2) Domínios permitidos no autocadastro.
CREATE OR REPLACE FUNCTION public.is_allowed_signup_email(_email text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT lower(split_part(coalesce(_email, ''), '@', 2)) IN ('itstransdata.com', 'mobilecomm.com')
$$;

-- 3) Barreira no banco: autocadastro (e-mail ainda não confirmado) com outro
--    domínio é recusado, mesmo chamando a API de cadastro diretamente.
CREATE OR REPLACE FUNCTION public.enforce_signup_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL AND NOT public.is_allowed_signup_email(NEW.email) THEN
    RAISE EXCEPTION 'Cadastro permitido apenas para e-mails @itstransdata.com ou @mobilecomm.com'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_signup_domain ON auth.users;
CREATE TRIGGER enforce_signup_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_signup_domain();

-- 4) Novo usuário: autocadastro entra sempre na Transdata, pendente e sem papel
--    (sem papel = nenhuma permissão). O tenant do metadata só vale para contas
--    criadas por admin — no autocadastro o metadata vem do próprio navegador.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_self_signup boolean := NEW.email_confirmed_at IS NULL;
BEGIN
  IF v_self_signup THEN
    INSERT INTO public.profiles (user_id, full_name, cargo, tenant_id, access_status)
    VALUES (
      NEW.id,
      left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email), 120),
      NULL,
      'a2f1c8e0-0000-4000-8000-000000000001',
      'pendente'
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, cargo, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'cargo',
    COALESCE((NEW.raw_user_meta_data->>'tenant_id')::uuid, 'a2f1c8e0-0000-4000-8000-000000000001')
  )
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 5) Pendente não pertence a tenant nenhum: tenant_guard() (RESTRICTIVE em todas
--    as tabelas) passa a negar tudo para ele até ser liberado.
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() AND access_status = 'ativo' $$;

-- 6) Situação do próprio acesso (a tela "Aguardando liberação" usa isto).
CREATE OR REPLACE FUNCTION public.get_my_access_status()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT access_status FROM public.profiles WHERE user_id = auth.uid() $$;
REVOKE ALL ON FUNCTION public.get_my_access_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_access_status() TO authenticated, service_role;

-- 7) Cadastros aguardando liberação (admin do tenant ou super_admin).
CREATE OR REPLACE FUNCTION public.list_pending_signups()
RETURNS TABLE (user_id uuid, email text, full_name text, created_at timestamptz, email_confirmed boolean)
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
    SELECT p.user_id, u.email::text, p.full_name, u.created_at, u.email_confirmed_at IS NOT NULL
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.access_status = 'pendente'
      AND (v_super OR p.tenant_id = v_tenant)
    ORDER BY u.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_pending_signups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_signups() TO authenticated, service_role;

-- 8) Liberar o acesso escolhendo o papel. Super Admin e Integração não são
--    concedidos por aqui (seguem pela Gestão de Usuários).
CREATE OR REPLACE FUNCTION public.approve_signup(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_super boolean := public.has_role(auth.uid(), 'super_admin');
  v_target_tenant uuid;
BEGIN
  IF NOT (v_super OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  IF _role IN ('super_admin', 'integration') THEN
    RAISE EXCEPTION 'Papel não permitido na liberação' USING ERRCODE = '22023';
  END IF;

  SELECT tenant_id INTO v_target_tenant
  FROM public.profiles WHERE user_id = _user_id AND access_status = 'pendente';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadastro pendente não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_super AND v_target_tenant IS DISTINCT FROM public.get_my_tenant_id() THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
  UPDATE public.profiles SET access_status = 'ativo' WHERE user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_signup(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_signup(uuid, public.app_role) TO authenticated, service_role;
