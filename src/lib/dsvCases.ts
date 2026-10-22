// Casos DSV: tickets abertos no suporte técnico ou no desenvolvimento (Azure DevOps)
// para um projeto. Cada caso guarda a fase do projeto na abertura, para a métrica de
// "casos abertos por projeto ainda em implantação".
// A tabela ainda não está em src/integrations/supabase/types.ts (client como `any`,
// no mesmo padrão de projectPendencies.ts).
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type DsvKind = "suporte" | "desenvolvimento";
export type DsvStatus = "aberto" | "resolvido";

export const DSV_KINDS: { value: DsvKind; label: string; hint: string }[] = [
  { value: "suporte", label: "Suporte técnico", hint: "Falha, erro ou dúvida em operação" },
  { value: "desenvolvimento", label: "Desenvolvimento", hint: "Ajuste, melhoria ou correção no produto" },
];
export const DSV_KIND_LABEL = Object.fromEntries(DSV_KINDS.map(k => [k.value, k.label])) as Record<DsvKind, string>;

export interface DsvCase {
  id: string;
  project_id: string;
  url: string;
  /** Nº do item no Azure DevOps, tirado do link (nulo se o link não traz). */
  azure_id: number | null;
  kind: DsvKind;
  title: string;
  status: DsvStatus;
  /** Fase e etapa do projeto quando o caso foi aberto (métrica). */
  project_status_at_open: string | null;
  project_sub_phase_at_open: string | null;
  created_by_name: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by_name: string | null;
}

const COLS = "id, project_id, url, azure_id, kind, title, status, project_status_at_open, project_sub_phase_at_open, created_by_name, created_at, resolved_at, resolved_by_name";

/**
 * Lê o link colado: normaliza (sem espaços, com https), diz se é do Azure DevOps
 * (dev.azure.com ou *.visualstudio.com) e tira o nº do item (`/_workitems/edit/123`
 * ou `?workitem=123`). `url` nulo = link inválido.
 */
export function parseAzureLink(raw: string): { url: string | null; isAzure: boolean; azureId: number | null } {
  const v = raw.trim();
  if (!v || /\s/.test(v)) return { url: null, isAzure: false, azureId: null };
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  let u: URL;
  try { u = new URL(withScheme); } catch { return { url: null, isAzure: false, azureId: null }; }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.includes(".")) return { url: null, isAzure: false, azureId: null };
  const host = u.hostname.toLowerCase();
  const isAzure = host === "dev.azure.com" || host.endsWith(".visualstudio.com");
  const m = /\/_workitems\/edit\/(\d+)/i.exec(u.pathname) ?? /^(\d+)$/.exec(u.searchParams.get("workitem") ?? "");
  const azureId = m ? Number(m[1]) : null;
  return { url: u.href, isAzure, azureId: azureId && Number.isSafeInteger(azureId) ? azureId : null };
}

/** Casos de um projeto: abertos primeiro, depois os resolvidos (mais recentes primeiro). */
export async function fetchProjectDsvCases(projectId: string): Promise<DsvCase[]> {
  const { data, error } = await db.from("project_dsv_cases").select(COLS).eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) throw error;
  const list = (data ?? []) as DsvCase[];
  return [...list.filter(c => c.status === "aberto"), ...list.filter(c => c.status !== "aberto")];
}

export type DsvSummary = Map<string, { open: number; total: number }>;

/** Quantos casos (abertos e no total) cada projeto tem — botão do Kanban. */
export function summarize(list: { project_id: string; status: DsvStatus }[]): DsvSummary {
  const map: DsvSummary = new Map();
  for (const c of list) {
    const s = map.get(c.project_id) ?? { open: 0, total: 0 };
    s.total++;
    if (c.status === "aberto") s.open++;
    map.set(c.project_id, s);
  }
  return map;
}

export async function fetchDsvSummary(): Promise<DsvSummary> {
  const { data, error } = await db.from("project_dsv_cases").select("project_id, status");
  if (error) throw error;
  return summarize((data ?? []) as { project_id: string; status: DsvStatus }[]);
}

export async function createDsvCase(input: { project_id: string; url: string; azure_id: number | null; kind: DsvKind; title: string }) {
  const { error } = await db.from("project_dsv_cases").insert(input);
  if (error) {
    if (error.code === "23505") throw new Error("Este caso já está registrado neste projeto.");
    throw error;
  }
}

export async function resolveDsvCase(id: string) {
  const { error } = await db.from("project_dsv_cases").update({ status: "resolvido" }).eq("id", id);
  if (error) throw error;
}

/** Marcado como resolvido por engano: volta a ficar aberto. */
export async function reopenDsvCase(id: string) {
  const { error } = await db.from("project_dsv_cases").update({ status: "aberto" }).eq("id", id);
  if (error) throw error;
}

/** Caso lançado por engano. */
export async function deleteDsvCase(id: string) {
  const { data, error } = await db.from("project_dsv_cases").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Só o GP do projeto ou um administrador pode excluir o caso.");
}

/** "2 abertos", "1 aberto", "3 resolvidos". */
export function dsvCountLabel(s: { open: number; total: number }) {
  if (s.open > 0) return `${s.open} aberto${s.open === 1 ? "" : "s"}`;
  return `${s.total} resolvido${s.total === 1 ? "" : "s"}`;
}
