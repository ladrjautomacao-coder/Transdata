import { CalendarCheck, ChevronRight, FileText, MapPin, Navigation, Route } from "lucide-react";
import { periodOf, type ImplantationRequest, type Technician } from "@/lib/implantationScheduling";
import type { Holiday } from "@/lib/holidays";
import {
  MONTH_SHORT, VISIT_KIND, coversDay, dayDiff, dayTitle, distanceKm, fmtDM, fmtDayRange, fmtHM, fmtKm, fmtWdDM, isTeamWorkday,
  p2, placeLabel, placeOf, plusDays, startOfDay, visitDays, visitKindOf, visitOrdinal, type CityIndex,
} from "@/lib/agendaTecnica";
import { TechAvatar } from "./AgendaShared";
import { KindChip } from "./VisitHoverCard";

const mapsUrl = (r: ImplantationRequest) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.location?.trim() || placeLabel(placeOf(r)))}`;

/** Cabeçalho do "app do técnico" (celular). */
export function MinhaAgendaHeader({ tech, today, title = "Minha agenda" }: { tech: Technician; today: Date; title?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-sm">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold leading-tight">{title}</h1>
        <p className="text-sm opacity-85">{dayTitle(today)}</p>
      </div>
      <TechAvatar tech={tech} size="h-11 w-11 text-sm ring-primary-foreground/40" />
    </div>
  );
}

/**
 * Resumo da agenda do técnico no estilo do app: visita em atendimento (ou a próxima),
 * próximo deslocamento, próximas visitas e a partir de quando fica livre.
 */
export function MinhaAgenda({ visits, today, holidays, index, onOpen, compactList = true, layout = "stack" }: {
  /** Visitas aprovadas do técnico (já no formato de solicitação). */
  visits: ImplantationRequest[];
  today: Date;
  holidays: Map<string, Holiday[]>;
  index: CityIndex | null;
  onOpen: (r: ImplantationRequest) => void;
  /** Mostra a lista "Próximas visitas" (no computador a página já tem a lista completa). */
  compactList?: boolean;
  /** "row" = cartões lado a lado (computador). */
  layout?: "stack" | "row";
}) {
  const t0 = startOfDay(today);
  const sorted = [...visits].sort((a, b) => +periodOf(a).start - +periodOf(b).start);
  const current = sorted.find(r => coversDay(r, t0)) ?? null;
  const upcoming = sorted.filter(r => +visitDays(r).first > +t0);
  const featured = current ?? upcoming[0] ?? null;
  const rest = upcoming.filter(r => r !== featured);
  const past = sorted.filter(r => +visitDays(r).last < +t0);
  const from = current ?? past[past.length - 1] ?? null;
  const to = current ? upcoming[0] ?? null : featured;
  const lastScheduled = sorted.filter(r => +visitDays(r).last >= +t0).pop();
  let freeFrom: Date | null = null;
  if (lastScheduled) {
    freeFrom = plusDays(visitDays(lastScheduled).last, 1);
    for (let i = 0; i < 10 && !isTeamWorkday(freeFrom, holidays); i++) freeFrom = plusDays(freeFrom, 1);
  }

  return (
    <div className={layout === "row" ? "grid items-start gap-4 lg:grid-cols-2" : "flex flex-col gap-3"}>
      {featured ? <FeaturedVisit r={featured} current={!!current} today={t0} onOpen={onOpen} /> : (
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck className="h-4 w-4 text-primary" />Nenhuma visita agendada</p>
          <p className="mt-1 text-sm text-muted-foreground">Quando o Aprovador alocar você numa visita, ela aparece aqui.</p>
        </div>
      )}

      {from && to && from !== to && <NextTrip from={from} to={to} holidays={holidays} index={index} />}

      {compactList && (rest.length > 0 || freeFrom) && (
        <section aria-label="Próximas visitas">
          <h2 className="mb-2 mt-1 px-1 text-[15px] font-semibold">Próximas visitas</h2>
          <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            {rest.slice(0, 5).map(r => {
              const { first, last } = visitDays(r);
              const ord = visitOrdinal(r.visit_purpose);
              const k = VISIT_KIND[visitKindOf(r.visit_purpose)];
              return (
                <li key={r.id} className="border-b border-border/60 last:border-b-0">
                  <button type="button" onClick={() => onOpen(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                    <span className={`flex w-[52px] shrink-0 flex-col items-center rounded-lg py-1.5 ${k.chip}`}>
                      <span className="text-[13px] font-semibold leading-4 tabular-nums">{dayDiff(first, last) ? `${p2(first.getDate())}–${p2(last.getDate())}` : p2(first.getDate())}</span>
                      <span className="text-[11px] leading-4">{MONTH_SHORT[first.getMonth()]}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.project?.company_name ?? "Projeto removido"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{placeLabel(placeOf(r))}, {ord ? `${ord} visita` : r.visit_purpose}, {fmtHM(periodOf(r).start)}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
            {freeFrom && (
              <li className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-[52px] shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><CalendarCheck className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Livre a partir de {fmtDM(freeFrom)}</span>
                  <span className="block text-xs text-muted-foreground">Nenhuma visita agendada depois disso</span>
                </span>
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

function FeaturedVisit({ r, current, today, onOpen }: { r: ImplantationRequest; current: boolean; today: Date; onOpen: (r: ImplantationRequest) => void }) {
  const { first, last, count } = visitDays(r);
  const { start } = periodOf(r);
  const ord = visitOrdinal(r.visit_purpose);
  const inDays = dayDiff(today, first);
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2 text-[13px]">
        {current
          ? <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />Em atendimento</span>
          : <span className="font-semibold text-primary">Próxima visita</span>}
        <span className="text-muted-foreground">{current ? `Dia ${dayDiff(first, today) + 1} de ${count}` : inDays === 1 ? "amanhã" : `em ${inDays} dias`}</span>
      </div>
      <h2 className="mt-1.5 text-xl font-semibold leading-tight">{r.project?.company_name ?? "Projeto removido"}</h2>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
        <KindChip purpose={r.visit_purpose} />
        <span>{ord ? `${ord} visita` : r.visit_purpose}, {count > 1 ? `de ${fmtDayRange(first, last)}` : `em ${fmtWdDM(first)}`}</span>
      </p>
      <p className="mt-3 flex items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-semibold">{placeLabel(placeOf(r))}</span>
        <span className="text-muted-foreground">início às {fmtHM(start)}</span>
      </p>
      {r.location?.trim() && r.location.trim() !== placeLabel(placeOf(r)) && <p className="ml-6 mt-0.5 text-xs text-muted-foreground">{r.location}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href={mapsUrl(r)} target="_blank" rel="noreferrer"
          className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-border text-[13px] font-medium transition-colors hover:bg-muted/60">
          <Navigation className="h-4 w-4 text-primary" />Rota
        </a>
        <button type="button" onClick={() => onOpen(r)}
          className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-border text-[13px] font-medium transition-colors hover:bg-muted/60">
          <FileText className="h-4 w-4 text-primary" />Detalhes
        </button>
      </div>
    </section>
  );
}

function NextTrip({ from, to, holidays, index }: { from: ImplantationRequest; to: ImplantationRequest; holidays: Map<string, Holiday[]>; index: CityIndex | null }) {
  const a = visitDays(from).last, b = visitDays(to).first;
  const km = distanceKm(index, placeOf(from), placeOf(to));
  const gap = dayDiff(a, b) - 1;
  let offOnly = gap > 0;
  for (let d = plusDays(a, 1); +d < +b; d = plusDays(d, 1)) if (isTeamWorkday(d, holidays)) offOnly = false;
  const when = gap < 0 ? "No mesmo dia" : gap === 0 ? "Sem dia livre entre as visitas" : offOnly ? "Viagem no fim de semana" : `${gap} dia${gap > 1 ? "s" : ""} livre${gap > 1 ? "s" : ""} antes`;
  return (
    <section className="flex gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Route className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Próximo deslocamento</p>
        <p className="text-[15px] font-semibold leading-snug">{km === 0 ? `Segue em ${placeLabel(placeOf(to))}` : `${placeLabel(placeOf(from))} para ${placeLabel(placeOf(to))}`}</p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {km ? `${fmtKm(km)} em linha reta. ` : ""}{when}, chegada até {fmtWdDM(b)}, {fmtHM(periodOf(to).start)}.
        </p>
      </div>
    </section>
  );
}
