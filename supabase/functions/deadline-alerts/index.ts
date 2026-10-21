// Alertas de prazo por e-mail (Resend).
//
// • Execução diária (pg_cron, 08:00 de Brasília): cabeçalho x-job-secret. Para cada
//   empresa com envio ativo, manda o alerta de cada projeto que chegou a um marco
//   (implantação: 30 dias; contrato: 12, 6 e 3 meses) e, às segundas, os resumos
//   semanais — um de implantação e outro de contrato, cada um só quando tem projetos.
//   Cada envio fica em deadline_alert_deliveries, então ninguém recebe
//   o mesmo aviso duas vezes, mesmo que a função rode de novo.
//   Às segundas também vai o resumo das implantações pendentes (cards filhos abertos há
//   mais de 30 dias), só quando há algum.
//   De segunda a sexta também lembra o D-zero (pagamento do sinal) dos projetos da fase
//   Comercial que ainda não o tiveram confirmado: a cada 2 dias a partir do cadastro.
// • Teste (botão em Configurações): Admin logado; envia aos destinatários da empresa
//   ou, se informado, só para `to`. Teste com `to` usa ALERTS_TEST_FROM quando existe
//   (ex.: onboarding@resend.dev, que entrega só no e-mail da conta do Resend e não
//   exige domínio verificado) — serve para ver o layout antes do DNS ficar pronto.
//
// Segredos: RESEND_API_KEY, ALERTS_FROM ("Nome <endereco@dominio>"), PORTAL_URL,
//           ALERTS_TEST_FROM (opcional).
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { daysBetween, ymd } from "../_shared/deadlineDates.ts";
import {
  renderAlertEmail, renderContratoDigest, renderDzeroReminder, renderImplantacaoDigest, renderPendenciesDigest,
  sampleAlert, sampleDzero, samplePendencies,
  type DeadlineAlert, type DzeroPending, type EmailContext, type PendencyOpen, type RenderedEmail,
} from "../_shared/deadlineEmail.ts";

/** Cards filhos abertos há mais de N dias entram no resumo de segunda-feira. */
const PENDENCY_DIGEST_DAYS = 30;
type PendencyRow = PendencyOpen & { tenant_id: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-job-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const env = (k: string) => Deno.env.get(k) ?? "";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Settings {
  tenant_id: string;
  enabled: boolean;
  recipients: string[];
  include_manager: boolean;
  weekly_digest: boolean;
}
type Row = DeadlineAlert & { tenant_id: string; manager_id: string | null };

/** Hoje em Brasília, YYYY-MM-DD. */
const todaySaoPaulo = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function sendEmail(to: string[], email: RenderedEmail, from?: string): Promise<string> {
  const key = env("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY não configurada no Supabase.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: from || env("ALERTS_FROM") || "Portal de Projetos Transdata <alertas@itstransdata.com>",
      to, subject: email.subject, html: email.html, text: email.text,
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.message ?? `Resend respondeu ${res.status}.`);
  return out?.id ?? "";
}

async function contextFor(db: SupabaseClient, s: Settings, today: string, test = false): Promise<EmailContext> {
  const { data: b } = await db.from("tenant_branding").select("status_labels, team_role_labels").eq("tenant_id", s.tenant_id).maybeSingle();
  const portalUrl = (env("PORTAL_URL") || "https://projetostransdata.vercel.app").replace(/\/+$/, "");
  return {
    today, portalUrl, test,
    logoUrl: env("ALERTS_LOGO_URL") || `${portalUrl}/email/logo-transdata-email.png`,
    recipients: s.recipients, includesManager: s.include_manager,
    statusLabels: b?.status_labels ?? null, roleLabels: b?.team_role_labels ?? null,
  };
}

/** Reserva o envio (índice único impede duplicar), envia e registra o resultado. */
async function deliver(
  db: SupabaseClient,
  key: { tenant_id: string; project_id: string | null; kind: string; milestone: string; due_date: string },
  to: string[], email: RenderedEmail, from?: string,
): Promise<{ status: "enviado" | "erro" | "ja_enviado"; error?: string }> {
  const { data: claim, error } = await db.from("deadline_alert_deliveries")
    .insert({ ...key, recipients: to, subject: email.subject, status: "enviando" }).select("id").single();
  if (error) {
    if (error.code === "23505") return { status: "ja_enviado" };
    throw error;
  }
  try {
    const providerId = await sendEmail(to, email, from);
    await db.from("deadline_alert_deliveries").update({ status: "enviado", provider_id: providerId }).eq("id", claim.id);
    return { status: "enviado" };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 500);
    await db.from("deadline_alert_deliveries").update({ status: "erro", error: msg }).eq("id", claim.id);
    return { status: "erro", error: msg };
  }
}

type DzeroRow = DzeroPending & { tenant_id: string; manager_id: string | null; last_reminder: string | null };

async function managerEmails(db: SupabaseClient, rows: { manager_id: string | null }[]) {
  const ids = [...new Set(rows.map(r => r.manager_id).filter((x): x is string => !!x))];
  if (!ids.length) return new Map<string, string>();
  const { data } = await db.from("team_members").select("id, email").in("id", ids);
  return new Map((data ?? []).filter(m => m.email).map(m => [m.id as string, String(m.email).trim().toLowerCase()]));
}

