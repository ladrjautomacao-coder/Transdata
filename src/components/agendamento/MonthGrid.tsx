import { AlertTriangle, CalendarDays, CalendarOff, Check, Clock, MapPin } from "lucide-react";
import { periodOf, techniciansOf, type ImplantationRequest } from "@/lib/implantationScheduling";
import { HOLIDAY_SCOPE_LABEL, dateKey, type Holiday } from "@/lib/holidays";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  HATCH, MONTH_SHORT, VISIT_KIND, VISIT_KIND_ORDER, coversDay, dayDiff, dayTitle, fmtHM, isWeekend, mondayOf,
  placeLabel, placeOf, plusDays, specialDaysOf, startOfDay, visitDays, visitKindOf, visitOrdinal, visitSummary,
  type AgendaAlert,
} from "@/lib/agendaTecnica";
import { TechAvatar } from "./AgendaShared";
import { HolidayTooltip } from "./HolidaysDialog";
import { AgendaLegend } from "./AgendaPanels";
import { KindChip, VisitHover, VisitStatePill } from "./VisitHoverCard";

const HIGHLIGHT = "z-30 ring-4 ring-amber-400 ring-offset-2 ring-offset-background animate-pulse";
const MAX_LANES = 4;
const HEAD = 38, LANE_H = 30;
const WD_HEAD = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

const holidayText = (hs: Holiday[]) => hs.map(h => `${HOLIDAY_SCOPE_LABEL[h.scope]} · ${h.name}${h.optional ? " (ponto facultativo)" : ""}${h.scope === "municipal" ? ` (${h.city}/${h.state})` : h.scope === "estadual" ? ` (${h.state})` : ""}`).join(" · ");

/**
 * Grade do mês com as visitas em faixas contínuas por semana (cor por tipo de visita,
 * pendentes tracejadas, trechos em fim de semana/feriado hachurados).
 * Também usada na Área do Implantador, só com as visitas do técnico.
 */
