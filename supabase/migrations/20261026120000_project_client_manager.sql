-- Cadastro do projeto: quem conduz o projeto do lado do cliente (Gerente de Projetos no cliente).
-- Usado no pedido "IMP [IN1-8] Designação do GP" do Gerenciamento.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_manager_name text;
