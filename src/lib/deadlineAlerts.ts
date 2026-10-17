// Alertas de prazo (implantação 30 dias; contrato 12, 6 e 3 meses).
// A regra fica no banco (project_deadline_alerts) e é a mesma do e-mail diário;
// os textos vêm de supabase/functions/_shared/deadlineDates.ts.
import { supabase } from "@/integrations/supabase/client";
import type { DeadlineKind, DeadlineMilestone } from "../../supabase/functions/_shared/deadlineDates.ts";

export { remainingShort, remainingText, fmtDate } from "../../supabase/functions/_shared/deadlineDates.ts";
export type { DeadlineKind, DeadlineMilestone };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface DeadlineAlertRow {
  project_id: string;
  company_name: string;
  city: string | null;
  state: string | null;
  manager_id: string | null;
  kind: DeadlineKind;
  milestone: DeadlineMilestone;
  due_date: string;
  days_left: number;
}

/** Prazos de implantação (30 dias) e de contrato (12 meses) dos projetos que o usuário pode ver. */
export async function fetchDeadlineAlerts(): Promise<DeadlineAlertRow[]> {
  const { data, error } = await db.rpc("project_deadline_alerts");
  if (error) throw error;
  return (data ?? []) as DeadlineAlertRow[];
}

export interface AlertEmailSettings {
  tenant_id: string;
  enabled: boolean;
  recipients: string[];
  include_manager: boolean;
  weekly_digest: boolean;
  updated_at?: string;
}

export async function fetchAlertEmailSettings(tenantId: string): Promise<AlertEmailSettings | null> {
  const { data, error } = await db.from("alert_email_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw error;
  return data as AlertEmailSettings | null;
}

export async function saveAlertEmailSettings(s: AlertEmailSettings, userId: string | null) {
  const { error } = await db.from("alert_email_settings")
    .upsert({ ...s, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
  if (error) throw error;
}

export interface AlertDelivery {
  id: string;
  kind: "implantacao" | "contrato" | "resumo" | "teste";
  milestone: string;
  due_date: string;
  recipients: string[];
  subject: string | null;
  status: "enviando" | "enviado" | "erro";
  error: string | null;
  created_at: string;
}

export async function fetchRecentDeliveries(tenantId: string, limit = 8): Promise<AlertDelivery[]> {
  const { data, error } = await db.from("deadline_alert_deliveries")
    .select("id, kind, milestone, due_date, recipients, subject, status, error, created_at")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as AlertDelivery[];
}

/**
 * E-mail de teste (resumo ou um alerta de exemplo) para os destinatários cadastrados
 * ou só para `to` — com `to`, o servidor usa o remetente de teste (ALERTS_TEST_FROM).
 */
export type TestEmailKind = "resumo_implantacao" | "resumo_contrato" | DeadlineKind;

export async function sendTestAlertEmail(kind: TestEmailKind, to?: string): Promise<{ to: string[]; subject: string }> {
  const { data, error } = await supabase.functions.invoke("deadline-alerts", { body: { mode: "test", kind, to: to?.trim() || undefined } });
  if (error) {
    // a função devolve { error } com a mensagem do Resend/validação
    const ctx = (error as { context?: Response }).context;
    const detail = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    throw new Error(detail?.error ?? error.message);
  }
  return data as { to: string[]; subject: string };
}

const EMAIL_RE = /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[a-z]{2,}$/i;
export const isValidEmail = (s: string) => EMAIL_RE.test(s.trim());
