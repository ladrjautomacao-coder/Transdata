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

/** Status escondidos da lista padrão de projetos elegíveis. A busca ignora
 *  este filtro e procura na base inteira, para permitir visita extra em
 *  projeto já implementado. */
export const HIDDEN_BY_DEFAULT_STATUSES: readonly string[] = ["encerrado"];

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
  /** URL pública da foto (bucket technician-photos); sem foto, o avatar mostra as iniciais. */
  photo_url?: string | null;
  /** Preenchido quando o técnico foi removido do cadastro (só vem nos membros das visitas). */
  removed_at?: string | null;
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
  /** Formato do treinamento informado pelo GP (nulo em solicitações antigas). */
  visit_format?: VisitFormat | null;
  address_street?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  meeting_url?: string | null;
  notes: string | null;
  status: RequestStatus;
  approved_start: string | null;
  approved_end: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  /** Como a visita foi realizada (registrado pelo Aprovador). */
  attendance: Attendance | null;
  attendance_note: string | null;
  attended_by_name: string | null;
  attended_at: string | null;
  /** Motivo quando uma visita aprovada é cancelada. */
  cancel_reason: string | null;
  created_at: string;
  project: { id: string; company_name: string; project_code: string | null; city: string; state: string | null; country_code: string | null; manager: { full_name: string } | null } | null;
  members: { technician: Technician | null }[];
}

export type Attendance = "presencial" | "remoto";
export const ATTENDANCE_LABEL: Record<Attendance, string> = { presencial: "Atendida presencial", remoto: "Atendida remota" };

export type VisitFormat = "presencial" | "remoto";
export const VISIT_FORMAT_LABEL: Record<VisitFormat, string> = { presencial: "Presencial", remoto: "Remoto" };

/** Turnos do treinamento remoto (horário local). */
export type RemotePeriod = "manha" | "tarde";
export const REMOTE_PERIODS: Record<RemotePeriod, { label: string; hours: string; from: number; to: number }> = {
  manha: { label: "Manhã", hours: "09h às 12h", from: 9, to: 12 },
  tarde: { label: "Tarde", hours: "14h às 17h", from: 14, to: 17 },
};

/** Turno pelo horário (09h–12h ou 14h–17h); null se for outro horário. */
export function remotePeriodOf(start: Date, end: Date): RemotePeriod | null {
  const at = (d: Date, h: number) => d.getHours() === h && d.getMinutes() === 0;
  return (Object.keys(REMOTE_PERIODS) as RemotePeriod[]).find(k => at(start, REMOTE_PERIODS[k].from) && at(end, REMOTE_PERIODS[k].to)) ?? null;
}

/** "Manhã, 09h às 12h" de uma visita remota num dos turnos; null nos demais casos. */
export function remotePeriodText(format: VisitFormat | null | undefined, start: Date, end: Date) {
  const p = format === "remoto" ? remotePeriodOf(start, end) : null;
  return p ? `${REMOTE_PERIODS[p].label}, ${REMOTE_PERIODS[p].hours}` : null;
}

/** "Presencial", "Remoto" ou "Remoto · Manhã, 09h às 12h". */
export function visitFormatText(format: VisitFormat | null | undefined, start: Date, end: Date) {
  if (!format) return null;
  const turn = remotePeriodText(format, start, end);
  return turn ? `${VISIT_FORMAT_LABEL[format]} · ${turn}` : VISIT_FORMAT_LABEL[format];
}

type AddressParts = { address_street?: string | null; address_district?: string | null; address_city?: string | null; address_state?: string | null };
/** "Rua X, 100, Centro, Tubarão/SC" a partir do endereço informado na solicitação. */
export function formatAddress(a: AddressParts) {
  const cityUf = [a.address_city?.trim(), a.address_state?.trim()].filter(Boolean).join("/");
  return [a.address_street?.trim(), a.address_district?.trim(), cityUf].filter(Boolean).join(", ");
}

/** O que define para onde o técnico vai (serve para solicitação e para visita da Área do Implantador). */
export type DestinationParts = AddressParts & {
  visit_format?: VisitFormat | null;
  meeting_url?: string | null;
  location: string | null;
  project: { city: string; state: string | null; country_code: string | null } | null;
};

