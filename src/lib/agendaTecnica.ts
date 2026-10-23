// Agenda técnica — cálculos de apoio às telas do Calendário, da Aprovação e da
// Área do Implantador: tipo da visita, dias úteis, carga dos técnicos,
// deslocamento em linha reta, alertas e recomendação de técnico.
// Tudo é derivado dos dados que já existem (solicitações, técnicos e feriados):
// nada aqui grava no banco.
import { dateKey, holidaysForVisit, type Holiday } from "@/lib/holidays";
import { formatLocation } from "@/lib/location";
import {
  conflictsFor, currentOrNextVacation, fmtVacation, isAvailable, onVacation, periodOf, techniciansOf, vacationFor,
  type ImplantationRequest, type Technician, type TechnicianVacation,
} from "@/lib/implantationScheduling";

/* ─── Datas ──────────────────────────────────────────────────────────────── */
export const DAY_MS = 864e5;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Soma dias e devolve o início do dia. */
export const plusDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const mondayOf = (d: Date) => plusDays(d, -((d.getDay() + 6) % 7));
/** Diferença em dias de calendário (b − a). */
export const dayDiff = (a: Date, b: Date) => Math.round((+startOfDay(b) - +startOfDay(a)) / DAY_MS);
export const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
export const sameDay = (a: Date, b: Date) => dayDiff(a, b) === 0;

export const WD_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const WD_LONG = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTH_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** Semanas que a visão "Por técnico" da agenda pode mostrar. */
export const WEEK_OPTIONS = [1, 2, 4] as const;

export const p2 = (n: number) => String(n).padStart(2, "0");
/** 15/10 */
export const fmtDM = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
/** 08:00 */
export const fmtHM = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
/** qui 15/10 */
export const fmtWdDM = (d: Date) => `${WD_SHORT[d.getDay()]} ${fmtDM(d)}`;

/** "Quinta-feira, 15 de outubro" */
export const dayTitle = (d: Date) => `${WD_LONG[d.getDay()].replace(/^./, c => c.toUpperCase())}, ${d.getDate()} de ${MONTH_LONG[d.getMonth()]}`;

