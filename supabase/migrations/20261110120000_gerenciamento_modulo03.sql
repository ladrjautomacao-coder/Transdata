-- Gerenciamento: o que o GP registra no módulo 03 (Atividades presenciais, in loco) de cada projeto.
-- Mesmo formato dos módulos 01 e 02: um registro por projeto, com o estado da tela inteiro em JSON
-- (src/lib/modulo03.ts Modulo03Estado).
-- Acesso como nos módulos 01 e 02: o Super Admin em todos os projetos; o Gerente de Projetos
-- (get_my_manager_id) só nos projetos em que é o GP, na própria empresa.

CREATE TABLE IF NOT EXISTS public.gerenciamento_modulo03 (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  estado jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT gerenciamento_modulo03_estado_obj_chk CHECK (jsonb_typeof(estado) = 'object')
);

-- Empresa vem do projeto; quem e quando gravou vêm da sessão.
CREATE OR REPLACE FUNCTION public.gerenciamento_modulo03_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.tenant_id := (SELECT tenant_id FROM public.projects WHERE id = NEW.project_id);
  IF NEW.tenant_id IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gerenciamento_modulo03_before_write ON public.gerenciamento_modulo03;
CREATE TRIGGER trg_gerenciamento_modulo03_before_write
  BEFORE INSERT OR UPDATE ON public.gerenciamento_modulo03
  FOR EACH ROW EXECUTE FUNCTION public.gerenciamento_modulo03_before_write();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gerenciamento_modulo03 TO authenticated;
GRANT ALL ON public.gerenciamento_modulo03 TO service_role;
ALTER TABLE public.gerenciamento_modulo03 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gerenciamento: super admin" ON public.gerenciamento_modulo03;
CREATE POLICY "gerenciamento: super admin" ON public.gerenciamento_modulo03 FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "gerenciamento: gerente de projetos" ON public.gerenciamento_modulo03;
CREATE POLICY "gerenciamento: gerente de projetos" ON public.gerenciamento_modulo03 FOR ALL TO authenticated
  USING (public.tenant_guard(tenant_id) AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.manager_id = (SELECT public.get_my_manager_id())))
  WITH CHECK (public.tenant_guard(tenant_id) AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.manager_id = (SELECT public.get_my_manager_id())));
