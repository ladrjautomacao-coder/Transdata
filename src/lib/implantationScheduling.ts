// Agenda de Implantação — tipos, constantes e acesso a dados.
// Fase de desenvolvimento: só super_admin enxerga (rota, menu e RLS).
// As tabelas ainda não estão em src/integrations/supabase/types.ts, por isso
// o client é usado como `any` aqui, no mesmo padrão de CronogramaTab.
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Objetivos pré-definidos. O GP também pode digitar um nome livre ("Outro"). */
export const VISIT_PURPOSE_PRESETS = [
  "Projeto Executivo",
  "1ª Visita - Bilhetagem",
  "2ª Visita - Bilhetagem",
  "3ª Visita - Bilhetagem",
  "1ª Visita - ITS / Gestão de Frotas",
  "2ª Visita - ITS / Gestão de Frotas",
  "3ª Visita - ITS / Gestão de Frotas",
] as const;

export const VISIT_PURPOSE_GROUPS: { label: string | null; items: string[] }[] = [
  { label: null, items: ["Projeto Executivo"] },
  { label: "Bilhetagem", items: VISIT_PURPOSE_PRESETS.slice(1, 4) as unknown as string[] },
  { label: "ITS / Gestão de Frotas", items: VISIT_PURPOSE_PRESETS.slice(4) as unknown as string[] },
];

/** Status do projeto em que o GP pode solicitar visita. */
export const ELIGIBLE_PROJECT_STATUSES = ["planejamento", "implantacao"] as const;

export type RequestStatus = "pendente" | "aprovada" | "reprovada" | "cancelada";

export const REQUEST_STATUS: Record<RequestStatus, { label: string; pill: string; dot: string; border: string }> = {
  pendente: { label: "Pendente", pill: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dot: "bg-amber-500", border: "border-l-amber-400" },
  aprovada: { label: "Aprovada", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", border: "border-l-emerald-500" },
  reprovada: { label: "Reprovada", pill: "bg-red-500/15 text-red-700 dark:text-red-300", dot: "bg-red-500", border: "border-l-red-500" },
  cancelada: { label: "Cancelada", pill: "bg-muted text-muted-foreground line-through", dot: "bg-muted-foreground/50", border: "border-l-muted-foreground/40" },
};

export interface Technician {
  id: string;
  full_name: string;
  email: string | null;
  area: string | null;
  active: boolean;
}

export interface EligibleProject {
  id: string;
  company_name: string;
  project_code: string | null;
  city: string;
  state: string | null;
  country_code: string | null;
  status: string;
  sub_phase: string | null;
  manager_id: string | null;
  manager: { full_name: string } | null;
}

export interface ImplantationRequest {
  id: string;
  project_id: string;
  requested_by: string | null;
  requester_name: string | null;
  visit_purpose: string;
  visit_purpose_is_custom: boolean;
  requested_start: string;
  requested_end: string;
  location: string | null;
  notes: string | null;
  status: RequestStatus;
  approved_start: string | null;
  approved_end: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  project: { id: string; company_name: string; project_code: string | null; city: string; state: string | null; country_code: string | null; manager: { full_name: string } | null } | null;
  members: { technician: Technician | null }[];
}

export interface HistoryEntry {
  id: string;
  action: "criada" | "aprovada" | "reprovada" | "cancelada" | "periodo_alterado";
  actor_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const REQUEST_COLS =
  "id, project_id, requested_by, requester_name, visit_purpose, visit_purpose_is_custom, requested_start, requested_end, location, notes, status, approved_start, approved_end, reviewer_name, reviewed_at, rejection_reason, created_at, " +
  "project:projects(id, company_name, project_code, city, state, country_code, manager:team_members!projects_manager_id_fkey(full_name)), " +
  "members:implantation_request_members(technician:implantation_technicians(id, full_name, email, area, active))";

/** Período efetivo: o aprovado, se houver; senão o solicitado. */
export const periodOf = (r: ImplantationRequest) => ({
  start: new Date(r.approved_start ?? r.requested_start),
  end: new Date(r.approved_end ?? r.requested_end),
});

export const techniciansOf = (r: ImplantationRequest) =>
  r.members.map(m => m.technician).filter((t): t is Technician => !!t);

export async function fetchRequests(): Promise<ImplantationRequest[]> {
  const { data, error } = await db.from("implantation_requests").select(REQUEST_COLS).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImplantationRequest[];
}

export async function fetchTechnicians(includeInactive = false): Promise<Technician[]> {
  let q = db.from("implantation_technicians").select("id, full_name, email, area, active").order("full_name");
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Technician[];
}

export async function fetchHistory(requestId: string): Promise<HistoryEntry[]> {
  const { data, error } = await db.from("implantation_request_history")
    .select("id, action, actor_name, details, created_at").eq("request_id", requestId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HistoryEntry[];
}

export async function createRequest(input: {
  project_id: string; visit_purpose: string; visit_purpose_is_custom: boolean;
  requested_start: string; requested_end: string; location: string | null; notes: string | null;
}) {
  const { error } = await db.from("implantation_requests").insert(input);
  if (error) throw error;
}

export async function approveRequest(id: string, start: Date, end: Date, technicianIds: string[]) {
  const { error } = await db.rpc("approve_implantation_request", {
    _request_id: id, _start: start.toISOString(), _end: end.toISOString(), _technician_ids: technicianIds,
  });
  if (error) throw error;
}

export async function rejectRequest(id: string, reason: string) {
  const { error } = await db.rpc("reject_implantation_request", { _request_id: id, _reason: reason });
  if (error) throw error;
}

export async function cancelRequest(id: string) {
  const { error } = await db.rpc("cancel_implantation_request", { _request_id: id });
  if (error) throw error;
}

export async function saveTechnician(input: { id?: string; full_name: string; email: string | null; area: string | null; active?: boolean }) {
  const { id, ...rest } = input;
  const { error } = id
    ? await db.from("implantation_technicians").update(rest).eq("id", id)
    : await db.from("implantation_technicians").insert(rest);
  if (error) throw error;
}

/** Conflitos de um técnico com agendamentos aprovados (exceto a própria solicitação). */
export function conflictsFor(techId: string, start: Date, end: Date, requests: ImplantationRequest[], ignoreId?: string) {
  return requests.filter(r =>
    r.id !== ignoreId && r.status === "aprovada" &&
    techniciansOf(r).some(t => t.id === techId) &&
    start < periodOf(r).end && periodOf(r).start < end);
}

/** Mensagem amigável para erros do Supabase/Postgres. */
export function errorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Sem conexão com o servidor. Tente novamente.";
  return msg;
}

/** Cor estável por projeto, para as barras do calendário. */
const PALETTE = ["#7c3aed", "#0284c7", "#059669", "#d97706", "#e11d48", "#4f46e5", "#0d9488", "#c026d3"];
export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("");

/** "dd/MM HH:mm → dd/MM HH:mm" ou "dd/MM · HH:mm–HH:mm" no mesmo dia. */
export function formatPeriod(start: Date, end: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  const d = (x: Date) => `${p(x.getDate())}/${p(x.getMonth() + 1)}`;
  const t = (x: Date) => `${p(x.getHours())}:${p(x.getMinutes())}`;
  return start.toDateString() === end.toDateString() ? `${d(start)} · ${t(start)}–${t(end)}` : `${d(start)} ${t(start)} → ${d(end)} ${t(end)}`;
}

/** Date -> valor de <input type="datetime-local"> (horário local). */
export function toLocalInput(dt: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
