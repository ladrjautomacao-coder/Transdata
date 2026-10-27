-- Funções da equipe (Equipe > Adicionar Membro): acrescenta as funções que faltam, sem mexer nas
-- que já existem nem nos rótulos editados em Configurações do Sistema. O "Coordenador de
-- Implantação" assina o TAP do Gerenciamento (slug coordenador_implantacao).
UPDATE public.app_settings s
SET value = s.value || COALESCE((
  SELECT jsonb_agg(n ORDER BY ord)
  FROM jsonb_array_elements('[
    {"value":"coordenador_implantacao","label":"Coordenador de Implantação"},
    {"value":"implantador","label":"Implantador"},
    {"value":"gerente_operacoes","label":"Gerente de Operações"},
    {"value":"gerente_relacionamento","label":"Gerente de Relacionamento"},
    {"value":"analista","label":"Analista"},
    {"value":"assistente","label":"Assistente"}
  ]'::jsonb) WITH ORDINALITY AS novo(n, ord)
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s.value) e WHERE e->>'value' = n->>'value')
), '[]'::jsonb),
updated_at = now()
WHERE s.key = 'team.roles';
