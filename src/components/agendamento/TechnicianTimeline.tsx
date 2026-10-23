import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AlertTriangle, Check, Palmtree, UserRoundCog } from "lucide-react";
import { dateOfYmd, fmtVacation, periodOf, techniciansOf, type ImplantationRequest, type Technician, type TechnicianVacation } from "@/lib/implantationScheduling";
import { dateKey, type Holiday } from "@/lib/holidays";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  HATCH, VISIT_KIND, WD_SHORT, dayDiff, fmtDM, fmtDayRange, fmtHM, fmtWeekRange, isWeekend, loadTone,
  placeLabel, placeOf, plusDays, startOfDay, visitDays, visitKindOf, visitOrdinal,
  type AgendaAlert, type CityIndex, type TechLoad,
} from "@/lib/agendaTecnica";
import { TechAvatar } from "./AgendaShared";
import { HolidayTooltip } from "./HolidaysDialog";
import { VisitHover } from "./VisitHoverCard";

// Mantido só por compatibilidade com a página (que ainda aceita o prop); hoje não usamos sugestões sobrepostas na linha do tempo.
export interface TimelineSuggestion { techId: string; request: ImplantationRequest }

const HIGHLIGHT = "z-30 ring-2 ring-amber-400 ring-offset-1 ring-offset-background";
const PAD = 11, LANE = 56;
const MIN_WIDTH: Record<number, number> = { 1: 640, 2: 820, 4: 1000 };

/** Distribui itens em "pistas" para não se sobreporem na mesma linha. */
function pack<T extends { a: number; b: number }>(items: T[]) {
  const ends: number[] = [];
  return [...items].sort((x, y) => x.a - y.a || y.b - x.b).map(it => {
    let lane = 0;
    while (ends[lane] !== undefined && ends[lane] >= it.a) lane++;
    ends[lane] = it.b;
    return { ...it, lane };
  });
}

