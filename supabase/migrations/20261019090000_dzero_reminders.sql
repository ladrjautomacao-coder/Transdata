-- Lembrete de D-zero (pagamento do sinal que o cliente faz à Transdata para iniciar o projeto).
--
-- Projeto na fase Comercial cuja etapa ainda não chegou a "Pagamento D-zero efetuado"
-- recebe um lembrete por e-mail a partir de 2 dias após o cadastro, a cada 2 dias, de
-- segunda a sexta (a cadência fica na Edge Function deadline-alerts). Para quando a etapa
-- vira pagamento_dzero / sem_pendencias ou o projeto sai do Comercial.

-- O registro de envios passa a aceitar o tipo "dzero"
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.deadline_alert_deliveries'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%kind%' LOOP
    EXECUTE format('ALTER TABLE public.deadline_alert_deliveries DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.deadline_alert_deliveries ADD CONSTRAINT deadline_alert_deliveries_kind_check
  CHECK (kind IN ('implantacao', 'contrato', 'resumo', 'teste', 'dzero'));

CREATE INDEX IF NOT EXISTS deadline_alert_deliveries_project_kind
  ON public.deadline_alert_deliveries (project_id, kind, due_date DESC);

-- Projetos que aguardam o D-zero, com o último lembrete enviado.
-- SECURITY INVOKER: no portal cada um só vê os projetos que já pode ver (RLS).
CREATE OR REPLACE FUNCTION public.project_dzero_pending(_today date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date)
RETURNS TABLE (
  project_id uuid, tenant_id uuid, company_name text, project_code text, city text, state text,
  status text, sub_phase text, manager_id uuid, manager_name text, executive_name text,
  registered_on date, contract_date date, d_zero_date date, days_waiting integer,
  last_reminder date, reminders_sent integer
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.id, p.tenant_id, p.company_name, p.project_code, p.city, p.state::text, p.status::text, p.sub_phase,
         p.manager_id, gm.full_name, ex.full_name,
         (p.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
         p.contract_date, p.d_zero_date,
         _today - (p.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
         d.last_sent, coalesce(d.sent, 0)::integer
  FROM public.projects p
  LEFT JOIN public.team_members gm ON gm.id = p.manager_id
  LEFT JOIN public.team_members ex ON ex.id = p.executive_id
  LEFT JOIN LATERAL (
    SELECT max(x.due_date) AS last_sent, count(*) AS sent
    FROM public.deadline_alert_deliveries x
    WHERE x.project_id = p.id AND x.kind = 'dzero' AND x.status = 'enviado'
  ) d ON true
  WHERE p.status = 'comercial'
    AND coalesce(p.sub_phase, '') NOT IN ('pagamento_dzero', 'sem_pendencias')
    AND _today - (p.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= 2
  ORDER BY p.created_at, p.company_name
$$;
REVOKE ALL ON FUNCTION public.project_dzero_pending(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_dzero_pending(date) TO authenticated, service_role;