export function MonthGrid({ month, list, onOpen, onAssign, highlightId, selected, onSelect, holidays, custom = [], alertsByRequest, hint }: {
  month: Date;
  list: ImplantationRequest[];
  onOpen: (r: ImplantationRequest) => void;
  /** Presente = clique numa pendente abre a avaliação. */
  onAssign?: (r: ImplantationRequest) => void;
  highlightId: string | null;
  selected: Date;
  onSelect: (d: Date) => void;
  holidays: Map<string, Holiday[]>;
  custom?: Holiday[];
  alertsByRequest?: Map<string, AgendaAlert[]>;
  hint?: string;
}) {
  const isMobile = useIsMobile();
  const m0 = new Date(month.getFullYear(), month.getMonth(), 1);
  const first = mondayOf(m0);
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => plusDays(first, w * 7 + i)));
  const today = startOfDay(new Date()).getTime();
  const sel = startOfDay(selected).getTime();
  const kinds = VISIT_KIND_ORDER.filter(k => list.some(r => r.status !== "pendente" && visitKindOf(r.visit_purpose) === k));

  const dayCell = (d: Date, i: number, extra: number, compact: boolean, wi: number) => {
    const inM = d.getMonth() === m0.getMonth();
    const isToday = d.getTime() === today, isSel = d.getTime() === sel;
    const dayList = list.filter(r => coversDay(r, d));
    const hol = holidays.get(dateKey(d));
    const showMonth = d.getDate() === 1 || (wi === 0 && i === 0);
    const cell = (
      <div
        key={+d}
        style={hol ? HATCH.holiday : undefined}
        role="button"
        tabIndex={0}
        aria-label={`${dayTitle(d)}${hol ? ` · feriado: ${hol.map(h => h.name).join(", ")}` : ""}${dayList.length ? ` · ${dayList.length} visita${dayList.length > 1 ? "s" : ""}` : ""}`}
        aria-pressed={isSel}
        onClick={() => onSelect(d)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(d); } }}
        className={`relative cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${i ? "border-l border-border/60" : ""} ${isSel && !isToday ? "ring-2 ring-inset ring-primary/50" : ""} ${isToday ? "bg-primary/[0.07]" : i >= 5 ? "bg-muted/40 hover:bg-muted/60" : "hover:bg-muted/40"}`}
      >
        <div className={`flex min-w-0 items-center gap-1.5 ${compact ? "justify-center pt-1.5" : "px-2.5 pt-2.5"}`}>
          <span className={`shrink-0 text-[13px] leading-5 tabular-nums ${isToday ? "flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1 font-semibold text-primary-foreground" : hol ? "font-semibold text-rose-700 dark:text-rose-300" : inM ? "font-semibold text-foreground" : "text-muted-foreground/70"}`}>
            {d.getDate()}{!compact && showMonth && !isToday ? <span className="font-normal text-muted-foreground"> {MONTH_SHORT[d.getMonth()]}</span> : null}
          </span>
          {!compact && isToday && <span className="text-xs font-semibold text-primary">Hoje</span>}
          {!compact && hol && <span className="min-w-0 truncate text-xs text-rose-700 dark:text-rose-300">{hol[0].name}{hol.length > 1 ? ` +${hol.length - 1}` : ""}</span>}
        </div>
        {compact && dayList.length > 0 && (
          <div className="mt-1 flex justify-center gap-0.5">
            {dayList.slice(0, 3).map(r => <span key={r.id} className={`h-1.5 w-1.5 rounded-full ${r.status === "pendente" ? "bg-amber-500" : VISIT_KIND[visitKindOf(r.visit_purpose)].dot}`} />)}
          </div>
        )}
        {!compact && extra > 0 && <span className="absolute bottom-1.5 left-2.5 text-[11px] font-medium text-muted-foreground">+{extra} mais</span>}
      </div>
    );
    return hol && !compact ? <HolidayTooltip key={+d} holidays={hol}>{cell}</HolidayTooltip> : cell;
  };

  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="grid grid-cols-7 bg-card">
        {WD_HEAD.map((x, i) => (
          <div key={x} className={`py-2.5 text-[13px] text-muted-foreground ${isMobile ? "text-center" : "px-3"} ${i ? "border-l border-border/60" : ""} ${i >= 5 ? "bg-muted/40" : ""}`}>{isMobile ? x[0].toUpperCase() : x}</div>
        ))}
      </div>
      {weeks.map((wk, wi) => {
        const w0 = wk[0], wEnd = plusDays(w0, 7);
        if (isMobile) {
          return <div key={+w0} className="grid h-14 grid-cols-7 border-t border-border/60">{wk.map((d, i) => dayCell(d, i, 0, true, wi))}</div>;
        }
        // faixas contínuas: cada visita ocupa uma "pista" na semana
        const inWeek = list
          .filter(r => periodOf(r).start < wEnd && +visitDays(r).last >= +w0)
          .sort((a, b) => +periodOf(a).start - +periodOf(b).start || +periodOf(b).end - +periodOf(a).end);
        const laneEnds: number[] = [];
        const placed: { r: ImplantationRequest; a: number; b: number; lane: number }[] = [];
        const hiddenPerDay = Array(7).fill(0);
        inWeek.forEach(r => {
          const { first: f, last: l } = visitDays(r);
          const a = Math.max(0, dayDiff(w0, f)), b = Math.min(6, dayDiff(w0, l));
          let lane = 0;
          while (laneEnds[lane] !== undefined && laneEnds[lane] >= a) lane++;
          if (lane >= MAX_LANES) { for (let k = a; k <= b; k++) hiddenPerDay[k]++; return; }
          laneEnds[lane] = b;
          placed.push({ r, a, b, lane });
        });
        const height = Math.max(64, HEAD + laneEnds.length * LANE_H + (hiddenPerDay.some(Boolean) ? 22 : 8));
        return (
          <div key={+w0} className="relative grid grid-cols-7 border-t border-border/60" style={{ height }}>
            {wk.map((d, i) => dayCell(d, i, hiddenPerDay[i], false, wi))}
            {inWeek.length === 0 && (
              <p className="pointer-events-none absolute left-3 text-xs text-muted-foreground" style={{ top: HEAD + 2 }}>Nenhuma visita nesta semana</p>
            )}
            {placed.map(({ r, a, b, lane }) => {
              const { start } = periodOf(r);
              const { first: f, last: l } = visitDays(r);
              const contL = +f < +w0, contR = +l >= +wEnd;
              const pendingReq = r.status === "pendente";
              const kind = VISIT_KIND[visitKindOf(r.visit_purpose)];
              const techs = techniciansOf(r);
              const alerts = alertsByRequest?.get(r.id) ?? [];
              const done = r.status === "aprovada" && !!r.attendance;
              const ord = visitOrdinal(r.visit_purpose);
              const span = b - a + 1;
              // trechos em fim de semana/feriado desta semana
              const special = pendingReq ? [] : specialDaysOf(r, custom).map(s => ({ i: dayDiff(w0, s.date), hol: !!s.holiday })).filter(s => s.i >= a && s.i <= b);
              const runs: { from: number; to: number; hol: boolean; we: boolean }[] = [];
              for (const s of special) {
                const prev = runs[runs.length - 1];
                if (prev && prev.to === s.i - 1) { prev.to = s.i; prev.hol = prev.hol || s.hol; prev.we = prev.we || !s.hol; }
                else runs.push({ from: s.i, to: s.i, hol: s.hol, we: !s.hol });
              }
              const allSpecial = runs.length === 1 && runs[0].from === a && runs[0].to === b;
              // o texto da barra não fica por baixo dos trechos hachurados das pontas
              const lead = !allSpecial && runs[0]?.from === a ? ((runs[0].to - runs[0].from + 1) / span) * 100 : 0;
              const lastRun = runs[runs.length - 1];
              const trail = !allSpecial && lastRun?.to === b && lastRun.from > a ? ((lastRun.to - lastRun.from + 1) / span) * 100 : 0;
              return (
                <VisitHover key={r.id} request={r} alerts={alerts} onOpen={onOpen} onAssign={onAssign}>
                  <button
                    type="button"
                    data-req={r.id}
                    onClick={() => (pendingReq && onAssign ? onAssign(r) : onOpen(r))}
                    aria-label={`${r.project?.company_name}, ${visitSummary(r)}${pendingReq ? ", pendente de aprovação" : ""}`}
                    className={[
                      "absolute z-10 flex h-[26px] items-center overflow-hidden border text-left text-xs transition hover:z-20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      pendingReq ? "border-[1.5px] border-dashed border-amber-500/80 bg-amber-500/[0.06] text-amber-950 dark:text-amber-100" : kind.bar,
                      contL ? "rounded-l-none border-l-0" : "rounded-l-md", contR ? "rounded-r-none border-r-0" : "rounded-r-md",
                      done ? "opacity-70" : "",
                      alerts.some(x => x.kind === "conflito") ? "ring-2 ring-destructive" : alerts.some(x => x.kind === "sem_folga") ? "ring-2 ring-amber-500" : "",
                      r.id === highlightId ? HIGHLIGHT : "",
                    ].join(" ")}
                    style={{
                      top: HEAD + lane * LANE_H,
                      left: `calc(${(a / 7) * 100}% + ${contL ? 0 : 4}px)`,
                      width: `calc(${(span / 7) * 100}% - ${(contL ? 0 : 4) + (contR ? 0 : 4)}px)`,
                      ...(pendingReq ? HATCH.pending : {}),
                    }}
                  >
                    {runs.map(run => (
                      <span key={run.from} aria-hidden className="pointer-events-none absolute inset-y-0 flex items-center pl-1.5"
                        style={{ left: `${((run.from - a) / span) * 100}%`, width: `${((run.to - run.from + 1) / span) * 100}%`, ...HATCH.special }}>
                        {!allSpecial && (
                          <span className="flex items-center gap-1 truncate rounded bg-card/85 px-1 text-[11px] font-semibold leading-4 text-lime-900 dark:text-lime-100">
                            <AlertTriangle className="h-3 w-3 shrink-0" />{run.hol && run.we ? "Fds + feriado" : run.hol ? "Feriado" : "Fim de semana"}
                          </span>
                        )}
                      </span>
                    ))}
                    <span className="relative flex min-w-0 flex-1 items-center gap-1.5 px-1.5" style={{ marginLeft: `${lead}%`, marginRight: `${trail}%` }}>
                      {techs.length > 0
                        ? <span className="flex shrink-0 -space-x-1">{techs.map(t => <TechAvatar key={t.id} tech={t} size="h-[18px] w-[18px] text-[8px]" />)}</span>
                        : pendingReq && <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-dashed border-amber-600 text-[10px] font-semibold">?</span>}
                      {!contL && <span className="shrink-0 tabular-nums opacity-90">{fmtHM(start)}</span>}
                      {done && <Check className="h-3 w-3 shrink-0" />}
                      <span className="min-w-0 truncate font-semibold">{r.project?.company_name ?? "Projeto removido"}</span>
                      {span > 1 && <span className="min-w-0 truncate opacity-75">{pendingReq ? VISIT_KIND[visitKindOf(r.visit_purpose)].label : placeLabel(placeOf(r))}</span>}
                      <span className="flex-1" />
                      {pendingReq
                        ? <span className="shrink-0 rounded bg-amber-500/20 px-1.5 text-[10px] font-semibold leading-4">{span > 2 ? "Pendente" : "?"}</span>
                        : ord && <span className="shrink-0 rounded bg-card/75 px-1 text-[11px] font-semibold leading-4">{ord}</span>}
                      {(allSpecial || alerts.length > 0) && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                    </span>
                  </button>
                </VisitHover>
              );
            })}
          </div>
        );
      })}
      <AgendaLegend kinds={kinds} pending={list.some(r => r.status === "pendente")}
        hint={hint ?? (isMobile ? "Toque num dia para ver a agenda dele" : "Passe o mouse numa visita para ver o resumo · clique num dia para ver a agenda dele")} />
    </div>
  );
}