/** Linha do tempo por técnico: uma linha por técnico, dias nas colunas (fim de semana mais estreito). */
export function TechnicianTimeline({
  start, weeks, techs, approved, loads, loadUntil, holidays, alertsByRequest,
  highlightId, onOpen, onAssign,
}: {
  start: Date;
  weeks: number;
  techs: Technician[];
  approved: ImplantationRequest[];
  /** Mantido na interface só por compatibilidade; pedidos pendentes vivem no painel lateral. */
  pending?: ImplantationRequest[];
  loads: Map<string, TechLoad>;
  /** Fim da janela de "dias livres" (null quando o período já passou). */
  loadUntil: Date | null;
  holidays: Map<string, Holiday[]>;
  custom?: Holiday[];
  index?: CityIndex | null;
  alertsByRequest: Map<string, AgendaAlert[]>;
  /** Mantido só por compatibilidade; não é mais usado. */
  suggestions?: TimelineSuggestion[];
  highlightId: string | null;
  /** Mantido só por compatibilidade; o quadro semanal já não mostra deslocamentos. */
  showTravel?: boolean;
  onOpen: (r: ImplantationRequest) => void;
  /** Presente = pode avaliar (abre o painel de aprovação). */
  onAssign?: (r: ImplantationRequest, techId?: string) => void;
}) {
  const isMobile = useIsMobile();
  const NAME = isMobile ? 136 : 212;
  const N = weeks * 7;
  const s0 = startOfDay(start);
  const days = useMemo(() => Array.from({ length: N }, (_, i) => plusDays(s0, i)), [N, +s0]); // eslint-disable-line react-hooks/exhaustive-deps
  const weights = days.map(d => (isWeekend(d) ? 1 : 2));
  const totalFr = weights.reduce((a, b) => a + b, 0);
  const template = `${NAME}px ${weights.map(w => `minmax(0,${w}fr)`).join(" ")}`;
  const today = startOfDay(new Date());
  const todayIdx = dayDiff(s0, today);

  // largura real, para decidir quanto texto cabe em cada barra
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const minWidth = (MIN_WIDTH[weeks] ?? 1180) - (isMobile ? 220 - NAME : 0);
  const pxPerFr = (Math.max(width, minWidth) - NAME) / totalFr;

  const span = (r: ImplantationRequest) => {
    const { first, last } = visitDays(r);
    const a = dayDiff(s0, first), b = dayDiff(s0, last);
    if (b < 0 || a > N - 1) return null;
    return { a: Math.max(0, a), b: Math.min(N - 1, b), contL: a < 0, contR: b > N - 1 };
  };
  const weightOf = (a: number, b: number) => weights.slice(a, b + 1).reduce((x, y) => x + y, 0);

  /* ─── férias: faixa listrada atrás das visitas ─── */
  const vacationSpans = (t: Technician) => (t.vacations ?? [])
    .map(v => ({ v, a: dayDiff(s0, dateOfYmd(v.start_date)), b: dayDiff(s0, dateOfYmd(v.end_date)) }))
    .filter(x => x.b >= 0 && x.a <= N - 1)
    .map(x => ({ v: x.v, a: Math.max(0, x.a), b: Math.min(N - 1, x.b) }));
  /** `underVisits`: há visita por cima; o rótulo vai para a faixa de cima, sem ficar atrás da barra. */
  const vacationBlock = (v: TechnicianVacation, a: number, b: number, underVisits: boolean) => {
    const wide = weightOf(a, b) * pxPerFr > 90;
    return (
      <div key={`vac-${v.id}`} role="img" aria-label={`Férias de ${fmtVacation(v)}`} title={`Férias de ${fmtVacation(v)}${v.note ? ` · ${v.note}` : ""}`}
        className={`relative z-[5] flex gap-1 overflow-hidden border-x border-sky-500/40 font-semibold text-sky-800 dark:text-sky-200 ${underVisits ? "items-start justify-start px-1.5 text-[9.5px] leading-[11px]" : "items-center justify-center text-[11px]"}`}
        style={{ gridColumn: `${a + 2} / ${b + 3}`, gridRow: "1 / -1", ...HATCH.vacation }}>
        <Palmtree className={underVisits ? "h-2.5 w-2.5 shrink-0" : "h-3.5 w-3.5 shrink-0"} />{wide && <span className="truncate">Férias {fmtVacation(v)}</span>}
      </div>
    );
  };

  /* ─── fundo das colunas (fim de semana, feriado, hoje, divisão de semana) ─── */
  const background = days.map((d, i) => {
    const hol = holidays.get(dateKey(d));
    const isToday = i === todayIdx;
    const style: CSSProperties = { gridColumn: i + 2, gridRow: "1 / -1" };
    return (
      <div key={`bg${i}`} aria-hidden style={style}
        className={`${i % 7 === 0 ? "border-l border-border" : "border-l border-border/40"} ${isToday ? "border-x border-primary/25 bg-primary/[0.05]" : hol ? "bg-rose-500/[0.05]" : isWeekend(d) ? "bg-muted/40" : ""}`} />
    );
  });

  /* ─── barra de visita confirmada ─── */
  const bar = (r: ImplantationRequest, a: number, b: number, lane: number, contL: boolean, contR: boolean) => {
    const kind = VISIT_KIND[visitKindOf(r.visit_purpose)];
    const { start: rs } = periodOf(r);
    const weight = weightOf(a, b);
    const px = weight * pxPerFr - 6;
    const size: "xs" | "sm" | "md" = px < 64 ? "xs" : px < 120 ? "sm" : "md";
    const ord = visitOrdinal(r.visit_purpose);
    const alerts = alertsByRequest.get(r.id) ?? [];
    const hasAlert = alerts.length > 0;
    const done = r.status === "aprovada" && !!r.attendance;
    const city = placeLabel(placeOf(r));

    const label = `${r.project?.company_name ?? "Projeto removido"}, ${r.visit_purpose}, ${city}, ${fmtDayRange(visitDays(r).first, visitDays(r).last)}, ${fmtHM(rs)}${done ? ". Concluída" : ""}${hasAlert ? `. Atenção: ${alerts.map(x => x.title).join("; ")}` : ""}`;

    return (
      <VisitHover key={`${r.id}-${lane}`} request={r} alerts={alerts} onOpen={onOpen} onAssign={onAssign ? (x => onAssign(x)) : undefined}>
        <button
          type="button"
          data-req={r.id}
          onClick={() => onOpen(r)}
          aria-label={label}
          className={[
            "relative z-10 flex h-14 min-w-0 flex-col justify-center overflow-hidden border text-left transition",
            "hover:z-20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            kind.bar,
            contL ? "rounded-l-none" : "rounded-l-lg", contR ? "rounded-r-none" : "rounded-r-lg",
            size === "xs" ? "items-center px-1" : "px-2.5",
            done ? "border-dashed opacity-80" : "",
            r.id === highlightId ? HIGHLIGHT : "",
          ].join(" ")}
          style={{
            gridColumn: `${a + 2} / ${b + 3}`, gridRow: lane + 2, alignSelf: "center",
            marginLeft: contL ? 0 : 3, marginRight: contR ? 0 : 3,
          }}
        >
          {size === "xs" ? (
            <span className="relative flex flex-col items-center gap-0.5 text-[11px] font-semibold leading-none tabular-nums">
              {hasAlert ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> : done ? <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /> : ord ? <span>{ord}</span> : null}
              <span>{fmtHM(rs)}</span>
            </span>
          ) : (
            <span className="relative flex min-w-0 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-1.5">
                {done && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />}
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold leading-5 tracking-tight">{r.project?.company_name ?? "Projeto removido"}</span>
                {hasAlert && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] leading-4 opacity-85">
                {ord && <span className="shrink-0 rounded bg-card/75 px-1 text-[10.5px] font-semibold leading-4">{ord}</span>}
                <span className="min-w-0 flex-1 truncate">{city}</span>
                {size === "md" && <span className="shrink-0 tabular-nums">{fmtHM(rs)}</span>}
              </span>
            </span>
          )}
        </button>
      </VisitHover>
    );
  };

  const rowStyle = (lanes: number): CSSProperties => ({ gridTemplateColumns: template, gridTemplateRows: `${PAD}px repeat(${lanes}, ${LANE}px) ${PAD}px` });

  /* ─── linhas dos técnicos ─── */
  const techRows = techs.map(t => {
    const mine = approved.filter(r => techniciansOf(r).some(x => x.id === t.id)).sort((x, y) => +periodOf(x).start - +periodOf(y).start);
    const placed = pack(mine.map(r => ({ r, s: span(r) })).filter(x => x.s).map(x => ({ r: x.r, ...x.s! })));
    const lanes = Math.max(1, ...placed.map(p => p.lane + 1));
    const load = loads.get(t.id);
    const tone = load ? loadTone(load.busy, load.workdays) : null;

    const away = load?.vacation?.now ? load.vacation.vacation : null;
    const vacs = vacationSpans(t);
    const location = away ? `Até ${fmtDM(dateOfYmd(away.end_date))}`
      : load?.current ? placeLabel(placeOf(load.current))
      : load?.next ? `Próxima em ${fmtDM(visitDays(load.next).first)}` : "Sem visitas agendadas";
    return (
      <div key={t.id} className="relative grid border-b border-border/70 last:border-b-0" style={rowStyle(lanes)}>
        {background}
        <div className="sticky left-0 z-20 flex items-center gap-2.5 border-r border-border bg-card px-3 sm:px-3.5" style={{ gridColumn: 1, gridRow: "1 / -1" }} title={t.full_name}>
          <TechAvatar tech={t} size="h-8 w-8 text-[11px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-[18px]">{t.full_name}</p>
            <p className="flex min-w-0 items-center gap-1.5 text-xs leading-[18px] text-muted-foreground">
              {!isMobile && (away
                ? <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-sky-800 dark:text-sky-200"><Palmtree aria-hidden className="h-3 w-3" />De férias</span>
                : load?.current
                ? <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-sky-800 dark:text-sky-200"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-sky-500" />Em campo</span>
                : <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Livre hoje</span>)}
              <span className="min-w-0 truncate">{location}</span>
            </p>
            {load && loadUntil && tone && (
              <div className="mt-1 flex items-center gap-2">
                <span role="img" aria-label={`${load.busy} de ${load.workdays} dias úteis ocupados até ${fmtDM(loadUntil)}`} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className={`block h-1 rounded-full ${tone.bar}`} style={{ width: `${load.workdays ? Math.round((load.busy / load.workdays) * 100) : 0}%` }} />
                </span>
                <span className={`min-w-4 text-right text-xs font-semibold tabular-nums ${load.free === 0 ? "text-red-600 dark:text-red-400" : tone.text}`} title={`${load.free} dia(s) útil(eis) livre(s) até ${fmtDM(loadUntil)}`}>{load.free}</span>
              </div>
            )}
          </div>
        </div>
        {vacs.map(x => vacationBlock(x.v, x.a, x.b, placed.some(p => p.a <= x.b && p.b >= x.a)))}
        {placed.map(p => bar(p.r, p.a, p.b, p.lane, p.contL, p.contR))}
        {placed.length === 0 && vacs.length === 0 && (
          <p className="pointer-events-none self-center px-3 text-[11px] italic text-muted-foreground" style={{ gridColumn: "2 / -1", gridRow: 2 }}>Livre no período</p>
        )}
      </div>
    );
  });

  /* ─── cabeçalho: semanas e dias ─── */
  const header = (
    <div className="grid border-b border-border" style={{ gridTemplateColumns: template, gridTemplateRows: weeks > 1 ? "32px 48px" : "48px" }}>
      <div className="sticky left-0 z-20 flex items-end justify-between gap-2 border-r border-border bg-card px-3 pb-2.5 sm:px-3.5" style={{ gridColumn: 1, gridRow: weeks > 1 ? "1 / 3" : 1 }}>
        <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Técnico</span>
      </div>
      {weeks > 1 && Array.from({ length: weeks }, (_, w) => {
        const a = days[w * 7], b = days[w * 7 + 6];
        const hol = days.slice(w * 7, w * 7 + 7).flatMap(d => (holidays.get(dateKey(d)) ?? []).map(h => ({ d, h })))[0];
        return (
          <div key={w} className="flex min-w-0 items-center justify-between gap-2 overflow-hidden whitespace-nowrap border-b border-l border-border px-2.5 text-xs" style={{ gridColumn: `${w * 7 + 2} / ${w * 7 + 9}`, gridRow: 1 }}>
            <span className="font-semibold text-foreground/80">{fmtWeekRange(a, b)}</span>
            {hol && <span className="min-w-0 truncate text-rose-700 dark:text-rose-300" title={hol.h.name}>{fmtDM(hol.d)} {hol.h.name}</span>}
          </div>
        );
      })}
      {days.map((d, i) => {
        const hol = holidays.get(dateKey(d));
        const isToday = i === todayIdx;
        const cell = (
          <div key={+d} style={{ gridColumn: i + 2, gridRow: weeks > 1 ? 2 : 1 }}
            className={`flex min-w-0 flex-col items-center justify-center gap-px ${i % 7 === 0 ? "border-l border-border" : "border-l border-border/40"} ${isToday ? "bg-primary/[0.05]" : hol ? "bg-rose-500/[0.05]" : isWeekend(d) ? "bg-muted/40" : ""} ${hol ? "cursor-help" : isWeekend(d) ? "text-muted-foreground" : ""}`}>
            <span className={`text-[11px] leading-[13px] ${isToday ? "font-semibold text-primary" : hol ? "font-semibold text-rose-700 dark:text-rose-300" : "text-muted-foreground"}`}>{weights[i] * pxPerFr < 26 ? WD_SHORT[d.getDay()][0] : WD_SHORT[d.getDay()]}</span>
            {isToday
              ? <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1 text-[13px] font-semibold tabular-nums text-primary-foreground">{d.getDate()}</span>
              : <span className={`text-sm font-semibold leading-[18px] tabular-nums ${hol ? "text-rose-700 dark:text-rose-300" : ""}`}>{d.getDate()}</span>}
          </div>
        );
        return hol ? <HolidayTooltip key={+d} holidays={hol}>{cell}</HolidayTooltip> : cell;
      })}
    </div>
  );

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <div style={{ minWidth }}>
        {header}
        {techRows}
        {techs.length === 0 && (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <UserRoundCog className="h-4 w-4" />Nenhum técnico para mostrar. Cadastre os técnicos em Aprovação de agenda › Técnicos.
          </div>
        )}
      </div>
    </div>
  );
}