async function runDaily(db: SupabaseClient, today: string) {
  // registros presos em "enviando" (execução interrompida) liberam o envio para hoje
  await db.from("deadline_alert_deliveries")
    .update({ status: "erro", error: "Execução interrompida antes de confirmar o envio." })
    .eq("status", "enviando").lt("created_at", new Date(Date.now() - 2 * 3_600_000).toISOString());

  const { data: settings, error: sErr } = await db.from("alert_email_settings").select("*").eq("enabled", true);
  if (sErr) throw sErr;
  if (!settings?.length) return { ok: true, today, message: "Nenhuma empresa com envio ativo." };

  const { data: all, error } = await db.rpc("project_deadline_alerts", { _today: today });
  if (error) throw error;
  const summary = { ok: true, today, enviados: 0, erros: 0, ja_enviados: 0, resumos: 0, lembretes_dzero: 0, falhas: [] as string[] };

  for (const s of settings as Settings[]) {
    const rows = ((all ?? []) as Row[]).filter(r => r.tenant_id === s.tenant_id);
    if (!rows.length) continue;
    const ctx = await contextFor(db, s, today);
    const gpEmail = s.include_manager ? await managerEmails(db, rows) : new Map<string, string>();

    for (const r of rows) {
      const extra = s.include_manager && r.manager_id ? gpEmail.get(r.manager_id) : undefined;
      const to = [...new Set([...s.recipients, ...(extra ? [extra] : [])])];
      if (!to.length) continue;
      const res = await deliver(db, { tenant_id: s.tenant_id, project_id: r.project_id, kind: r.kind, milestone: r.milestone, due_date: r.due_date },
        to, renderAlertEmail(r, ctx));
      if (res.status === "enviado") { summary.enviados++; await sleep(600); }
      else if (res.status === "erro") { summary.erros++; summary.falhas.push(`${r.company_name}: ${res.error}`); }
      else summary.ja_enviados++;
    }

    if (s.weekly_digest && ymd(today).getUTCDay() === 1 && s.recipients.length) {
      const digests = [
        { kind: "implantacao", label: "Resumo de implantação", render: renderImplantacaoDigest },
        { kind: "contrato", label: "Resumo de contrato", render: renderContratoDigest },
      ] as const;
      for (const d of digests) {
        if (!rows.some(r => r.kind === d.kind)) continue;
        const res = await deliver(db, { tenant_id: s.tenant_id, project_id: null, kind: "resumo", milestone: d.kind, due_date: today },
          s.recipients, d.render(rows, ctx));
        if (res.status === "enviado") { summary.resumos++; await sleep(600); }
        else if (res.status === "erro") { summary.erros++; summary.falhas.push(`${d.label}: ${res.error}`); }
      }
    }
  }

  // Lembretes de D-zero: um problema aqui não pode impedir os alertas de prazo acima
  try {
    await runDzero(db, settings as Settings[], today, summary);
  } catch (e) {
    summary.erros++;
    summary.falhas.push(`Lembretes de D-zero: ${String((e as Error)?.message ?? e)}`);
  }
  // Resumo de implantações pendentes (cards filhos), às segundas
  try {
    await runPendencies(db, settings as Settings[], today, summary);
  } catch (e) {
    summary.erros++;
    summary.falhas.push(`Implantações pendentes: ${String((e as Error)?.message ?? e)}`);
  }
  return summary;
}

/** Segunda-feira: um resumo por empresa com os cards filhos abertos há mais de 30 dias (só quando há algum). */
async function runPendencies(db: SupabaseClient, settings: Settings[], today: string,
  summary: { resumos: number; erros: number; falhas: string[] }) {
  if (ymd(today).getUTCDay() !== 1) return;
  const { data, error } = await db.rpc("project_pendencies_open", { _today: today });
  if (error) throw error;
  for (const s of settings) {
    if (!s.weekly_digest || !s.recipients.length) continue;
    const rows = ((data ?? []) as PendencyRow[]).filter(r => r.tenant_id === s.tenant_id && r.days_open > PENDENCY_DIGEST_DAYS);
    if (!rows.length) continue;
    const ctx = await contextFor(db, s, today);
    const res = await deliver(db, { tenant_id: s.tenant_id, project_id: null, kind: "resumo", milestone: "pendencias", due_date: today },
      s.recipients, renderPendenciesDigest(rows, ctx, PENDENCY_DIGEST_DAYS));
    if (res.status === "enviado") { summary.resumos++; await sleep(600); }
    else if (res.status === "erro") { summary.erros++; summary.falhas.push(`Implantações pendentes: ${res.error}`); }
  }
}

