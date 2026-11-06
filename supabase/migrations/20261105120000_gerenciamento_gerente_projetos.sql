-- Gerenciamento liberado para os Gerentes de Projetos: quem está ativo na Equipe com a função
-- Gerente de Projetos (get_my_manager_id) lê e grava os módulos 01 e 02 só dos projetos em que é
-- o GP (projects.manager_id), na própria empresa. A regra do Super Admin (todos) continua.

DROP POLICY IF EXISTS "gerenciamento: gerente de projetos" ON public.gerenciamento_modulo01;
CREATE POLICY "gerenciamento: gerente de projetos" ON public.gerenciamento_modulo01 FOR ALL TO authenticated
  USING (public.tenant_guard(tenant_id) AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.manager_id = (SELECT public.get_my_manager_id())))
  WITH CHECK (public.tenant_guard(tenant_id) AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.manager_id = (SELECT public.get_my_manager_id())));

DROP POLICY IF EXISTS "gerenciamento: gerente de projetos" ON public.gerenciamento_modulo02;
CREATE POLICY "gerenciamento: gerente de projetos" ON public.gerenciamento_modulo02 FOR ALL TO authenticated
  USING (public.tenant_guard(tenant_id) AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.manager_id = (SELECT public.get_my_manager_id())))
  WITH CHECK (public.tenant_guard(tenant_id) AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.manager_id = (SELECT public.get_my_manager_id())));
