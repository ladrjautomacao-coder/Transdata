-- Alertas de prazo, fase 1:
--   • Prazo de implantação: aviso 30 dias antes da finalização prevista
--     (contract_date + implementation_deadline_days), para projetos não implementados.
--   • Prazo de contrato: avisos 12, 6 e 3 meses antes do fim do contrato
--     (contract_date + contractual_deadline_days), para projetos que não estão em "Outros".
--
-- O sino do portal e o e-mail diário usam a mesma regra: project_deadline_alerts().
-- O e-mail sai pela Edge Function deadline-alerts (Resend), chamada todo dia às
-- 08:00 de Brasília pelo pg_cron; às segundas ela também manda o resumo semanal.

-- ─── Regra ─────────────────────────────────────────────────────────────────
-- SECURITY INVOKER: no portal cada um só vê os projetos que já pode ver (RLS).
-- Não lê e-mails da equipe (coluna protegida): a Edge Function busca à parte.
CREATE OR REPLACE FUNCTION public.project_deadline_alerts(_today date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date)
RETURNS TABLE (
  project_id uuid, tenant_id uuid, company_name text, project_code text, city text, state text, country_code text,
  status text, sub_phase text, manager_id uuid, manager_name text, executive_name text,
  contract_date date, kind text, milestone text, deadline_days integer, due_date date, days_left integer
)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH d AS (
    SELECT p.id, p.tenant_id, p.company_name, p.project_code, p.city, p.state::text AS state, p.country_code,
           p.status::text AS status, p.sub_phase, p.manager_id, gm.full_name AS manager_name, ex.full_name AS executive_name,
           p.contract_date, k.kind, k.ddays, (p.contract_date + k.ddays) AS due
    FROM public.projects p
    LEFT JOIN public.team_members gm ON gm.id = p.manager_id
    LEFT JOIN public.team_members ex ON ex.id = p.executive_id
    CROSS JOIN LATERAL (VALUES
      ('implantacao', CASE WHEN p.status IN ('comercial', 'planejamento', 'implantacao') THEN p.implementation_deadline_days END),
      ('contrato',    CASE WHEN p.status <> 'suspenso' THEN p.contractual_deadline_days END)
    ) AS k(kind, ddays)
    WHERE coalesce(k.ddays, 0) > 0
  ), w AS (
    SELECT d.*, CASE
      WHEN d.kind = 'implantacao' THEN CASE WHEN _today >= d.due - 30 THEN '30d' END
      WHEN _today >= (d.due - interval '3 months')::date THEN '3m'
      WHEN _today >= (d.due - interval '6 months')::date THEN '6m'
      WHEN _today >= (d.due - interval '12 months')::date THEN '12m'
    END AS milestone
    FROM d
    WHERE _today <= d.due
  )
  SELECT w.id, w.tenant_id, w.company_name, w.project_code, w.city, w.state, w.country_code, w.status, w.sub_phase,
         w.manager_id, w.manager_name, w.executive_name, w.contract_date, w.kind, w.milestone, w.ddays, w.due, (w.due - _today)
  FROM w
  WHERE w.milestone IS NOT NULL
  ORDER BY w.due, w.company_name
$$;
REVOKE ALL ON FUNCTION public.project_deadline_alerts(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_deadline_alerts(date) TO authenticated, service_role;

-- ─── Destinatários por empresa ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.emails_valid(_list text[])
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(e ~* '^[^@\s,;<>"]+@[^@\s,;<>"]+\.[a-z]{2,}$'), true) FROM unnest(_list) AS e
$$;

CREATE TABLE IF NOT EXISTS public.alert_email_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  recipients text[] NOT NULL DEFAULT '{}',
  include_manager boolean NOT NULL DEFAULT false,
  weekly_digest boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_email_settings_recipients_check CHECK (cardinality(recipients) <= 20 AND public.emails_valid(recipients))
);
GRANT SELECT, INSERT, UPDATE ON public.alert_email_settings TO authenticated;
GRANT ALL ON public.alert_email_settings TO service_role;
ALTER TABLE public.alert_email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins do tenant gerenciam e-mails de alerta" ON public.alert_email_settings;
CREATE POLICY "admins do tenant gerenciam e-mails de alerta" ON public.alert_email_settings FOR ALL TO authenticated
  USING (public.tenant_guard(tenant_id) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')))
  WITH CHECK (public.tenant_guard(tenant_id) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));

-- Transdata: por enquanto só projetos@itstransdata.com
INSERT INTO public.alert_email_settings (tenant_id, enabled, recipients, include_manager, weekly_digest)
SELECT id, true, ARRAY['projetos@itstransdata.com'], false, true
FROM public.tenants WHERE id = 'a2f1c8e0-0000-4000-8000-000000000001'
ON CONFLICT (tenant_id) DO NOTHING;

-- ─── Registro de envios (um e-mail por projeto, tipo, marco e prazo) ───────
CREATE TABLE IF NOT EXISTS public.deadline_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,  -- nulo no resumo semanal
  kind text NOT NULL CHECK (kind IN ('implantacao', 'contrato', 'resumo', 'teste')),
  milestone text NOT NULL,   -- 30d | 12m | 6m | 3m | semanal | teste
  due_date date NOT NULL,    -- o prazo avisado (no resumo, a segunda-feira)
  recipients text[] NOT NULL DEFAULT '{}',
  subject text,
  status text NOT NULL CHECK (status IN ('enviando', 'enviado', 'erro')),
  error text,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS deadline_alert_deliveries_once
  ON public.deadline_alert_deliveries (tenant_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, milestone, due_date)
  WHERE status IN ('enviando', 'enviado') AND kind <> 'teste';
CREATE INDEX IF NOT EXISTS deadline_alert_deliveries_recent ON public.deadline_alert_deliveries (tenant_id, created_at DESC);

GRANT SELECT ON public.deadline_alert_deliveries TO authenticated;
GRANT ALL ON public.deadline_alert_deliveries TO service_role;
ALTER TABLE public.deadline_alert_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins do tenant veem os envios" ON public.deadline_alert_deliveries;
CREATE POLICY "admins do tenant veem os envios" ON public.deadline_alert_deliveries FOR SELECT TO authenticated
  USING (public.tenant_guard(tenant_id) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')));

-- ─── Agendamento diário (08:00 de Brasília = 11:00 UTC) ────────────────────
-- Segredo gerado no próprio banco (nunca no git); a Edge Function confere com
-- verify_job_secret(), que só o service_role executa.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.job_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.job_secrets (name, secret)
VALUES ('deadline-alerts', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_job_secret(_name text, _secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM private.job_secrets WHERE name = _name AND secret = _secret)
$$;
REVOKE ALL ON FUNCTION public.verify_job_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_job_secret(text, text) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'deadline-alerts-daily';
SELECT cron.schedule(
  'deadline-alerts-daily',
  '0 11 * * *',
  $job$
    SELECT net.http_post(
      url := 'https://emzqlctomlsjwmgthbkv.supabase.co/functions/v1/deadline-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-job-secret', (SELECT secret FROM private.job_secrets WHERE name = 'deadline-alerts')),
      body := '{"mode":"cron"}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
