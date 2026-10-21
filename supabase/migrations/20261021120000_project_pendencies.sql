-- Implantação pendente ("card filho"): solução contratada que o cliente deixou para
-- depois, por decisão dele. O GP registra a pendência e pode mover o projeto pai para
-- Implementado; a pendência fica na coluna "Implantação pendente" do Kanban até ser
-- implantada ou cancelada (cliente desistiu).
--
-- É um registro à parte, não um projeto: Dashboard e relatórios continuam contando o
-- projeto pai uma vez só, como Implementado.

CREATE TABLE IF NOT EXISTS public.project_pendencies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  solution_id uuid REFERENCES public.solutions(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 120),
  reason_kind text NOT NULL CHECK (reason_kind IN ('decisao_cliente', 'infraestrutura_cliente', 'terceiros', 'outro')),
  reason text CHECK (reason IS NULL OR length(reason) <= 1000),
  expected_date date,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'implantada', 'cancelada')),
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolved_by_name text,
  resolution_note text CHECK (resolution_note IS NULL OR length(resolution_note) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- "outro motivo" pede o detalhe; desistência do cliente pede o motivo
  CONSTRAINT project_pendencies_other_reason CHECK (reason_kind <> 'outro' OR length(trim(coalesce(reason, ''))) >= 5),
  CONSTRAINT project_pendencies_cancel_note CHECK (status <> 'cancelada' OR length(trim(coalesce(resolution_note, ''))) >= 5)
);

-- um card filho em aberto por item em cada projeto
CREATE UNIQUE INDEX IF NOT EXISTS project_pendencies_one_open
  ON public.project_pendencies (project_id, lower(title)) WHERE status = 'aberta';
CREATE INDEX IF NOT EXISTS project_pendencies_open_by_tenant
  ON public.project_pendencies (tenant_id, created_at) WHERE status = 'aberta';

-- Preenche empresa, autor e encerramento; um card filho encerrado não volta a abrir.
CREATE OR REPLACE FUNCTION public.project_pendencies_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := (SELECT full_name FROM public.profiles WHERE user_id = auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.tenant_id := (SELECT tenant_id FROM public.projects WHERE id = NEW.project_id);
    NEW.title := trim(NEW.title);
    NEW.status := 'aberta';
    NEW.created_by := auth.uid();
    NEW.created_by_name := coalesce(v_name, NEW.created_by_name);
    NEW.created_at := now();
    NEW.resolved_at := NULL; NEW.resolved_by := NULL; NEW.resolved_by_name := NULL; NEW.resolution_note := NULL;
  ELSE
    IF OLD.status <> 'aberta' THEN
      RAISE EXCEPTION 'Este card filho já foi encerrado.';
    END IF;
    IF NEW.project_id <> OLD.project_id OR NEW.tenant_id <> OLD.tenant_id THEN
      RAISE EXCEPTION 'Não é possível mudar o projeto do card filho.';
    END IF;
    NEW.created_by := OLD.created_by; NEW.created_by_name := OLD.created_by_name; NEW.created_at := OLD.created_at;
    IF NEW.status <> 'aberta' THEN
      NEW.resolved_at := now(); NEW.resolved_by := auth.uid(); NEW.resolved_by_name := v_name;
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_project_pendencies_before_write ON public.project_pendencies;
CREATE TRIGGER trg_project_pendencies_before_write BEFORE INSERT OR UPDATE ON public.project_pendencies
  FOR EACH ROW EXECUTE FUNCTION public.project_pendencies_before_write();

-- Quem vê o projeto vê os cards filhos; quem pode editar o projeto (GP dele, admin) cria e encerra.
-- Sem DELETE: o card filho é encerrado (implantada / cliente desistiu) e fica no histórico.
ALTER TABLE public.project_pendencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant guard" ON public.project_pendencies;
CREATE POLICY "tenant guard" ON public.project_pendencies AS RESTRICTIVE FOR ALL USING (public.tenant_guard(tenant_id));
DROP POLICY IF EXISTS "pendencias: ver" ON public.project_pendencies;
CREATE POLICY "pendencias: ver" ON public.project_pendencies FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));
DROP POLICY IF EXISTS "pendencias: criar" ON public.project_pendencies;
CREATE POLICY "pendencias: criar" ON public.project_pendencies FOR INSERT TO authenticated
  WITH CHECK (public.can_write_project(project_id));
DROP POLICY IF EXISTS "pendencias: encerrar" ON public.project_pendencies;
CREATE POLICY "pendencias: encerrar" ON public.project_pendencies FOR UPDATE TO authenticated
  USING (public.can_write_project(project_id)) WITH CHECK (public.can_write_project(project_id));
REVOKE ALL ON public.project_pendencies FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.project_pendencies TO authenticated;

-- Cards filhos em aberto, com o projeto e o GP (sino do portal e resumo semanal por e-mail).
-- SECURITY INVOKER: no portal cada um só vê o que já pode ver (RLS).
CREATE OR REPLACE FUNCTION public.project_pendencies_open(_today date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date)
RETURNS TABLE (
  pendency_id uuid, tenant_id uuid, project_id uuid, company_name text, project_code text, city text, state text,
  status text, sub_phase text, manager_id uuid, manager_name text,
  title text, reason_kind text, reason text, expected_date date, opened_on date, days_open integer
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT x.id, x.tenant_id, p.id, p.company_name, p.project_code, p.city, p.state::text, p.status::text, p.sub_phase,
         p.manager_id, gm.full_name,
         x.title, x.reason_kind, x.reason, x.expected_date,
         (x.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
         _today - (x.created_at AT TIME ZONE 'America/Sao_Paulo')::date
  FROM public.project_pendencies x
  JOIN public.projects p ON p.id = x.project_id
  LEFT JOIN public.team_members gm ON gm.id = p.manager_id
  WHERE x.status = 'aberta'
  ORDER BY x.created_at, p.company_name
$$;
REVOKE ALL ON FUNCTION public.project_pendencies_open(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_pendencies_open(date) TO authenticated, service_role;
-- O resumo semanal por e-mail usa o registro de envios que já existe (kind 'resumo', milestone 'pendencias').
