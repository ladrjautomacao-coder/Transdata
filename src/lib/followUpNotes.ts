import { differenceInDays } from "date-fns";

export interface FollowUpNote {
  raw: string;
  author: string | null;
  date: Date | null;
  dateLabel: string | null;
  text: string;
}

const ENTRY_RE = /^\[(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s*[•\-·]\s*([^\]]+)\]\s*(.*)$/;

/**
 * As notas de acompanhamento são gravadas no formato:
 *   [dd/MM/yyyy HH:mm • Autor] texto
 * Linhas fora do padrão são devolvidas como texto simples.
 */
export function parseFollowUpNotes(observations: string | null | undefined): FollowUpNote[] {
  if (!observations) return [];
  const lines = observations.split("\n");
  const notes: FollowUpNote[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(ENTRY_RE);
    if (m) {
      const [, dd, mm, yyyy, hh, mi, author, text] = m;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi));
      notes.push({
        raw: trimmed,
        author: author.trim(),
        date: isNaN(date.getTime()) ? null : date,
        dateLabel: `${dd}/${mm}/${yyyy} ${hh}:${mi}`,
        text: text.trim(),
      });
    } else if (notes.length > 0) {
      // continuação da nota anterior (nota multi-linha)
      const last = notes[notes.length - 1];
      last.text = `${last.text}\n${trimmed}`.trim();
      last.raw = `${last.raw}\n${trimmed}`;
    } else {
      notes.push({ raw: trimmed, author: null, date: null, dateLabel: null, text: trimmed });
    }
  }

  return notes;
}

export function latestFollowUpNote(observations: string | null | undefined): FollowUpNote | null {
  const notes = parseFollowUpNotes(observations);
  return notes[0] ?? null;
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/** Nota de acompanhamento efetiva de um projeto: prioriza a tabela project_notes
 *  e usa o texto legado de "observations" apenas como reserva. */
export interface EffectiveFollowUp {
  text: string;
  author: string | null;
  dateISO: string | null;
  dateLabel: string | null;
}

interface FollowUpSource {
  observations?: string | null;
  updated_at?: string | null;
  notes?: { id: string; content: string; created_at: string; author: string | null }[];
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function effectiveFollowUps(project: FollowUpSource): EffectiveFollowUp[] {
  const dbNotes = project.notes ?? [];
  if (dbNotes.length > 0) {
    return dbNotes.map(n => ({
      text: n.content,
      author: n.author,
      dateISO: n.created_at,
      dateLabel: fmt(n.created_at),
    }));
  }
  return parseFollowUpNotes(project.observations).map(n => ({
    text: n.text,
    author: n.author,
    dateISO: n.date ? n.date.toISOString() : null,
    dateLabel: n.dateLabel,
  }));
}

export function effectiveLatestFollowUp(project: FollowUpSource): EffectiveFollowUp | null {
  return effectiveFollowUps(project)[0] ?? null;
}

/** Data usada para calcular "dias sem atualização". */
export function followUpReferenceDate(project: FollowUpSource): string | null {
  const latest = effectiveLatestFollowUp(project);
  return latest?.dateISO ?? project.updated_at ?? null;
}

export type FollowUpLevel = "ok" | "warn" | "late" | "critical";

/* ─── SLA de acompanhamento ──────────────────────────────────────────────
 * Regra única usada pelo Kanban (cor/selo do card) e pela Visão Comercial
 * (card "Atrasados", lista, resumo por gerente). O que o GP vê no Kanban é
 * exatamente o que a Visão Comercial mostra. */

/** Status em que o SLA de acompanhamento se aplica. */
const SLA_STATUSES = new Set(["comercial", "planejamento", "implantacao"]);

export function tracksFollowUp(status: string): boolean {
  return SLA_STATUSES.has(status);
}

export interface SlaThresholds {
  green: number;
  yellow: number;
  orange: number;
}

export interface FollowUpSla {
  level: FollowUpLevel;
  /** null = nenhum acompanhamento registrado ainda */
  days: number | null;
}

/** Último acompanhamento: o mais recente entre project_notes e as notas
 *  legadas de "observations". Não usa updated_at — mover o card ou editar o
 *  projeto não conta como acompanhamento. */
export function lastFollowUpAt(observations: string | null | undefined, lastNoteAt: string | null | undefined): Date | null {
  const candidates = [latestFollowUpNote(observations)?.date ?? null, lastNoteAt ? new Date(lastNoteAt) : null]
    .filter((d): d is Date => !!d && !isNaN(d.getTime()));
  return candidates.length ? new Date(Math.max(...candidates.map(d => d.getTime()))) : null;
}

/** null quando o status não tem SLA (Implementado / Outros). */
export function followUpSla(status: string, lastAt: Date | null, t: SlaThresholds): FollowUpSla | null {
  if (!tracksFollowUp(status)) return null;
  if (!lastAt) return { level: "critical", days: null };
  const days = Math.max(0, differenceInDays(new Date(), lastAt));
  const level: FollowUpLevel = days <= t.green ? "ok" : days <= t.yellow ? "warn" : days <= t.orange ? "late" : "critical";
  return { level, days };
}

/** "Atrasados" = faixas laranja (Atrasado) e vermelha (Crítico) do Kanban. */
export function isLateSla(sla: FollowUpSla | null): boolean {
  return !!sla && (sla.level === "late" || sla.level === "critical");
}

export const followUpLevelStyles: Record<FollowUpLevel, { dot: string; label: string; text: string }> = {
  ok: { dot: "bg-emerald-500", label: "Em dia", text: "text-emerald-600" },
  warn: { dot: "bg-amber-500", label: "Atenção", text: "text-amber-600" },
  late: { dot: "bg-orange-500", label: "Atrasado", text: "text-orange-600" },
  critical: { dot: "bg-destructive", label: "Crítico", text: "text-destructive" },
};