/** Visitas de um dia (janela no computador, lista abaixo do calendário no celular). */
export function DayVisits({ list, selected, holidays, onOpen, onAssign, inDialog = false }: {
  list: ImplantationRequest[]; selected: Date; holidays: Map<string, Holiday[]>;
  onOpen: (r: ImplantationRequest) => void; onAssign?: (r: ImplantationRequest) => void; inDialog?: boolean;
}) {
  const ofDay = list.filter(r => coversDay(r, selected)).sort((a, b) => +periodOf(a).start - +periodOf(b).start);
  const hol = holidays.get(dateKey(selected));
  return (
    <section className={inDialog ? "" : "overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"}>
      <div className={`flex items-center gap-2 border-b border-border/60 py-3 pl-4 ${inDialog ? "pr-12" : "pr-4"}`}>
        <CalendarDays className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{dayTitle(selected)}</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">{ofDay.length ? `${ofDay.length} visita${ofDay.length > 1 ? "s" : ""}` : ""}</span>
      </div>
      {(hol || isWeekend(selected)) && (
        <p className="flex items-center gap-1.5 border-b border-border/60 px-4 py-2 text-[11px] font-medium text-rose-700 dark:text-rose-300" style={hol ? HATCH.holiday : undefined}>
          <CalendarOff className="h-3.5 w-3.5 shrink-0" />{hol ? holidayText(hol) : "Fim de semana"}
        </p>
      )}
      {ofDay.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma visita neste dia.</p>
      ) : (
        <ul>
          {ofDay.map(r => {
            const pendingReq = r.status === "pendente";
            const open = () => (pendingReq && onAssign ? onAssign(r) : onOpen(r));
            return (
              <li key={r.id} role="button" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === "Enter") open(); }}
                className="flex cursor-pointer gap-3 border-t border-border/60 px-4 py-3 transition-colors first:border-t-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                <span className={`w-[3px] shrink-0 rounded-full ${pendingReq ? "bg-amber-500" : VISIT_KIND[visitKindOf(r.visit_purpose)].dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.project?.company_name ?? "Projeto removido"}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5"><KindChip purpose={r.visit_purpose} /><VisitStatePill request={r} /></p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{visitSummary(r)}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{placeLabel(placeOf(r))}</span>
                  </p>
                </div>
                <span className="flex shrink-0 -space-x-1.5 self-start">{techniciansOf(r).map(t => <TechAvatar key={t.id} tech={t} size="h-6 w-6 text-[9px]" />)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