/** Google Maps do local da visita: endereço informado, senão o local livre, senão a cidade do projeto. */
export function mapsUrlFor(v: DestinationParts) {
  const q = (v.visit_format === "presencial" && formatAddress(v))
    || v.location?.trim()
    || (v.project ? [v.project.city, v.project.state].filter(Boolean).join("/") : "");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Link da reunião normalizado ("meet.google.com/x" vira "https://meet.google.com/x"); null se não for um link válido. */
export function normalizeMeetingUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") ? u.href : null;
  } catch { return null; }
}

export interface HistoryEntry {
  id: string;
  action: "criada" | "aprovada" | "reprovada" | "cancelada" | "periodo_alterado" | "atendida";
  actor_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const REQUEST_COLS =
  "id, project_id, requested_by, requester_name, visit_purpose, visit_purpose_is_custom, requested_start, requested_end, location, " +
  "visit_format, address_street, address_district, address_city, address_state, meeting_url, notes, status, approved_start, approved_end, reviewer_name, reviewed_at, rejection_reason, attendance, attendance_note, attended_by_name, attended_at, cancel_reason, created_at, " +
  "project:projects(id, company_name, project_code, city, state, country_code, manager:team_members!projects_manager_id_fkey(full_name)), " +
  "members:implantation_request_members(technician:implantation_technicians(id, full_name, email, area, active, photo_url, removed_at))";
const TECH_COLS = "id, full_name, email, area, active, photo_url";

/** Período efetivo: o aprovado, se houver; senão o solicitado. */
export const periodOf = (r: ImplantationRequest) => ({
  start: new Date(r.approved_start ?? r.requested_start),
  end: new Date(r.approved_end ?? r.requested_end),
});

/** Link do Calendário já posicionado na data da visita e com ela destacada. */
export function calendarLinkFor(r: ImplantationRequest) {
  const d = periodOf(r).start;
  const p = (n: number) => String(n).padStart(2, "0");
  return `/implantacao/calendario?data=${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}&destaque=${r.id}`;
}

export const techniciansOf = (r: ImplantationRequest) =>
  r.members.map(m => m.technician).filter((t): t is Technician => !!t);

export async function fetchRequests(): Promise<ImplantationRequest[]> {
  const { data, error } = await db.from("implantation_requests").select(REQUEST_COLS).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImplantationRequest[];
}

/** Todas as solicitações/visitas de um projeto (linha do tempo do projeto). */
export async function fetchProjectRequests(projectId: string): Promise<ImplantationRequest[]> {
  const { data, error } = await db.from("implantation_requests").select(REQUEST_COLS)
    .eq("project_id", projectId).order("requested_start", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ImplantationRequest[];
}

export async function fetchTechnicians(includeInactive = false): Promise<Technician[]> {
  let q = db.from("implantation_technicians").select(TECH_COLS).is("removed_at", null).order("full_name");
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
  visit_format: VisitFormat; address_street: string | null; address_district: string | null;
  address_city: string | null; address_state: string | null; meeting_url: string | null;
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

/** Aprovador registra como a visita foi realizada. */
export async function registerAttendance(id: string, mode: Attendance, note: string) {
  const { error } = await db.rpc("register_implantation_attendance", { _request_id: id, _mode: mode, _note: note || null });
  if (error) throw error;
}

/** Aprovador cancela uma visita já aprovada (motivo obrigatório). */
export async function cancelApprovedRequest(id: string, reason: string) {
  const { error } = await db.rpc("cancel_approved_implantation_request", { _request_id: id, _reason: reason });
  if (error) throw error;
}

/* ─── Área do Implantador ─── */
export interface AgendaVisit {
  id: string;
  status: "aprovada" | "cancelada";
  start: string;
  end: string;
  visit_purpose: string;
  location: string | null;
  visit_format?: VisitFormat | null;
  address_street?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  meeting_url?: string | null;
  notes: string | null;
  requester_name: string | null;
  reviewer_name: string | null;
  attendance: Attendance | null;
  attendance_note: string | null;
  attended_by_name: string | null;
  attended_at: string | null;
  cancel_reason: string | null;
  project: { id: string; company_name: string; project_code: string | null; city: string; state: string | null; country_code: string | null; status: string; manager_name: string | null };
  colleagues: { id: string; full_name: string; photo_url?: string | null }[];
}
export interface TechnicianAgenda {
  technician: { id: string; full_name: string; area: string | null; email: string | null; photo_url?: string | null } | null;
  visits: AgendaVisit[];
}

/** Agenda do técnico logado (sem id) ou de outro técnico (aprovador/admin). */
export async function fetchTechnicianAgenda(technicianId?: string | null): Promise<TechnicianAgenda> {
  const { data, error } = await db.rpc("get_implantation_agenda", { _technician_id: technicianId ?? null });
  if (error) throw error;
  return (data ?? { technician: null, visits: [] }) as TechnicianAgenda;
}

export async function saveTechnician(input: { id?: string; full_name: string; email: string | null; area: string | null; active?: boolean; photo_url?: string | null }): Promise<Technician> {
  const { id, ...rest } = input;
  const { data, error } = id
    ? await db.from("implantation_technicians").update(rest).eq("id", id).select(TECH_COLS).single()
    : await db.from("implantation_technicians").insert(rest).select(TECH_COLS).single();
  if (error) throw error;
  return data as Technician;
}

/* ─── Foto do técnico ─── */
const PHOTO_BUCKET = "technician-photos";
const PHOTO_SIZE = 400;
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

/** Recorta em quadrado (no retrato, puxando para cima, onde fica o rosto) e reduz para 400×400 JPEG. */
async function squarePhoto(file: File): Promise<Blob> {
  let img: ImageBitmap;
  try { img = await createImageBitmap(file); }
  catch { throw new Error("Não foi possível ler a imagem. Use uma foto JPG, PNG ou WebP."); }
  const side = Math.min(img.width, img.height);
  const out = Math.min(PHOTO_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) { img.close(); throw new Error("O navegador não conseguiu processar a imagem."); }
  ctx.fillStyle = "#fff"; // PNG com transparência vira fundo branco no JPEG
  ctx.fillRect(0, 0, out, out);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) * 0.25, side, side, 0, 0, out, out);
  img.close();
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("O navegador não conseguiu processar a imagem.");
  return blob;
}

/** Validação rápida antes de processar (tipo e tamanho do arquivo escolhido). */
export function photoFileProblem(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Escolha um arquivo de imagem (JPG, PNG ou WebP).";
  if (file.size > PHOTO_MAX_BYTES) return "A imagem passa de 15 MB. Escolha uma menor.";
  return null;
}

async function deletePhotoFile(url: string | null | undefined) {
  const path = url?.split(`/${PHOTO_BUCKET}/`)[1]?.split("?")[0];
  if (path) await supabase.storage.from(PHOTO_BUCKET).remove([decodeURIComponent(path)]);
}

/** Envia (ou troca) a foto do técnico e apaga o arquivo anterior. */
export async function uploadTechnicianPhoto(tech: Technician, file: File): Promise<Technician> {
  const problem = photoFileProblem(file);
  if (problem) throw new Error(problem);
  const blob = await squarePhoto(file);
  const path = `${tech.id}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (upErr) throw upErr;
  const photo_url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  const { data, error } = await db.from("implantation_technicians").update({ photo_url }).eq("id", tech.id).select(TECH_COLS).single();
  if (error) { await supabase.storage.from(PHOTO_BUCKET).remove([path]); throw error; }
  await deletePhotoFile(tech.photo_url);
  return data as Technician;
}

/** Tira a foto do técnico (volta a mostrar as iniciais). */
export async function removeTechnicianPhoto(tech: Technician): Promise<Technician> {
  const { data, error } = await db.from("implantation_technicians").update({ photo_url: null }).eq("id", tech.id).select(TECH_COLS).single();
  if (error) throw error;
  await deletePhotoFile(tech.photo_url);
  return data as Technician;
}

/** Quantas visitas (solicitações) têm o técnico alocado — define se ele pode ser apagado de vez. */
export async function countTechnicianVisits(id: string): Promise<number> {
  const { count, error } = await db.from("implantation_request_members").select("technician_id", { count: "exact", head: true }).eq("technician_id", id);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Remove o técnico do cadastro. Sem visitas: exclui. Com visitas: marca como removido
 * (some do cadastro e das listas, mas o nome continua no histórico das visitas).
 */
export async function removeTechnician(id: string, photoUrl?: string | null): Promise<"excluido" | "arquivado"> {
  if (await countTechnicianVisits(id) === 0) {
    // apaga a foto antes: depois de excluído o técnico, a policy do bucket não acha mais o dono do arquivo
    await deletePhotoFile(photoUrl);
    const { error } = await db.from("implantation_technicians").delete().eq("id", id);
    if (error) throw error;
    return "excluido";
  }
  const { error } = await db.from("implantation_technicians").update({ active: false, removed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  return "arquivado";
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
