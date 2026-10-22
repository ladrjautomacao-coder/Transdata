-- Casos DSV: tickets abertos no suporte técnico ou no desenvolvimento (Azure DevOps)
-- para um projeto. Ficam no card do projeto (aba "Inserir caso DSV") e no Kanban
-- ("Visualizar Casos DSV"). Cada caso guarda a fase e a etapa do projeto no momento
-- da abertura: base do relatório de casos abertos por projeto ainda em implantação.

CREATE TABLE IF NOT EXISTS public.project_dsv_cases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (url ~* '^https?://\S+$' AND length(url) <= 2000),
  azure_id bigint CHECK (azure_id IS NULL OR azure_id > 0),
  kind text NOT NULL CHECK (kind IN ('suporte', 'desenvolvimento')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 160),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'resolvido')),
  project_status_at_open text,
  project_sub_phase_at_open text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolved_by_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- o mesmo caso não entra duas vezes no projeto (pelo nº do Azure ou pelo link)
CREATE UNIQUE INDEX IF NOT EXISTS project_dsv_cases_one_azure_id
  ON public.project_dsv_cases (project_id, azure_id) WHERE azure_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS project_dsv_cases_one_url
  ON public.project_dsv_cases (project_id, lower(url));
CREATE INDEX IF NOT EXISTS project_dsv_cases_by_project ON public.project_dsv_cases (project_id, status);

-- Empresa, autor e fase do projeto na abertura; ao resolver, quem e quando (reabrir limpa).
CREATE OR REPLACE FUNCTION public.project_dsv_cases_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := (SELECT full_name FROM public.profiles WHERE user_id = auth.uid());
  v_p public.projects;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_p FROM public.projects WHERE id = NEW.project_id;
    NEW.tenant_id := v_p.tenant_id;
    NEW.project_status_at_open := v_p.status::text;
    NEW.project_sub_phase_at_open := v_p.sub_phase;
    NEW.title := trim(NEW.title);
    NEW.status := 'aberto';
    NEW.created_by := auth.uid();
    NEW.created_by_name := coalesce(v_name, NEW.created_by_name);
    NEW.created_at := now();
    NEW.resolved_at := NULL; NEW.resolved_by := NULL; NEW.resolved_by_name := NULL;
  ELSE
    IF NEW.project_id <> OLD.project_id OR NEW.tenant_id <> OLD.tenant_id THEN
      RAISE EXCEPTION 'Não é possível mudar o projeto do caso.';
    END IF;
    -- abertura e fase na abertura não mudam
    NEW.created_by := OLD.created_by; NEW.created_by_name := OLD.created_by_name; NEW.created_at := OLD.created_at;
    NEW.project_status_at_open := OLD.project_status_at_open; NEW.project_sub_phase_at_open := OLD.project_sub_phase_at_open;
    IF NEW.status = 'resolvido' AND OLD.status <> 'resolvido' THEN
      NEW.resolved_at := now(); NEW.resolved_by := auth.uid(); NEW.resolved_by_name := v_name;
    ELSIF NEW.status = 'aberto' THEN
      NEW.resolved_at := NULL; NEW.resolved_by := NULL; NEW.resolved_by_name := NULL;
    ELSE
      NEW.resolved_at := OLD.resolved_at; NEW.resolved_by := OLD.resolved_by; NEW.resolved_by_name := OLD.resolved_by_name;
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_project_dsv_cases_before_write ON public.project_dsv_cases;
CREATE TRIGGER trg_project_dsv_cases_before_write BEFORE INSERT OR UPDATE ON public.project_dsv_cases
  FOR EACH ROW EXECUTE FUNCTION public.project_dsv_cases_before_write();

-- Quem vê o projeto vê os casos; quem pode editar o projeto (GP dele, admin) registra, resolve e exclui.
ALTER TABLE public.project_dsv_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant guard" ON public.project_dsv_cases;
CREATE POLICY "tenant guard" ON public.project_dsv_cases AS RESTRICTIVE FOR ALL USING (public.tenant_guard(tenant_id));
DROP POLICY IF EXISTS "casos dsv: ver" ON public.project_dsv_cases;
CREATE POLICY "casos dsv: ver" ON public.project_dsv_cases FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));
DROP POLICY IF EXISTS "casos dsv: registrar" ON public.project_dsv_cases;
CREATE POLICY "casos dsv: registrar" ON public.project_dsv_cases FOR INSERT TO authenticated
  WITH CHECK (public.can_write_project(project_id));
DROP POLICY IF EXISTS "casos dsv: alterar" ON public.project_dsv_cases;
CREATE POLICY "casos dsv: alterar" ON public.project_dsv_cases FOR UPDATE TO authenticated
  USING (public.can_write_project(project_id)) WITH CHECK (public.can_write_project(project_id));
DROP POLICY IF EXISTS "casos dsv: excluir" ON public.project_dsv_cases;
CREATE POLICY "casos dsv: excluir" ON public.project_dsv_cases FOR DELETE TO authenticated
  USING (public.can_write_project(project_id));
REVOKE ALL ON public.project_dsv_cases FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_dsv_cases TO authenticated;
