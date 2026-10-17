// Datas e textos dos alertas de prazo (implantação e contrato).
// Sem dependências: usado pela Edge Function deadline-alerts (Deno) e pelo
// portal (sino de alertas), para os dois falarem exatamente igual.

export type DeadlineKind = "implantacao" | "contrato";
export type DeadlineMilestone = "30d" | "12m" | "6m" | "3m";

export const MILESTONE_LABEL: Record<DeadlineMilestone, string> = { "30d": "30 dias", "12m": "12 meses", "6m": "6 meses", "3m": "3 meses" };
export const CONTRACT_MILESTONES: { milestone: DeadlineMilestone; months: number }[] = [
  { milestone: "12m", months: 12 }, { milestone: "6m", months: 6 }, { milestone: "3m", months: 3 },
];

/** "2026-10-16" → Date à meia-noite UTC (conta dias sem depender de fuso). */
export function ymd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export const toYmd = (d: Date) => d.toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((+ymd(to) - +ymd(from)) / 86_400_000);
export const addDays = (s: string, n: number) => toYmd(new Date(+ymd(s) + n * 86_400_000));

/** Soma meses de calendário; dia 31 vira o último dia do mês quando ele não existe (igual ao Postgres). */
export function addMonths(s: string, n: number): string {
  const d = ymd(s);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d.getUTCDate(), last));
  return toYmd(first);
}

/** Meses e dias inteiros de `from` até `to` (calendário). */
export function monthsAndDays(from: string, to: string): { months: number; days: number } {
  const a = ymd(from), b = ymd(to);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (+ymd(addMonths(from, months)) > +b) months--;
  months = Math.max(0, months);
  return { months, days: daysBetween(addMonths(from, months), to) };
}

const p2 = (n: number) => String(n).padStart(2, "0");
export const fmtDate = (s: string) => { const d = ymd(s); return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
export const fmtDayMonth = (s: string) => fmtDate(s).slice(0, 5);
const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WEEKDAY_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MONTH = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const weekday = (s: string) => WEEKDAY[ymd(s).getUTCDay()];
/** "segunda-feira, 19 de outubro de 2026" */
export const fmtLongDate = (s: string) => { const d = ymd(s); return `${WEEKDAY_LONG[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTH[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; };

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Quanto falta, em dias (até 30) ou em meses e dias: "30 dias", "6 meses", "5 meses e 28 dias". */
export function timeLeft(today: string, due: string): string {
  const days = daysBetween(today, due);
  if (days < 31) return plural(Math.max(0, days), "dia", "dias");
  const { months, days: rest } = monthsAndDays(today, due);
  return `${plural(months, "mês", "meses")}${rest ? ` e ${plural(rest, "dia", "dias")}` : ""}`;
}

/** "vence em 30 dias", "vence hoje", "termina em 6 meses", "termina amanhã". */
export function remainingText(kind: DeadlineKind, today: string, due: string): string {
  const verb = kind === "implantacao" ? "vence" : "termina";
  const days = daysBetween(today, due);
  if (days <= 0) return `${verb} hoje`;
  if (days === 1) return `${verb} amanhã`;
  return `${verb} em ${timeLeft(today, due)}`;
}

/** Versão curta para listas: "em 18 dias", "em 5 meses". */
export function remainingShort(today: string, due: string): string {
  const days = daysBetween(today, due);
  if (days <= 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days < 31) return `em ${days} dias`;
  return `em ${plural(monthsAndDays(today, due).months, "mês", "meses")}`;
}

export type Tone = "amber" | "orange" | "purple";
/** Cor do aviso: implantação e contrato a 6 meses em âmbar, contrato a 3 meses em laranja, a 12 meses em roxo. */
export const toneOf = (kind: DeadlineKind, milestone: DeadlineMilestone): Tone =>
  kind === "implantacao" ? "amber" : milestone === "3m" ? "orange" : milestone === "6m" ? "amber" : "purple";
