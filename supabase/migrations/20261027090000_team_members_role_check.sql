-- Equipe: a função do membro vem da lista "Funções da equipe" (app_settings team.roles), editável
-- em Configurações. A trava antiga só aceitava executivo_vendas e gerente_projetos e barrava as
-- funções novas (Coordenador de Implantação etc.); agora vale o mesmo formato do identificador
-- exigido na tela de configurações.
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_role_check
  CHECK (role ~ '^[a-z0-9_]{1,64}$');
