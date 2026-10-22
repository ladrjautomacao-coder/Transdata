// Implantação pendente ("card filho"): solução contratada que o cliente deixou para
// depois. O projeto pai pode ir para Implementado; a pendência segue visível na coluna
// "Implantação pendente" do Kanban até ser implantada ou cancelada.
// A tabela ainda não está em src/integrations/supabase/types.ts (client como `any`,
// no mesmo padrão de implantationScheduling.ts).
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type PendencyStatus = "aberta" | "implantada" | "cancelada";
export type PendencyReason = "decisao_cliente" | "infraestrutura_cliente" | "terceiros" | "outro";

export const PENDENCY_REASONS: { value: PendencyReason; label: string; hint: string }[] = [
  { value: "decisao_cliente", label: "Decisão do cliente", hint: "O cliente optou por ativar depois" },
  { value: "infraestrutura_cliente", label: "Infraestrutura do cliente", hint: "Falta rede, energia, equipamento…" },
  { value: "terceiros", label: "Aguardando terceiros", hint: "Fornecedor, prefeitura, órgão…" },
  { value: "outro", label: "Outro motivo", hint: "Descreva no detalhe" },
];
export const PENDENCY_REASON_LABEL = Object.fromEntries(PENDENCY_REASONS.map(r => [r.value, r.label])) as Record<PendencyReason, string>;

export const PENDENCY_STATUS_LABEL: Record<PendencyStatus, string> = {
  aberta: "Pendente", implantada: "Implantada", cancelada: "Cliente desistiu",
};

export interface ProjectPendency {
  id: string;
  project_id: string;
  solution_id: string | null;
  /** Nome da solução pendente ou do item livre. */
  title: string;
  reason_kind: PendencyReason;
  reason: string | null;
  /** Previsão de retomada informada pelo GP (AAAA-MM-DD). */
  expected_date: string | null;
  status: PendencyStatus;
  created_by_name: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolution_note: string | null;
}

const COLS = "id, project_id, solution_id, title, reason_kind, reason, expected_date, status, created_by_name, created_at, resolved_at, resolved_by_name, resolution_note";

/** Pendências em aberto (as que o usuário pode ver, pela RLS do projeto). */
export async function fetchOpenPendencies(): Promise<ProjectPendency[]> {
  const { data, error } = await db.from("project_pendencies").select(COLS).eq("status", "aberta").order("created_at");
  if (error) throw error;
  return (data ?? []) as ProjectPendency[];
}

/** Todos os cards filhos do quadro: abertos, implantados e cancelados. */
export async function fetchBoardPendencies(): Promise<ProjectPendency[]> {
  const { data, error } = await db.from("project_pendencies").select(COLS).order("created_at");
  if (error) throw error;
  return (data ?? []) as ProjectPendency[];
}

/**
 * Onde cada card filho aparece no Kanban: aberto em "Implantação pendente", implantado em
 * "Implementado" e cancelado (cliente desistiu) em "Outros › Cancelado". Os concluídos vêm
 * do mais recente para o mais antigo. Nenhum deles conta como projeto.
 */
export function splitByStatus(list: ProjectPendency[]) {
  const recent = (a: ProjectPendency, b: ProjectPendency) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? "");
  return {
    open: list.filter(p => p.status === "aberta"),
    done: list.filter(p => p.status === "implantada").sort(recent),
    cancelled: list.filter(p => p.status === "cancelada").sort(recent),
  };
}

export const childCardsLabel = (n: number) => `+${n} ${n === 1 ? "card filho" : "cards filhos"}`;

/** Todas as pendências de um projeto (abertas primeiro, depois o histórico). */
export async function fetchProjectPendencies(projectId: string): Promise<ProjectPendency[]> {
  const { data, error } = await db.from("project_pendencies").select(COLS).eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) throw error;
  const list = (data ?? []) as ProjectPendency[];
  return [...list.filter(p => p.status === "aberta"), ...list.filter(p => p.status !== "aberta")];
}

export async function createPendency(input: {
  project_id: string; solution_id: string | null; title: string; reason_kind: PendencyReason; reason: string | null; expected_date: string | null;
}) {
  const { error } = await db.from("project_pendencies").insert(input);
  if (error) {
    if (error.code === "23505") throw new Error("Já existe um card filho em aberto para este item neste projeto.");
    throw error;
  }
}

/** Solução ativada pelo cliente: a pendência sai da coluna e fica no histórico do projeto. */
export async function resolvePendency(id: string, note: string) {
  const { error } = await db.from("project_pendencies").update({ status: "implantada", resolution_note: note.trim() || null }).eq("id", id);
  if (error) throw error;
}

/** Cliente desistiu da solução: a pendência é cancelada (com motivo) e fica no histórico. */
export async function cancelPendency(id: string, reason: string) {
  const { error } = await db.from("project_pendencies").update({ status: "cancelada", resolution_note: reason.trim() }).eq("id", id);
  if (error) throw error;
}

/** Uma linha de public.project_pendencies_open() (sino e resumo por e-mail). */
export interface PendencyAlertRow {
  pendency_id: string;
  project_id: string;
  company_name: string;
  city: string | null;
  state: string | null;
  /** Status do projeto pai (em "implantacao", falta mover para Implementado). */
  status: string;
  manager_id: string | null;
  manager_name: string | null;
  title: string;
  days_open: number;
}

export async function fetchPendencyAlerts(): Promise<PendencyAlertRow[]> {
  const { data, error } = await db.rpc("project_pendencies_open");
  if (error) throw error;
  return (data ?? []) as PendencyAlertRow[];
}

/** Depois de quantos dias o card filho aberto vira lembrete (sino e e-mail). */
export const PENDENCY_REMINDER_DAYS = 30;

export type PendencyAgeLevel = "ok" | "warn" | "late";
/** Há quantos dias está pendente e a faixa de cor: até 30 dias, até 60, mais de 60. */
export function pendencyAge(createdAt: string, now = new Date()): { days: number; level: PendencyAgeLevel } {
  const start = new Date(createdAt);
  const d0 = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const d1 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.round((d1 - d0) / 86_400_000));
  return { days, level: days > 60 ? "late" : days > 30 ? "warn" : "ok" };
}
export const PENDENCY_AGE_STYLE: Record<PendencyAgeLevel, string> = {
  ok: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  warn: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  late: "bg-red-500/15 text-red-700 dark:text-red-300",
};

/** Quantas pendências abertas cada projeto tem (selo no card pai). */
export function countByProject(list: ProjectPendency[]) {
  const map = new Map<string, number>();
  for (const p of list) if (p.status === "aberta") map.set(p.project_id, (map.get(p.project_id) ?? 0) + 1);
  return map;
}

/** Só as pendências cujos projetos pais passaram nos filtros do quadro. */
export function pendenciesOfProjects(list: ProjectPendency[], projectIds: Set<string>) {
  return list.filter(p => projectIds.has(p.project_id));
}

export const pendencyLabel = (n: number) => `${n} pendência${n === 1 ? "" : "s"}`;