/** "12 – 18 out" ou "26 out – 1 nov". */
export function fmtWeekRange(a: Date, b: Date) {
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`
    : `${a.getDate()} ${MONTH_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`;
}

/** Faixa de dias: "15/10", "14 e 15/10", "26 a 30/10", "31/10 a 02/11". */
export function fmtDayRange(a: Date, b: Date) {
  const n = dayDiff(a, b);
  if (n <= 0) return fmtDM(a);
  const same = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const left = same ? p2(a.getDate()) : fmtDM(a);
  return `${left} ${n === 1 ? "e" : "a"} ${fmtDM(b)}`;
}

/** Primeiro e último dia ocupados pela visita (fim à meia-noite não ocupa o dia seguinte). */
export function visitDays(r: ImplantationRequest) {
  const { start, end } = periodOf(r);
  const first = startOfDay(start);
  const last = end > start ? startOfDay(new Date(+end - 1)) : first;
  return { first, last, count: dayDiff(first, last) + 1 };
}

/** Resumo do período: "qui 15/10, a partir das 08:00, 1 dia". */
export function visitSummary(r: ImplantationRequest) {
  const { first, last, count } = visitDays(r);
  return `${fmtWdDM(first)}${count > 1 ? ` a ${fmtWdDM(last)}` : ""}, a partir das ${fmtHM(periodOf(r).start)}, ${count} dia${count > 1 ? "s" : ""}`;
}

/** A visita ocupa o dia d? */
export const coversDay = (r: ImplantationRequest, d: Date) => {
  const { first, last } = visitDays(r);
  return +first <= +startOfDay(d) && +startOfDay(d) <= +last;
};

/** Fundos listrados (inline: gradiente não cabe em classe utilitária). */
export const HATCH = {
  /** Dia de feriado na grade. */
  holiday: { backgroundImage: "repeating-linear-gradient(135deg, rgb(225 29 72 / 0.11) 0 6px, rgb(225 29 72 / 0.03) 6px 12px)" },
  /** Solicitação pendente (ainda sem técnico). */
  pending: { backgroundImage: "repeating-linear-gradient(135deg, rgb(245 158 11 / 0.16) 0 6px, rgb(245 158 11 / 0.04) 6px 12px)" },
  /** Trecho da visita que cai em fim de semana ou feriado. */
  special: { backgroundImage: "repeating-linear-gradient(135deg, rgb(132 204 22 / 0.45) 0 5px, rgb(132 204 22 / 0.10) 5px 10px)" },
  /** Férias do técnico na linha do tempo. */
  vacation: { backgroundImage: "repeating-linear-gradient(135deg, rgb(14 165 233 / 0.18) 0 6px, rgb(14 165 233 / 0.05) 6px 12px)" },
} as const;

/* ─── Feriados e dias úteis ──────────────────────────────────────────────── */
/** Feriado que para a equipe inteira: nacional (exceto ponto facultativo) ou da empresa. */
export const teamHolidaysOn = (d: Date, holidays: Map<string, Holiday[]>) =>
  (holidays.get(dateKey(d)) ?? []).filter(h => (h.scope === "nacional" && !h.optional) || h.scope === "empresa");

/** Dia útil da equipe: segunda a sexta, sem feriado nacional ou da empresa. */
export const isTeamWorkday = (d: Date, holidays: Map<string, Holiday[]>) => !isWeekend(d) && teamHolidaysOn(d, holidays).length === 0;

export function workdaysIn(from: Date, to: Date, holidays: Map<string, Holiday[]>) {
  const out: Date[] = [];
  for (let d = startOfDay(from); +d <= +startOfDay(to); d = plusDays(d, 1)) if (isTeamWorkday(d, holidays)) out.push(d);
  return out;
}

/** Último dia útil até `to` (inclusive). */
export function lastWorkdayUntil(to: Date, holidays: Map<string, Holiday[]>) {
  let d = startOfDay(to);
  for (let i = 0; i < 14 && !isTeamWorkday(d, holidays); i++) d = plusDays(d, -1);
  return d;
}

/* ─── Tipo da visita ─────────────────────────────────────────────────────── */
export type VisitKind = "its" | "bilhetagem" | "atlasmob" | "reciclagem" | "rede_vendas" | "executivo" | "outro";

interface KindStyle {
  label: string;
  /** Barra na linha do tempo e no mês. */
  bar: string;
  /** Pílula de tipo (detalhe, painel, lista). */
  chip: string;
  /** Amostra da legenda. */
  swatch: string;
  /** Ponto sólido (grade compacta do celular). */
  dot: string;
}

export const VISIT_KIND: Record<VisitKind, KindStyle> = {
  its: {
    label: "ITS/Frotas",
    bar: "border-blue-500/35 bg-blue-500/10 text-blue-950 dark:border-blue-400/35 dark:bg-blue-400/15 dark:text-blue-50",
    chip: "bg-blue-500/15 text-blue-800 dark:text-blue-200",
    swatch: "border-blue-500/45 bg-blue-500/15",
    dot: "bg-blue-500",
  },
  bilhetagem: {
    label: "Bilhetagem",
    bar: "border-teal-500/40 bg-teal-500/[0.14] text-teal-950 dark:border-teal-400/35 dark:bg-teal-400/15 dark:text-teal-50",
    chip: "bg-teal-500/15 text-teal-800 dark:text-teal-200",
    swatch: "border-teal-500/45 bg-teal-500/15",
    dot: "bg-teal-500",
  },
  // AtlasMob, Reciclagem, Rede de Vendas, Projeto Executivo e Outros compartilham
  // o mesmo visual neutro: na agenda importa o cliente e as datas, o rótulo do tipo
  // continua distinto na pílula de texto.
  atlasmob: {
    label: "AtlasMob",
    bar: "border-border bg-muted/70 text-foreground/90",
    chip: "bg-muted text-foreground/80",
    swatch: "border-border bg-muted",
    dot: "bg-muted-foreground",
  },
  reciclagem: {
    label: "Reciclagem",
    bar: "border-border bg-muted/70 text-foreground/90",
    chip: "bg-muted text-foreground/80",
    swatch: "border-border bg-muted",
    dot: "bg-muted-foreground",
  },
  rede_vendas: {
    label: "Rede de Vendas",
    bar: "border-border bg-muted/70 text-foreground/90",
    chip: "bg-muted text-foreground/80",
    swatch: "border-border bg-muted",
    dot: "bg-muted-foreground",
  },
  executivo: {
    label: "Projeto Executivo",
    bar: "border-border bg-muted/70 text-foreground/90",
    chip: "bg-muted text-foreground/80",
    swatch: "border-border bg-muted",
    dot: "bg-muted-foreground",
  },
  outro: {
    label: "Outros",
    bar: "border-border bg-muted/70 text-foreground/90",
    chip: "bg-muted text-foreground/80",
    swatch: "border-border bg-muted",
    dot: "bg-muted-foreground",
  },
};
export const VISIT_KIND_ORDER: VisitKind[] = ["its", "bilhetagem", "atlasmob", "reciclagem", "rede_vendas", "executivo", "outro"];

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Tipo da visita a partir do objetivo ("2ª Visita - ITS / Gestão de Frotas" → ITS/Frotas). */
export function visitKindOf(purpose: string): VisitKind {
  const p = norm(purpose);
  if (/bilhet/.test(p)) return "bilhetagem";
  if (/\bits\b|frota/.test(p)) return "its";
  if (/atlas ?mob/.test(p)) return "atlasmob";
  if (/recicl/.test(p)) return "reciclagem";
  if (/rede de vendas|\bvendas\b/.test(p)) return "rede_vendas";
  if (/executivo/.test(p)) return "executivo";
  return "outro";
}

/** Número da visita ("1ª", "2ª"…) quando o objetivo indica. */
export function visitOrdinal(purpose: string): string | null {
  const m = /(\d+)\s*[ªºa°o]?\s*visita/i.exec(purpose);
  return m ? `${m[1]}ª` : null;
}

/* ─── Situação da visita ─────────────────────────────────────────────────── */
export type VisitState = "pendente" | "agendada" | "em_andamento" | "concluida" | "aguardando_registro";
export const VISIT_STATE: Record<VisitState, { label: string; pill: string }> = {
  pendente: { label: "Pendente", pill: "bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  agendada: { label: "Aprovada", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  em_andamento: { label: "Em andamento", pill: "bg-primary/10 text-primary" },
  concluida: { label: "Concluída", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  aguardando_registro: { label: "Aguardando registro", pill: "bg-sky-500/15 text-sky-800 dark:text-sky-200" },
};
export const VISIT_STATE_FILTER: VisitState[] = ["pendente", "agendada", "em_andamento", "aguardando_registro", "concluida"];

export function visitState(r: ImplantationRequest, now: Date): VisitState {
  if (r.status === "pendente") return "pendente";
  if (r.attendance) return "concluida";
  const { start, end } = periodOf(r);
  if (end < now) return "aguardando_registro";
  if (start <= now) return "em_andamento";
  return "agendada";
}

/* ─── Local e deslocamento ───────────────────────────────────────────────── */
export interface Place { city: string | null; state: string | null; country_code: string | null }
/** Cidade da visita: a do endereço do treinamento (presencial), senão a do projeto. */
export const placeOf = (r: ImplantationRequest): Place | null =>
  r.visit_format === "presencial" && r.address_city?.trim()
    ? { city: r.address_city.trim(), state: r.address_state?.trim() || null, country_code: r.project?.country_code ?? null }
    : r.project ? { city: r.project.city, state: r.project.state, country_code: r.project.country_code } : null;
export const placeLabel = (p: Place | null) => (p ? formatLocation(p.city, p.state, p.country_code) : "—");
const samePlace = (a: Place | null, b: Place | null) =>
  !!a && !!b && norm(a.city) === norm(b.city) && norm(a.state) === norm(b.state) && (a.country_code ?? "BR") === (b.country_code ?? "BR");

/** Índice "UF|cidade normalizada" → [lat, lon]. */
export type CityIndex = Map<string, [number, number]>;
let cityIndexPromise: Promise<CityIndex> | null = null;

/** Carrega (uma vez) as coordenadas dos municípios. */
export function loadCityIndex(): Promise<CityIndex> {
  if (!cityIndexPromise) {
    cityIndexPromise = import("@/data/municipiosBr").then(({ default: raw }) => {
      const idx: CityIndex = new Map();
      for (const line of raw.split("\n")) {
        const [uf, rest] = line.split(":");
        for (const item of rest.split(";")) {
          const [name, lat, lon] = item.split(",");
          idx.set(`${uf}|${name}`, [Number(lat), Number(lon)]);
        }
      }
      return idx;
    }).catch(err => { cityIndexPromise = null; throw err; });
  }
  return cityIndexPromise;
}

export function coordsOf(index: CityIndex | null, p: Place | null): [number, number] | null {
  if (!index || !p || !p.city || !p.state || (p.country_code ?? "BR").toUpperCase() !== "BR") return null;
  return index.get(`${p.state.toUpperCase()}|${norm(p.city)}`) ?? null;
}

export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371, rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Km em linha reta entre dois locais (0 na mesma cidade; null se não der para calcular). */
export function distanceKm(index: CityIndex | null, a: Place | null, b: Place | null): number | null {
  if (samePlace(a, b)) return 0;
  const ca = coordsOf(index, a), cb = coordsOf(index, b);
  return ca && cb ? Math.round(haversineKm(ca, cb)) : null;
}

export const fmtKm = (km: number) => `${km.toLocaleString("pt-BR")} km`;
/** Acima disso, emendar duas visitas sem um dia livre vira alerta. */
export const LONG_TRIP_KM = 300;

/* ─── Carga e disponibilidade dos técnicos ───────────────────────────────── */
export const approvedOf = (list: ImplantationRequest[]) => list.filter(r => r.status === "aprovada");
export const visitsOfTech = (techId: string, list: ImplantationRequest[]) =>
  list.filter(r => techniciansOf(r).some(t => t.id === techId)).sort((a, b) => +periodOf(a).start - +periodOf(b).start);

/** Dias úteis ocupados por visitas aprovadas do técnico entre from e to. */
export function busyWorkdays(techId: string, approved: ImplantationRequest[], from: Date, to: Date, holidays: Map<string, Holiday[]>, ignoreId?: string) {
  const mine = visitsOfTech(techId, approved).filter(r => r.id !== ignoreId);
  return workdaysIn(from, to, holidays).filter(d => mine.some(r => coversDay(r, d))).length;
}

export interface TechLoad {
  tech: Technician;
  workdays: number;
  busy: number;
  free: number;
  /** Visita aprovada que ocupa hoje. */
  current: ImplantationRequest | null;
  /** Próxima visita aprovada depois de hoje. */
  next: ImplantationRequest | null;
  /** Dias úteis de férias no período (fora de `workdays`). */
  off: number;
  /** Férias em andamento hoje (`now`) ou as próximas. */
  vacation: { vacation: TechnicianVacation; now: boolean } | null;
}

export function techLoad(tech: Technician, approved: ImplantationRequest[], from: Date, to: Date, holidays: Map<string, Holiday[]>, today: Date): TechLoad {
  const mine = visitsOfTech(tech.id, approved);
  const all = +startOfDay(to) >= +startOfDay(from) ? workdaysIn(from, to, holidays) : [];
  // dias de férias não contam como disponíveis
  const days = all.filter(d => !onVacation(tech, d));
  const busy = days.filter(d => mine.some(r => coversDay(r, d))).length;
  return {
    tech,
    workdays: days.length,
    busy,
    free: days.length - busy,
    current: mine.find(r => coversDay(r, today)) ?? null,
    next: mine.find(r => +visitDays(r).first > +startOfDay(today)) ?? null,
    off: all.length - days.length,
    vacation: currentOrNextVacation(tech, today),
  };
}

/** Cor da barra de ocupação (verde → marca → âmbar → vermelho). */
export function loadTone(busy: number, total: number) {
  const ratio = total ? busy / total : 0;
  if (total && busy >= total) return { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" };
  if (ratio >= 0.85) return { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" };
  if (ratio >= 0.5) return { bar: "bg-primary/70", text: "text-foreground" };
  return { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" };
}

/* ─── Alertas ────────────────────────────────────────────────────────────── */
export type AlertKind = "conflito" | "ferias" | "sem_folga" | "sem_dia_livre" | "fim_de_semana";
export interface AgendaAlert {
  id: string;
  kind: AlertKind;
  techId: string;
  title: string;
  /** Datas envolvidas, ex.: "14 e 15/10". */
  when: string;
  text: string;
  /** Primeiro dia envolvido (ordenação). */
  sortKey: number;
  requestIds: string[];
  suggestion?: { text: string; requestId: string };
}

const short = (t: Technician) => t.full_name.trim().split(/\s+/)[0] || t.full_name;
const client = (r: ImplantationRequest) => r.project?.company_name ?? "projeto removido";

/** Dias especiais (fim de semana e feriados que valem no local) que a visita ocupa. */
export function specialDaysOf(r: ImplantationRequest, custom: Holiday[]) {
  const { first, last } = visitDays(r);
  const { start, end } = periodOf(r);
  const hol = holidaysForVisit(start, end, custom, { city: r.project?.city, state: r.project?.state }).filter(h => !h.optional);
  const out: { date: Date; label: string; holiday?: Holiday }[] = [];
  for (let d = first; +d <= +last; d = plusDays(d, 1)) {
    const h = hol.find(x => x.date === dateKey(d));
    if (h) out.push({ date: d, label: `em ${h.name}`, holiday: h });
    else if (isWeekend(d)) out.push({ date: d, label: d.getDay() === 6 ? "no sábado" : "no domingo" });
  }
  return out;
}

const joinPt = (parts: string[]) => parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;

export function computeAlerts(opts: {
  techs: Technician[];
  approved: ImplantationRequest[];
  from: Date;
  to: Date;
  today: Date;
  holidays: Map<string, Holiday[]>;
  custom: Holiday[];
  index: CityIndex | null;
  /** Técnicos já sugeridos para pendentes (não entram na sugestão de troca no mesmo período). */
  reserved?: { techId: string; start: Date; end: Date }[];
}): AgendaAlert[] {
  const { techs, approved, from, to, today, holidays, custom, index } = opts;
  const reserved = [...(opts.reserved ?? [])];
  const alerts: AgendaAlert[] = [];
  const inRange = (r: ImplantationRequest) => +visitDays(r).first <= +startOfDay(to) && +visitDays(r).last >= +startOfDay(from);

  for (const t of techs) {
    const mine = visitsOfTech(t.id, approved);
    const visible = mine.filter(inRange);

    // 1) conflito e viagem sem folga entre visitas consecutivas
    for (let i = 0; i + 1 < mine.length; i++) {
      const a = mine[i], b = mine[i + 1];
      if (!inRange(a) && !inRange(b)) continue;
      const pa = periodOf(a), pb = periodOf(b);
      const da = visitDays(a), db = visitDays(b);
      if (pb.start < pa.end) {
        alerts.push({
          id: `conf-${a.id}-${b.id}`, kind: "conflito", techId: t.id,
          title: `Conflito de horário: ${short(t)}`,
          when: fmtDayRange(db.first, da.last < db.last ? da.last : db.last),
          text: `${client(a)} e ${client(b)} se sobrepõem. Ajuste o período de uma das visitas.`,
          sortKey: +db.first, requestIds: [a.id, b.id],
        });
        continue;
      }
      const gap = dayDiff(da.last, db.first) - 1;
      if (gap > 0) continue;
      const km = distanceKm(index, placeOf(a), placeOf(b));
      if (km === null || km < LONG_TRIP_KM) continue;
      const sameDayTrip = gap < 0;
      alerts.push({
        id: `folga-${a.id}-${b.id}`, kind: "sem_folga", techId: t.id,
        title: `${short(t)} viaja sem folga entre visitas`,
        when: fmtDayRange(da.last, db.first),
        text: sameDayTrip
          ? `Termina ${client(a)} em ${placeLabel(placeOf(a))} e começa em ${placeLabel(placeOf(b))} às ${fmtHM(pb.start)} do mesmo dia (${fmtDM(db.first)}). São ${fmtKm(km)} em linha reta.`
          : `Termina ${client(a)} em ${placeLabel(placeOf(a))} no dia ${da.last.getDate()} e começa em ${placeLabel(placeOf(b))} às ${fmtHM(pb.start)} do dia ${db.first.getDate()}. São ${fmtKm(km)} em linha reta, sem um dia livre entre as visitas.`,
        sortKey: +da.last, requestIds: [a.id, b.id],
      });
    }

    // 1b) visita aprovada que cai nas férias do técnico
    for (const r of visible) {
      const { start, end } = periodOf(r);
      const v = vacationFor(t, start, end);
      if (!v) continue;
      const { first, last } = visitDays(r);
      alerts.push({
        id: `ferias-${r.id}-${t.id}`, kind: "ferias", techId: t.id,
        title: `${short(t)} está de férias`,
        when: fmtDayRange(first, last),
        text: `${client(r)} (${fmtDayRange(first, last)}) cai nas férias de ${fmtVacation(v)}. Troque o técnico ou o período da visita.`,
        sortKey: +first, requestIds: [r.id],
      });
    }

    // 2) sem nenhum dia útil livre até o fim do período (dias de férias não entram)
    const winFrom = +startOfDay(today) > +startOfDay(from) ? startOfDay(today) : startOfDay(from);
    const workdays = +winFrom <= +startOfDay(to) ? workdaysIn(winFrom, to, holidays).filter(d => !onVacation(t, d)) : [];
    if (workdays.length >= 3 && workdays.every(d => mine.some(r => coversDay(r, d)))) {
      const lastWd = workdays[workdays.length - 1];
      const win = mine.filter(r => +visitDays(r).last >= +winFrom && +visitDays(r).first <= +startOfDay(to));
      let trips = 0, km = 0, weekendTrips = 0;
      for (let i = 0; i + 1 < win.length; i++) {
        const d = distanceKm(index, placeOf(win[i]), placeOf(win[i + 1]));
        if (d === null || d < LONG_TRIP_KM) continue;
        trips++; km += d;
        const a = visitDays(win[i]).last, b = visitDays(win[i + 1]).first;
        let onlyOff = dayDiff(a, b) > 1;
        for (let x = plusDays(a, 1); +x < +b; x = plusDays(x, 1)) if (isTeamWorkday(x, holidays)) onlyOff = false;
        if (onlyOff) weekendTrips++;
      }
      const tripText = trips === 0
        ? `Todos os dias úteis até ${fmtDM(lastWd)} estão ocupados.`
        : trips === 1
          ? `Há uma viagem longa no período${weekendTrips ? ", no fim de semana" : ""}, cerca de ${fmtKm(Math.round(km / 10) * 10)} em linha reta.`
          : `São ${trips} viagens longas seguidas${weekendTrips === trips ? " nos fins de semana" : ""}, cerca de ${fmtKm(Math.round(km / 100) * 100)} em linha reta.`;
      // sugestão: outro técnico livre para assumir uma das próximas visitas
      let suggestion: AgendaAlert["suggestion"];
      for (const r of win.filter(x => +visitDays(x).first > +startOfDay(today))) {
        const { start, end } = periodOf(r);
        const options = techs
          .filter(o => o.id !== t.id && isAvailable(o, start, end, approved, r.id)
            && !reserved.some(x => x.techId === o.id && x.start < end && start < x.end))
          .map(o => ({ o, busy: busyWorkdays(o.id, approved, winFrom, to, holidays) }))
          .sort((x, y) => x.busy - y.busy || x.o.full_name.localeCompare(y.o.full_name));
        if (options.length) {
          const { first, last } = visitDays(r);
          suggestion = { requestId: r.id, text: `${short(options[0].o)} está livre de ${fmtDayRange(first, last)} e pode assumir ${client(r)}.` };
          reserved.push({ techId: options[0].o.id, start, end });
          break;
        }
      }
      alerts.push({
        id: `livre-${t.id}`, kind: "sem_dia_livre", techId: t.id,
        title: `${short(t)} sem nenhum dia livre até ${fmtDM(lastWd)}`,
        when: `${fmtDM(winFrom)} a ${fmtDM(lastWd)}`,
        text: tripText, sortKey: +winFrom, requestIds: win.map(r => r.id), suggestion,
      });
    }

    // 3) trabalho no fim de semana ou feriado
    for (const r of visible) {
      const special = specialDaysOf(r, custom);
      if (!special.length) continue;
      const { count } = visitDays(r);
      const hasHol = special.some(s => s.holiday), hasWe = special.some(s => !s.holiday);
      const what = hasHol && hasWe ? "no fim de semana e no feriado" : hasHol ? "no feriado" : "no fim de semana";
      const labels = [...new Set(special.map(s => s.label))];
      const ord = visitOrdinal(r.visit_purpose);
      const visitName = `${ord ? `a ${ord} visita` : "a visita"} à ${client(r)}, em ${placeLabel(placeOf(r))}`;
      const text = special.length === count
        ? `${visitName.replace(/^a/, "A")}, foi marcada para ${joinPt(labels.map(l => l.replace(/^(no|em) /, "")))}.`
        : `${visitName.replace(/^a/, "A")}, segue ${joinPt(labels)}.`;
      alerts.push({
        id: `fds-${r.id}-${t.id}`, kind: "fim_de_semana", techId: t.id,
        title: `${short(t)} trabalha ${what}`,
        when: fmtDayRange(special[0].date, special[special.length - 1].date),
        text, sortKey: +special[0].date, requestIds: [r.id],
      });
    }
  }
  return alerts.sort((a, b) => a.sortKey - b.sortKey || a.title.localeCompare(b.title));
}

/* ─── Quem pode ir (aprovação) ───────────────────────────────────────────── */
export interface Candidate {
  tech: Technician;
  free: boolean;
  conflicts: ImplantationRequest[];
  /** Dias úteis em campo no mês do início pedido. */
  monthBusy: number;
  monthWorkdays: number;
  /** Última visita aprovada antes do início. */
  last: ImplantationRequest | null;
  /** Km da última visita até o local pedido. */
  kmFromLast: number | null;
  /** Visita que termina no dia anterior (ou no mesmo dia) do início. */
  tightBefore: { visit: ImplantationRequest; km: number | null } | null;
  /** Férias que tocam o período pedido (técnico indisponível). */
  vacation: TechnicianVacation | null;
  recommended: boolean;
}

export function candidatesFor(opts: {
  request: ImplantationRequest;
  start: Date;
  end: Date;
  techs: Technician[];
  requests: ImplantationRequest[];
  holidays: Map<string, Holiday[]>;
  index: CityIndex | null;
}): Candidate[] {
  const { request, start, end, techs, requests, holidays, index } = opts;
  const approved = approvedOf(requests).filter(r => r.id !== request.id);
  const m0 = new Date(start.getFullYear(), start.getMonth(), 1), m1 = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const monthWorkdays = workdaysIn(m0, m1, holidays).length;
  const dest = placeOf(request);
  const list: Candidate[] = techs.map(tech => {
    const conflicts = conflictsFor(tech.id, start, end, requests, request.id);
    const vacation = vacationFor(tech, start, end);
    const before = visitsOfTech(tech.id, approved).filter(r => periodOf(r).end <= start);
    const last = before.length ? before[before.length - 1] : null;
    const kmFromLast = last ? distanceKm(index, placeOf(last), dest) : null;
    const tight = last && dayDiff(visitDays(last).last, startOfDay(start)) <= 1 ? { visit: last, km: kmFromLast } : null;
    return {
      tech, free: conflicts.length === 0 && !vacation, conflicts, vacation,
      monthBusy: busyWorkdays(tech.id, approved, m0, m1, holidays),
      monthWorkdays, last, kmFromLast, tightBefore: tight, recommended: false,
    };
  });
  const free = list.filter(c => c.free).sort((a, b) =>
    a.monthBusy - b.monthBusy ||
    (a.tightBefore ? 1 : 0) - (b.tightBefore ? 1 : 0) ||
    (a.kmFromLast ?? 1e6) - (b.kmFromLast ?? 1e6) ||
    a.tech.full_name.localeCompare(b.tech.full_name));
  if (free.length) free[0].recommended = true;
  const busy = list.filter(c => !c.free).sort((a, b) => a.tech.full_name.localeCompare(b.tech.full_name));
  return [...free, ...busy];
}

export type CheckLevel = "ok" | "warn" | "error";
export interface Check { level: CheckLevel; text: string }

/** Verificações exibidas antes de aprovar, para os técnicos escolhidos. */
export function checksFor(opts: {
  request: ImplantationRequest;
  start: Date;
  end: Date;
  chosen: Candidate[];
  custom: Holiday[];
  index: CityIndex | null;
}): Check[] {
  const { request, start, end, chosen, custom, index } = opts;
  const out: Check[] = [];
  const range = fmtDayRange(startOfDay(start), end > start ? startOfDay(new Date(+end - 1)) : startOfDay(start));
  const conflicted = chosen.filter(c => c.conflicts.length || c.vacation);
  if (conflicted.length) {
    for (const c of conflicted) {
      if (c.vacation) { out.push({ level: "error", text: `${c.tech.full_name} está de férias de ${fmtVacation(c.vacation)}.` }); continue; }
      const r = c.conflicts[0];
      out.push({ level: "error", text: `${c.tech.full_name} já está em ${client(r)} de ${fmtDayRange(visitDays(r).first, visitDays(r).last)}.` });
    }
  } else {
    out.push({ level: "ok", text: `Sem conflito de horário em ${range}` });
  }

  const fake = { ...request, approved_start: start.toISOString(), approved_end: end.toISOString() } as ImplantationRequest;
  const special = end > start ? specialDaysOf(fake, custom) : [];
  if (!special.length) out.push({ level: "ok", text: "Dias úteis, sem feriado no período" });
  else {
    const hol = special.filter(s => s.holiday).map(s => `${s.holiday!.name} (${fmtDM(s.date)})`);
    const we = special.filter(s => !s.holiday).map(s => `${WD_SHORT[s.date.getDay()]} ${fmtDM(s.date)}`);
    if (hol.length) out.push({ level: "warn", text: `Inclui feriado: ${joinPt(hol)}` });
    if (we.length) out.push({ level: "warn", text: `Inclui fim de semana: ${joinPt(we)}` });
  }

  const tight = chosen.filter(c => c.tightBefore);
  if (chosen.length && !tight.length) out.push({ level: "ok", text: "Nenhuma visita no dia anterior, sem viagem apertada" });
  for (const c of tight) {
    const v = c.tightBefore!.visit, km = c.tightBefore!.km;
    out.push({
      level: km !== null && km >= LONG_TRIP_KM ? "warn" : "ok",
      text: `${short(c.tech)} termina ${client(v)} em ${placeLabel(placeOf(v))} no dia ${fmtDM(visitDays(v).last)}${km ? `: ${fmtKm(km)} em linha reta até o local` : km === 0 ? ", na mesma cidade" : ""}.`,
    });
  }

  const dest = placeOf(request);
  if (!request.location?.trim()) out.push({ level: "warn", text: `Local não informado na solicitação. O deslocamento usa a cidade do projeto (${placeLabel(dest)}).` });
  else if (index && dest && (dest.country_code ?? "BR") === "BR" && !coordsOf(index, dest)) {
    out.push({ level: "warn", text: `Não encontramos ${placeLabel(dest)} na base de municípios: sem cálculo de deslocamento.` });
  }
  return out;
}
