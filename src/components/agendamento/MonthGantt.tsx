import { useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import { AlertTriangle, CalendarCheck, Check, Palmtree, UserRoundCog } from "lucide-react";
import { dateOfYmd, fmtVacation, periodOf, techniciansOf, type ImplantationRequest, type Technician } from "@/lib/implantationScheduling";
import { dateKey, type Holiday } from "@/lib/holidays";
import {
  HATCH, VISIT_KIND, WD_SHORT, dayDiff, fmtDM, fmtDayRange, fmtHM, isWeekend, loadTone, placeLabel, placeOf, plusDays,
  startOfDay, visitDays, visitKindOf, visitOrdinal,
  type AgendaAlert, type TechLoad,
} from "@/lib/agendaTecnica";
import { TechAvatar } from "./AgendaShared";
import { HolidayTooltip } from "./HolidaysDialog";
import { VisitHover } from "./VisitHoverCard";

const HIGHLIGHT = "z-30 ring-2 ring-amber-400 ring-offset-1 ring-offset-background";
const DAY_MIN = 36;
const NAME = 196;

/** Distribui barras em "pistas" para não se sobreporem na mesma linha. */
function pack<T extends { a: number; b: number }>(items: T[]) {
  const ends: number[] = [];
  return [...items].sort((x, y) => x.a - y.a || y.b - x.b).map(it => {
    let lane = 0;
    while (ends[lane] !== undefined && ends[lane] >= it.a) lane++;
    ends[lane] = it.b;
    return { ...it, lane };
  });
}

/**
 * Mês inteiro na horizontal: técnicos nas linhas, dias nas colunas, visitas como
 * barras que atravessam os dias que ocupam. Faz par com `TechnicianTimeline`.
 * Com `start`, mostra `length` dias a partir dele no lugar do mês. Com `focus`, esse dia abre encostado na
 * coluna dos técnicos (ex.: hoje) e os dias antes dele ficam na rolagem, à esquerda.
 */
export function MonthGantt({
  month, start, length, focus, techs, approved, loads, loadUntil, holidays, alertsByRequest, highlightId, onOpen,
}: {
  month: Date;
  start?: Date;
  length?: number;
  focus?: Date;
  techs: Technician[];
  approved: ImplantationRequest[];
  loads: Map<string, TechLoad>;
  loadUntil: Date | null;
  holidays: Map<string, Holiday[]>;
  alertsByRequest: Map<string, AgendaAlert[]>;
  highlightId: string | null;
  onOpen: (r: ImplantationRequest) => void;
}) {
  const windowed = !!start;
  const m0 = startOfDay(start ?? new Date(month.getFullYear(), month.getMonth(), 1));
  const daysInMonth = windowed ? length ?? 31 : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const periodo = windowed ? "período" : "mês";
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => plusDays(m0, i)), [+m0, daysInMonth]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = startOfDay(new Date());
  const todayIdx = dayDiff(m0, today);

  const template = `${NAME}px repeat(${daysInMonth}, minmax(${DAY_MIN}px, 1fr))`;
  const minWidth = NAME + daysInMonth * DAY_MIN;
  // com `focus`, a parte visível cabe os dias a partir dele; os anteriores ficam na rolagem
  const focusIdx = focus ? Math.min(Math.max(0, dayDiff(m0, focus)), daysInMonth - 1) : 0;
  const width = focusIdx > 0 ? `calc(${NAME}px + (100% - ${NAME}px) * ${daysInMonth / (daysInMonth - focusIdx)})` : undefined;
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = ((el.scrollWidth - NAME) / daysInMonth) * focusIdx;
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  // posição da visita (índice do primeiro e do último dia do mês que ela ocupa)
  const span = (r: ImplantationRequest) => {
    const { first, last } = visitDays(r);
    const a = dayDiff(m0, first), b = dayDiff(m0, last);
    if (b < 0 || a > daysInMonth - 1) return null;
    return { a: Math.max(0, a), b: Math.min(daysInMonth - 1, b), contL: a < 0, contR: b > daysInMonth - 1 };
  };

  /* ─── fundo das colunas (fim de semana, feriado, hoje) ─── */
  const background = days.map((d, i) => {
    const hol = holidays.get(dateKey(d));
    const isToday = i === todayIdx;
    return (
      <div key={`bg${i}`} aria-hidden
        style={{ gridColumn: i + 2, gridRow: "1 / -1" }}
        className={`border-l border-border/40 ${isToday ? "border-x border-primary/25 bg-primary/[0.05]" : hol ? "bg-rose-500/[0.05]" : isWeekend(d) ? "bg-muted/40" : ""}`} />
    );
  });

  /* ─── cabeçalho: dia da semana + número do dia ─── */
  const header = (
    <div className="grid border-b border-border bg-card" style={{ gridTemplateColumns: template, gridTemplateRows: "56px" }}>
      <div className="sticky left-0 z-20 flex items-end justify-start border-r border-border bg-card px-4 pb-2.5"
        style={{ gridColumn: 1, gridRow: 1 }}>
        <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Técnico</span>
      </div>
      {days.map((d, i) => {
        const hol = holidays.get(dateKey(d));
        const isToday = i === todayIdx;
        const cell = (
          <div key={+d} style={{ gridColumn: i + 2, gridRow: 1 }}
            className={`flex min-w-0 flex-col items-center justify-center gap-0.5 border-l border-border/40 ${isToday ? "bg-primary/[0.05]" : hol ? "bg-rose-500/[0.05]" : isWeekend(d) ? "bg-muted/40" : ""} ${hol ? "cursor-help" : ""}`}>
            <span className={`text-[10px] leading-[12px] font-medium uppercase ${isToday ? "text-primary" : hol ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"}`}>
              {hol ? "Fer" : WD_SHORT[d.getDay()].slice(0, 3)}
            </span>
            {isToday
              ? <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[12.5px] font-semibold tabular-nums text-primary-foreground">{d.getDate()}</span>
              : <span className={`text-[13px] font-semibold leading-[18px] tabular-nums ${hol ? "text-rose-700 dark:text-rose-300" : isWeekend(d) ? "text-muted-foreground" : ""}`}>{d.getDate()}</span>}
          </div>
        );
        return hol ? <HolidayTooltip key={+d} holidays={hol}>{cell}</HolidayTooltip> : cell;
      })}
    </div>
  );

  /* ─── barra de visita ─── */
  const bar = (r: ImplantationRequest, a: number, b: number, lane: number, contL: boolean, contR: boolean) => {
    const kind = VISIT_KIND[visitKindOf(r.visit_purpose)];
    const alerts = alertsByRequest.get(r.id) ?? [];
    const done = r.status === "aprovada" && !!r.attendance;
    const city = placeLabel(placeOf(r));
    const ord = visitOrdinal(r.visit_purpose);
    const span = b - a + 1;
    const narrow = span === 1;
    const label = `${r.project?.company_name ?? "Projeto removido"}, ${r.visit_purpose}, ${city}, ${fmtDayRange(visitDays(r).first, visitDays(r).last)}, ${fmtHM(periodOf(r).start)}${done ? ". Concluída" : ""}${alerts.length ? `. Atenção: ${alerts.map(x => x.title).join("; ")}` : ""}`;

    return (
      <VisitHover key={`${r.id}-${lane}`} request={r} alerts={alerts} onOpen={onOpen}>
        <button
          type="button"
          data-req={r.id}
          onClick={() => onOpen(r)}
          aria-label={label}
          className={[
            "relative z-10 flex h-[54px] min-w-0 overflow-hidden border text-left transition hover:z-20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            kind.bar,
            contL ? "rounded-l-none" : "rounded-l-lg", contR ? "rounded-r-none" : "rounded-r-lg",
            done ? "border-dashed opacity-75" : "",
            r.id === highlightId ? HIGHLIGHT : "",
            narrow ? "items-center justify-center" : "flex-col justify-center px-2.5",
          ].join(" ")}
          style={{
            gridColumn: `${a + 2} / ${b + 3}`, gridRow: lane + 1, alignSelf: "center",
            marginLeft: contL ? 0 : 2, marginRight: contR ? 0 : 2,
          }}
        >
          {narrow ? (
            <span className="flex flex-col items-center gap-0.5 text-[10.5px] font-semibold tabular-nums">
              {alerts.length ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> : done ? <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /> : ord ? <span>{ord}</span> : null}
            </span>
          ) : (
            <>
              <span className="flex min-w-0 items-center gap-1.5">
                {done && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />}
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 tracking-tight">{r.project?.company_name ?? "Projeto removido"}</span>
                {alerts.length > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 opacity-85">
                {ord && <span className="shrink-0 rounded bg-card/75 px-1 text-[10.5px] font-semibold leading-4">{ord}</span>}
                <span className="min-w-0 flex-1 truncate">{city}</span>
              </span>
            </>
          )}
        </button>
      </VisitHover>
    );
  };

  /* ─── uma linha por técnico ─── */
  const techRows = techs.map(t => {
    const mine = approved.filter(r => techniciansOf(r).some(x => x.id === t.id)).sort((x, y) => +periodOf(x).start - +periodOf(y).start);
    const placed = pack(mine.map(r => ({ r, s: span(r) })).filter(x => x.s).map(x => ({ r: x.r, ...x.s! })));
    const lanes = Math.max(1, ...placed.map(p => p.lane + 1));
    const load = loads.get(t.id);
    const tone = load ? loadTone(load.busy, load.workdays) : null;
    const freeAll = load && load.workdays > 0 && load.busy === 0 && load.off === 0;
    // férias que caem no mês: faixa listrada atrás das visitas
    const vacs = (t.vacations ?? [])
      .map(v => ({ v, a: dayDiff(m0, dateOfYmd(v.start_date)), b: dayDiff(m0, dateOfYmd(v.end_date)) }))
      .filter(x => x.b >= 0 && x.a <= daysInMonth - 1)
      .map(x => ({ v: x.v, a: Math.max(0, x.a), b: Math.min(daysInMonth - 1, x.b) }));

    return (
      <div key={t.id} className="relative grid border-b border-border/70 last:border-b-0"
        style={{ gridTemplateColumns: template, gridTemplateRows: `repeat(${lanes}, 70px)` as CSSProperties["gridTemplateRows"] }}>
        {background}
        <div className="sticky left-0 z-20 flex items-center gap-2.5 border-r border-border bg-card px-4"
          style={{ gridColumn: 1, gridRow: "1 / -1" }} title={t.full_name}>
          <TechAvatar tech={t} size="h-9 w-9 text-[12px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold leading-5">{t.full_name}</p>
            {load && loadUntil
              ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className={`text-[11.5px] leading-4 ${freeAll ? "text-emerald-700 dark:text-emerald-300 font-medium" : tone?.text ?? "text-muted-foreground"}`}
                    title={`${load.busy} de ${load.workdays} dias úteis em campo até ${fmtDM(loadUntil)} · ${load.free} livre${load.free === 1 ? "" : "s"}`}>
                    {freeAll ? `Livre no ${periodo}` : load.workdays === 0 && load.off > 0 ? "Sem dias disponíveis" : `${load.busy} de ${load.workdays} dias`}
                  </span>
                  {tone && load.workdays > 0 && !freeAll && (
                    <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className={`block h-1 rounded-full ${tone.bar}`} style={{ width: `${Math.round((load.busy / load.workdays) * 100)}%` }} />
                    </span>
                  )}
                </div>
              )
              : <p className="text-[11.5px] leading-4 text-muted-foreground">Sem visitas no {periodo}</p>}
            {vacs.length > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium leading-4 text-sky-800 dark:text-sky-200">
                <Palmtree aria-hidden className="h-3 w-3 shrink-0" /><span className="truncate">Férias {vacs.map(x => fmtVacation(x.v)).join(", ")}</span>
              </p>
            )}
          </div>
        </div>
        {vacs.map(({ v, a, b }) => (
          <div key={`vac-${v.id}`} role="img" aria-label={`Férias de ${fmtVacation(v)}`} title={`Férias de ${fmtVacation(v)}${v.note ? ` · ${v.note}` : ""}`}
            className="relative z-[5] flex items-center justify-center overflow-hidden border-x border-sky-500/40 text-sky-800 dark:text-sky-200"
            style={{ gridColumn: `${a + 2} / ${b + 3}`, gridRow: "1 / -1", ...HATCH.vacation }}>
            <Palmtree className="h-3.5 w-3.5 shrink-0" />
          </div>
        ))}
        {placed.map(p => bar(p.r, p.a, p.b, p.lane, p.contL, p.contR))}
        {placed.length === 0 && vacs.length === 0 && load && loadUntil && (
          <p className="pointer-events-none self-center px-3 text-[11px] italic text-muted-foreground"
            style={{ gridColumn: `${focusIdx + 2} / -1`, gridRow: 1 }}>
            {freeAll
              ? <span className="inline-flex items-center gap-1.5"><CalendarCheck className="h-3.5 w-3.5" />{windowed ? "Período inteiro livre" : "Mês inteiro livre"}</span>
              : "Livre no período exibido"}
          </p>
        )}
      </div>
    );
  });

  return (
    <section aria-label={windowed ? `Calendário de ${fmtDM(days[0])} a ${fmtDM(days[days.length - 1])}` : `Mês inteiro, ${month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
      className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div ref={scroller} className="overflow-x-auto [scrollbar-color:hsl(var(--primary)/0.45)_hsl(var(--muted))]">
        <div style={{ minWidth, width }}>
          {header}
          {techRows}
          {techs.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <UserRoundCog className="h-4 w-4" />Nenhum técnico para mostrar.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
