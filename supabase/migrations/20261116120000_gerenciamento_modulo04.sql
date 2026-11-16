-- Gerenciamento: módulo 04 (Entrega de cartões e equipamentos) de cada projeto.
-- Mesmo formato dos módulos 01 a 03: um registro por projeto, com o estado da tela inteiro em JSON
-- (src/lib/modulo04.ts Modulo04Estado), e o mesmo acesso: o Super Admin em todos os projetos; o
-- Gerente de Projetos (get_my_manager_id) só nos projetos em que é o GP, na própria empresa.
-- O histórico (estado.historico) só cresce: o banco recusa gravar se alguma linha antiga sumir ou
-- mudar, e o portal não tem permissão de excluir o registro (só a exclusão do projeto o remove).

CREATE TABLE IF NOT EXISTS public.gerenciamento_modulo04 (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  estado jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT gerenciamento_modulo04_estado_obj_chk CHECK (jsonb_typeof(estado) = 'object')
);

-- Empresa vem do projeto; quem e quando gravou vêm da sessão; o histórico nunca perde linhas.
CREATE OR REPLACE FUNCTION public.gerenciamento_modulo04_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.tenant_id := (SELECT tenant_id FROM public.projects WHERE id = NEW.project_id);
  IF NEW.tenant_id IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  IF TG_OP = 'UPDATE'
     AND NOT (COALESCE(NEW.estado -> 'historico', '[]'::jsonb) @> COALESCE(OLD.estado -> 'historico', '[]'::jsonb)) THEN
    RAISE EXCEPTION 'O histórico do módulo 04 não pode ser apagado nem alterado.';
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gerenciamento_modulo04_before_write ON public.gerenciamento_modulo04;
CREATE TRIGGER trg_gerenciamento_modulo04_before_write
  BEFORE INSERT OR UPDATE ON public.gerenciamento_modulo04
  FOR EACH ROW EXECUTE FUNCTION public.gerenciamento_modulo04_before_write();

-- sem DELETE para quem usa o portal: o histórico não some junto com o registro. As permissões
-- padrão do schema dão tudo a anon e authenticated em toda tabela nova; aqui ficam só as que o
-- portal usa (ler e gravar com upsert) e nada para quem não está logado.
REVOKE ALL ON public.gerenciamento_modulo04 FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.gerenciamento_modulo04 FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gerenciamento_modulo04 TO authenticated;
GRANT ALL ON public.gerenciamento_modulo04 TO service_role;
ALTER TABLE public.gerenciamento_modulo04 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gerenciamento: super admin" ON public.gerenciamento_modulo04;
CREATE POLICY "gerenciamento: super admin" ON public.gerenciamento_modulo04 FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "gerenciamento: gerente de projetos" ON public.gerenciamento_modulo04;
CREATE POLICY "gerenciamento: gerente de projetos" ON public.gerenciamento_modulo04 FOR ALL TO authenticated
  USING (public.tenant_guard(tenant_id) AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.manager_id = (SELECT public.get_my_manager_id())))
  WITH CHECK (public.tenant_guard(tenant_id) AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.manager_id = (SELECT public.get_my_manager_id())));