/** De segunda a sexta: lembra cada projeto que aguarda o D-zero, a cada 2 dias desde o cadastro ou o último lembrete. */
async function runDzero(db: SupabaseClient, settings: Settings[], today: string,
  summary: { lembretes_dzero: number; erros: number; falhas: string[] }) {
  const weekday = ymd(today).getUTCDay();
  if (weekday === 0 || weekday === 6) return;
  const { data, error } = await db.rpc("project_dzero_pending", { _today: today });
  if (error) throw error;
  for (const s of settings) {
    const rows = ((data ?? []) as DzeroRow[])
      .filter(r => r.tenant_id === s.tenant_id && (!r.last_reminder || daysBetween(r.last_reminder, today) >= 2));
    if (!rows.length) continue;
    const ctx = await contextFor(db, s, today);
    const gpEmail = s.include_manager ? await managerEmails(db, rows) : new Map<string, string>();
    for (const r of rows) {
      const extra = s.include_manager && r.manager_id ? gpEmail.get(r.manager_id) : undefined;
      const to = [...new Set([...s.recipients, ...(extra ? [extra] : [])])];
      if (!to.length) continue;
      const res = await deliver(db, { tenant_id: s.tenant_id, project_id: r.project_id, kind: "dzero", milestone: "lembrete", due_date: today },
        to, renderDzeroReminder(r, ctx));
      if (res.status === "enviado") { summary.lembretes_dzero++; await sleep(600); }
      else if (res.status === "erro") { summary.erros++; summary.falhas.push(`D-zero ${r.company_name}: ${res.error}`); }
    }
  }
}

const EMAIL_RE = /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[a-z]{2,}$/i;

async function sendTest(db: SupabaseClient, tenantId: string, today: string, kind: string, toOverride?: string) {
  const override = toOverride?.trim().toLowerCase() || "";
  if (override && (override.length > 254 || !EMAIL_RE.test(override))) return json({ error: "E-mail do teste inválido." }, 400);
  const { data: s } = await db.from("alert_email_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (!s) return json({ error: "Salve a configuração de e-mails antes de testar." }, 400);
  const settings = s as Settings;
  const to = override ? [override] : settings.recipients ?? [];
  if (!to.length) return json({ error: "Cadastre ao menos um destinatário ou informe para quem enviar o teste." }, 400);
  const from = override ? env("ALERTS_TEST_FROM") || undefined : undefined;
  const ctx = await contextFor(db, settings, today, true);
  let email: RenderedEmail;
  if (kind === "dzero") {
    const { data: pend, error: dErr } = await db.rpc("project_dzero_pending", { _today: today });
    if (dErr) throw dErr;
    const first = ((pend ?? []) as DzeroRow[]).find(r => r.tenant_id === tenantId);
    email = renderDzeroReminder(first ?? sampleDzero(today), ctx);
  } else if (kind === "pendencias") {
    const { data: pend, error: pErr } = await db.rpc("project_pendencies_open", { _today: today });
    if (pErr) throw pErr;
    const rows = ((pend ?? []) as PendencyRow[]).filter(r => r.tenant_id === tenantId && r.days_open > PENDENCY_DIGEST_DAYS);
    email = renderPendenciesDigest(rows.length ? rows : samplePendencies(today), ctx, PENDENCY_DIGEST_DAYS);
  } else {
    const { data: all, error } = await db.rpc("project_deadline_alerts", { _today: today });
    if (error) throw error;
    const rows = ((all ?? []) as Row[]).filter(r => r.tenant_id === tenantId);
    email = kind === "implantacao" || kind === "contrato"
      ? renderAlertEmail(rows.find(r => r.kind === kind) ?? sampleAlert(kind, today), ctx)
      : kind === "resumo_contrato"
        ? renderContratoDigest(rows, ctx)
        : renderImplantacaoDigest(rows, ctx);
  }
  const res = await deliver(db, { tenant_id: tenantId, project_id: null, kind: "teste", milestone: "teste", due_date: today },
    to, email, from);
  if (res.status !== "enviado") return json({ error: res.error ?? "Não foi possível enviar." }, 502);
  return json({ ok: true, to, subject: email.subject });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({})) as { mode?: string; kind?: string; tenant_id?: string; to?: string };
  const today = todaySaoPaulo();

  try {
    // Execução agendada
    const jobSecret = req.headers.get("x-job-secret");
    if (jobSecret) {
      const { data: ok } = await db.rpc("verify_job_secret", { _name: "deadline-alerts", _secret: jobSecret });
      if (!ok) return json({ error: "Forbidden" }, 403);
      return json(await runDaily(db, today));
    }

    // Teste disparado por um Admin logado
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: cErr } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", userId);
    const set = new Set((roles ?? []).map((r: { role: string }) => r.role));
    if (!set.has("admin") && !set.has("super_admin")) return json({ error: "Apenas administradores podem enviar o teste." }, 403);
    if (body.mode !== "test") return json({ error: "Modo inválido." }, 400);

    const { data: profile } = await db.from("profiles").select("tenant_id").eq("user_id", userId).maybeSingle();
    const tenantId = set.has("super_admin") && body.tenant_id ? body.tenant_id : profile?.tenant_id;
    if (!tenantId) return json({ error: "Usuário sem empresa vinculada." }, 400);
    return await sendTest(db, tenantId, today, body.kind ?? "resumo_implantacao", typeof body.to === "string" ? body.to : undefined);
  } catch (e) {
    console.error("deadline-alerts", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
