import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AlertTriangle, ArrowUp, Check, Inbox, UserRoundCog } from "lucide-react";
import { periodOf, techniciansOf, type ImplantationRequest, type Technician } from "@/lib/implantationScheduling";
import { dateKey, type Holiday } from "@/lib/holidays";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  HATCH, VISIT_KIND, WD_SHORT, dayDiff, distanceKm, fmtDM, fmtDayRange, fmtHM, fmtWeekRange, isWeekend, loadTone,
  placeLabel, placeOf, plusDays, specialDaysOf, startOfDay, visitDays, visitKindOf, visitOrdinal,
  type AgendaAlert, type CityIndex, type TechLoad,
} from "@/lib/agendaTecnica";
import { TechAvatar } from "./AgendaShared";
import { HolidayTooltip } from "./HolidaysDialog";
import { VisitHover } from "./VisitHoverCard";

export interface TimelineSuggestion { techId: string; request: ImplantationRequest }

const HIGHLIGHT = "z-30 ring-4 ring-amber-400 ring-offset-2 ring-offset-background animate-pulse";
const PAD = 11, LANE = 52;
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
  start, weeks, techs, approved, pending, loads, loadUntil, holidays, custom, index, alertsByRequest, suggestions,
  highlightId, showTravel, onOpen, onAssign,
}: {
  start: Date;
  weeks: number;
  techs: Technician[];
  approved: ImplantationRequest[];
  pending: ImplantationRequest[];
  loads: Map<string, TechLoad>;
  /** Fim da janela de "dias livres" (null quando o período já passou). */
  loadUntil: Date | null;
  holidays: Map<string, Holiday[]>;
  custom: Holiday[];
  index: CityIndex | null;
  alertsByRequest: Map<string, AgendaAlert[]>;
  suggestions: TimelineSuggestion[];
  highlightId: string | null;
  showTravel: boolean;
  onOpen: (r: ImplantationRequest) => void;
  /** Presente = pode avaliar (abre o painel de aprovação, com o técnico sugerido marcado). */
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

  /* ─── fundo das colunas (fim de semana, feriado, hoje, divisão de semana) ─── */
  const background = days.map((d, i) => {
    const hol = holidays.get(dateKey(d));
    const isToday = i === todayIdx;
    const style: CSSProperties = { gridColumn: i + 2, gridRow: "1 / -1", ...(hol ? HATCH.holiday : {}) };
    return (
      <div key={`bg${i}`} aria-hidden style={style}
        className={`${i % 7 === 0 ? "border-l border-border" : "border-l border-border/40"} ${isToday ? "border-x border-primary/25 bg-primary/[0.06]" : isWeekend(d) ? "bg-muted/50" : ""}`} />
    );
  });

  /* ─── barra de visita (aprovada ou pendente) ─── */
  const bar = (r: ImplantationRequest, a: number, b: number, lane: number, contL: boolean, contR: boolean) => {
    const pendingReq = r.status === "pendente";
    const kind = VISIT_KIND[visitKindOf(r.visit_purpose)];
    const { start: rs } = periodOf(r);
    const weight = weightOf(a, b);
    const px = weight * pxPerFr - 6;
    const size: "xs" | "sm" | "md" = px < 64 ? "xs" : px < 120 ? "sm" : "md";
    const ord = visitOrdinal(r.visit_purpose);
    const alerts = alertsByRequest.get(r.id) ?? [];
    const conflict = alerts.some(x => x.kind === "conflito");
    const tight = alerts.some(x => x.kind === "sem_folga");
    const done = r.status === "aprovada" && !!r.attendance;
    const city = placeLabel(placeOf(r));

    // trechos em fim de semana/feriado, dentro da própria barra
    const specialKeys = pendingReq ? new Set<string>() : new Set(specialDaysOf(r, custom).map(s => dateKey(s.date)));
    const runs: { from: number; to: number; hol: boolean; we: boolean }[] = [];
    for (let i = a; i <= b; i++) {
      const k = dateKey(days[i]);
      if (!specialKeys.has(k)) continue;
      const isHol = !isWeekend(days[i]);
      const prev = runs[runs.length - 1];
      if (prev && prev.to === i - 1) { prev.to = i; prev.hol = prev.hol || isHol; prev.we = prev.we || !isHol; }
      else runs.push({ from: i, to: i, hol: isHol, we: !isHol });
    }
    const allSpecial = runs.length === 1 && runs[0].from === a && runs[0].to === b;
    const lastRun = runs[runs.length - 1];
    const lead = !allSpecial && runs[0]?.from === a ? (weightOf(runs[0].from, runs[0].to) / weightOf(a, b)) * 100 : 0;
    const trail = !allSpecial && lastRun?.to === b && lastRun.from > a ? (weightOf(lastRun.from, lastRun.to) / weightOf(a, b)) * 100 : 0;

    const label = `${r.project?.company_name ?? "Projeto removido"}, ${r.visit_purpose}, ${city}, ${fmtDayRange(visitDays(r).first, visitDays(r).last)}, ${fmtHM(rs)}${pendingReq ? ". Pendente de aprovação, sem técnico" : ""}${done ? ". Concluída" : ""}${alerts.length ? `. Alerta: ${alerts.map(x => x.title).join("; ")}` : ""}`;
    const onClick = () => (pendingReq && onAssign ? onAssign(r) : onOpen(r));

    return (
      <VisitHover key={`${r.id}-${lane}`} request={r} alerts={alerts} onOpen={onOpen} onAssign={onAssign ? (x => onAssign(x)) : undefined}>
        <button
          type="button"
          data-req={r.id}
          onClick={onClick}
          aria-label={label}
          className={[
            "relative z-10 flex h-12 min-w-0 flex-col justify-center overflow-hidden border text-left transition",
            "hover:z-20 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pendingReq ? "border-[1.5px] border-dashed border-amber-500/80 bg-amber-500/[0.06] text-amber-950 dark:text-amber-100" : kind.bar,
            contL ? "rounded-l-none" : "rounded-l-lg", contR ? "rounded-r-none" : "rounded-r-lg",
            size === "xs" ? "items-center px-0.5" : "px-2",
            done ? "opacity-70" : "",
            conflict ? "ring-2 ring-destructive" : tight ? "ring-2 ring-amber-500" : "",
            r.id === highlightId ? HIGHLIGHT : "",
          ].join(" ")}
          style={{
            gridColumn: `${a + 2} / ${b + 3}`, gridRow: lane + 2, alignSelf: "center",
            marginLeft: contL ? 0 : 3, marginRight: contR ? 0 : 3,
            ...(pendingReq ? HATCH.pending : {}),
          }}
        >
          {runs.map(run => {
            const left = run.from > a ? (weightOf(a, run.from - 1) / weight) * 100 : 0;
            const w = (weightOf(run.from, run.to) / weight) * 100;
            const segPx = weightOf(run.from, run.to) * pxPerFr;
            return (
              <span key={run.from} aria-hidden className="pointer-events-none absolute inset-y-0 flex items-end justify-center pb-0.5"
                style={{ left: `${left}%`, width: `${w}%`, ...HATCH.special }}>
                {!allSpecial && segPx >= 52 && (
                  <span className="flex items-center gap-0.5 whitespace-nowrap rounded bg-card/80 px-1 text-[10px] font-semibold leading-4 text-lime-900 dark:text-lime-100">
                    <AlertTriangle className="h-2.5 w-2.5" />{run.hol && run.we ? "fds + feriado" : run.hol ? "feriado" : "fds"}
                  </span>
                )}
              </span>
            );
          })}
          {size === "xs" ? (
            <span className="relative flex flex-col items-center gap-0.5 text-[11px] font-semibold leading-none tabular-nums">
              {conflict || tight || allSpecial ? <AlertTriangle className="h-3.5 w-3.5" /> : ord ? <span>{ord}</span> : done ? <Check className="h-3.5 w-3.5" /> : null}
              <span>{fmtHM(rs)}</span>
            </span>
          ) : (
            <span className="relative flex min-w-0 flex-col gap-0.5" style={{ marginLeft: `${lead}%`, marginRight: `${trail}%` }}>
              <span className="flex min-w-0 items-center gap-1.5">
                {done && <Check className="h-3.5 w-3.5 shrink-0" />}
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-4 tracking-tight">{r.project?.company_name ?? "Projeto removido"}</span>
                {pendingReq
                  ? size === "md" && <span className="shrink-0 rounded bg-amber-500/20 px-1.5 text-[10px] font-semibold leading-4">Pendente</span>
                  : ord && <span className="shrink-0 rounded bg-card/75 px-1 text-[11px] font-semibold leading-4">{ord}</span>}
                {allSpecial && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-xs leading-4 opacity-85">
                <span className="min-w-0 flex-1 truncate">{pendingReq ? VISIT_KIND[visitKindOf(r.visit_purpose)].label : city}</span>
                {size === "md" && <span className="shrink-0 tabular-nums">{fmtHM(rs)}</span>}
              </span>
            </span>
          )}
        </button>
      </VisitHover>
    );
  };

  /* ─── linha "A atribuir" (solicitações pendentes, ainda sem técnico) ─── */
  const pendingItems = pack(pending.flatMap(r => {
    const sp = span(r);
    return sp ? [{ r, ...sp }] : [];
  }));
  const pendingLanes = Math.max(1, ...pendingItems.map(x => x.lane + 1));

  const rowStyle = (lanes: number): CSSProperties => ({ gridTemplateColumns: template, gridTemplateRows: `${PAD}px repeat(${lanes}, ${LANE}px) ${PAD}px` });

  const pendingRow = pendingItems.length > 0 && (
    <div className="relative grid border-b border-border" style={rowStyle(pendingLanes)}>
      {background}
      <div className="sticky left-0 z-20 flex items-center gap-2.5 border-r border-border bg-card px-3 sm:px-3.5" style={{ gridColumn: 1, gridRow: "1 / -1" }}>
        <span aria-hidden className="absolute inset-0 bg-amber-500/[0.07]" />
        <span aria-hidden className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-amber-500 text-amber-700 dark:text-amber-300"><Inbox className="h-4 w-4" /></span>
        <span className="relative min-w-0">
          <span className="block truncate text-[13px] font-semibold">A atribuir</span>
          <span className="block truncate text-xs text-amber-700 dark:text-amber-300">{pendingItems.length} sem técnico</span>
        </span>
      </div>
      {pendingItems.map(x => bar(x.r, x.a, x.b, x.lane, x.contL, x.contR))}
    </div>
  );

  /* ─── linhas dos técnicos ─── */
  const techRows = techs.map(t => {
    const mine = approved.filter(r => techniciansOf(r).some(x => x.id === t.id)).sort((x, y) => +periodOf(x).start - +periodOf(y).start);
    const visits = mine.map(r => ({ r, s: span(r) })).filter(x => x.s).map(x => ({ kind: "visit" as const, r: x.r, ...x.s! }));
    const sugg = suggestions.filter(s => s.techId === t.id).map(s => ({ s, sp: span(s.request) })).filter(x => x.sp)
      .map(x => ({ kind: "sugg" as const, r: x.s.request, ...x.sp! }));
    const placed = pack([...visits, ...sugg]);
    const lanes = Math.max(1, ...placed.map(p => p.lane + 1));
    const load = loads.get(t.id);
    const tone = load ? loadTone(load.busy, load.workdays) : null;

    // deslocamentos entre visitas seguidas (mesma pista, com dias livres entre elas)
    const travel: { key: string; from: number; to: number; lane: number; km: number | null }[] = [];
    if (showTravel) {
      const vs = placed.filter(p => p.kind === "visit").sort((x, y) => x.a - y.a);
      for (let i = 0; i + 1 < vs.length; i++) {
        const A = vs[i], B = vs[i + 1];
        if (A.lane !== B.lane) continue;
        const from = A.b + 1, to = B.a - 1;
        if (to < from || to - from > 6) continue;
        const km = distanceKm(index, placeOf(A.r), placeOf(B.r));
        if (km === 0) continue;
        travel.push({ key: `${A.r.id}-${B.r.id}`, from, to, lane: A.lane, km });
      }
    }

    const location = load?.current ? placeLabel(placeOf(load.current))
      : load?.next ? `Próxima em ${fmtDM(visitDays(load.next).first)}` : "Sem visitas agendadas";
    return (
      <div key={t.id} className="relative grid border-b border-border/70 last:border-b-0" style={rowStyle(lanes)}>
        {background}
        <div className="sticky left-0 z-20 flex items-center gap-2.5 border-r border-border bg-card px-3 sm:px-3.5" style={{ gridColumn: 1, gridRow: "1 / -1" }} title={t.full_name}>
          <TechAvatar tech={t} size="h-8 w-8 text-[11px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-[18px]">{t.full_name}</p>
            <p className="flex min-w-0 items-center gap-1.5 text-xs leading-[18px] text-muted-foreground">
              {!isMobile && (load?.current
                ? <span className="shrink-0 rounded-full bg-sky-500/15 px-1.5 text-[10.5px] font-medium leading-4 text-sky-800 dark:text-sky-200">Em campo</span>
                : <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 text-[10.5px] font-semibold leading-4 text-emerald-700 dark:text-emerald-300">Livre hoje</span>)}
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
        {travel.map(tr => (
          <div key={tr.key} aria-hidden className="pointer-events-none relative z-[5] flex items-center justify-center" style={{ gridColumn: `${tr.from + 2} / ${tr.to + 3}`, gridRow: tr.lane + 2 }}>
            <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-muted-foreground/50" />
            {tr.km !== null && (
              <span className="relative flex flex-col items-center rounded border border-border bg-card px-1 py-0.5 text-[10.5px] font-semibold leading-3 tabular-nums text-foreground/80 shadow-sm">
                {tr.km.toLocaleString("pt-BR")}<span className="text-[9px] font-normal text-muted-foreground">km</span>
              </span>
            )}
          </div>
        ))}
        {placed.map(p => p.kind === "visit"
          ? bar(p.r, p.a, p.b, p.lane, p.contL, p.contR)
          : (
            <button key={`s-${p.r.id}`} type="button" onClick={() => onAssign?.(p.r, t.id)}
              title={`Sugestão: ${t.full_name} está livre em ${fmtDayRange(visitDays(p.r).first, visitDays(p.r).last)} para ${p.r.project?.company_name}`}
              className="relative z-10 flex h-12 min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border-[1.5px] border-dashed border-primary/50 bg-primary/[0.05] px-1.5 text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ gridColumn: `${p.a + 2} / ${p.b + 3}`, gridRow: p.lane + 2, alignSelf: "center", marginInline: 3 }}>
              <span className="flex items-center gap-1 text-xs font-semibold"><ArrowUp className="h-3 w-3" />Sugestão</span>
              <span className="w-full truncate text-center text-[11px] opacity-80">{p.r.project?.company_name}</span>
            </button>
          ))}
        {placed.length === 0 && (
          <p className="pointer-events-none self-center px-3 text-[11px] italic text-muted-foreground" style={{ gridColumn: "2 / -1", gridRow: 2 }}>Livre no período</p>
        )}
      </div>
    );
  });

  /* ─── cabeçalho: semanas e dias ─── */
  const header = (
    <div className="grid border-b border-border" style={{ gridTemplateColumns: template, gridTemplateRows: "32px 48px" }}>
      <div className="sticky left-0 z-20 flex items-end justify-between gap-2 border-r border-border bg-card px-3 pb-2.5 sm:px-3.5" style={{ gridColumn: 1, gridRow: "1 / 3" }}>
        <span className="text-[13px] font-semibold">Técnico</span>
        {loadUntil && <span className="text-right text-[11px] leading-tight text-muted-foreground">Dias livres<br />até {fmtDM(loadUntil)}</span>}
      </div>
      {Array.from({ length: weeks }, (_, w) => {
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
          <div key={+d} style={{ gridColumn: i + 2, gridRow: 2, ...(hol ? HATCH.holiday : {}) }}
            className={`flex min-w-0 flex-col items-center justify-center gap-px ${i % 7 === 0 ? "border-l border-border" : "border-l border-border/40"} ${isToday ? "bg-primary/[0.06]" : isWeekend(d) ? "bg-muted/50" : ""} ${hol ? "cursor-help text-rose-700 dark:text-rose-300" : isWeekend(d) ? "text-muted-foreground" : ""}`}>
            <span className={`text-[11px] leading-[13px] ${isToday ? "font-semibold text-primary" : hol ? "" : "text-muted-foreground"}`}>{weights[i] * pxPerFr < 26 ? WD_SHORT[d.getDay()][0] : WD_SHORT[d.getDay()]}</span>
            {isToday
              ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[13px] font-semibold tabular-nums text-primary-foreground">{d.getDate()}</span>
              : <span className="text-sm font-semibold leading-[18px] tabular-nums">{d.getDate()}</span>}
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
        {pendingRow}
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
