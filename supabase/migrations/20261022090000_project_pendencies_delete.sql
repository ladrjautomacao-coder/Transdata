-- Card filho aberto por engano: quem pode editar o projeto (GP dele, admin) pode excluir.
-- Só o card filho em aberto; o implantado e o cancelado (cliente desistiu) ficam no
-- histórico do projeto e não podem ser excluídos.
DROP POLICY IF EXISTS "pendencias: excluir aberta" ON public.project_pendencies;
CREATE POLICY "pendencias: excluir aberta" ON public.project_pendencies FOR DELETE TO authenticated
  USING (status = 'aberta' AND public.can_write_project(project_id));
GRANT DELETE ON public.project_pendencies TO authenticated;
