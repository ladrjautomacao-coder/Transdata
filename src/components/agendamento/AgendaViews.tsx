import type { ReactNode } from "react";
import { CalendarDays, ChartGantt, ChevronLeft, ChevronRight, List, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { periodOf, techniciansOf, type ImplantationRequest } from "@/lib/implantationScheduling";
import { WEEK_OPTIONS, placeLabel, placeOf, visitSummary, type AgendaAlert } from "@/lib/agendaTecnica";
import { EmptyBlock, TechAvatar } from "./AgendaShared";
import { KindChip, VisitHover, VisitStatePill } from "./VisitHoverCard";

/** Visões da Agenda técnica (a mesma na Área do Implantador). */
export type AgendaView = "tecnico" | "mes" | "lista";

const segmented = (active: boolean) => `flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] transition-colors ${active ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`;

/** Barra padrão da agenda: Hoje, setas, período, semanas e visões. */
export function AgendaToolbar({ view, onView, weeks, onWeeks, spanLabel, onToday, onNav, extra }: {
  view: AgendaView; onView: (v: AgendaView) => void;
  weeks: number; onWeeks: (n: number) => void;
  spanLabel: string; onToday: () => void; onNav: (n: number) => void;
  /** Conteúdo extra entre o período e as visões (ex.: filtros). */
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex h-10 items-center gap-0.5 rounded-xl border border-border/60 bg-card px-1 shadow-sm">
        <Button variant="ghost" size="sm" className="h-8 bg-muted/70 px-2.5 text-[13px]" onClick={onToday}>Hoje</Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => onNav(-1)} aria-label="Período anterior"><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => onNav(1)} aria-label="Próximo período"><ChevronRight className="h-4 w-4" /></Button>
        <span className="whitespace-nowrap px-2 text-sm font-semibold tabular-nums">{spanLabel}</span>
      </div>
      {view !== "mes" && (
        <div role="group" aria-label="Período exibido" className="flex h-10 items-center gap-0.5 rounded-xl bg-muted p-1">
          {WEEK_OPTIONS.map(n => (
            <button key={n} type="button" aria-pressed={weeks === n} onClick={() => onWeeks(n)} className={segmented(weeks === n)}>{n} semana{n > 1 ? "s" : ""}</button>
          ))}
        </div>
      )}
      {extra}
      <span className="hidden flex-1 lg:block" />
      <nav aria-label="Visualização" className="flex h-10 items-center gap-0.5 rounded-xl bg-muted p-1">
        {([["tecnico", "Por técnico", ChartGantt], ["mes", "Calendário", CalendarDays], ["lista", "Lista", List]] as const).map(([k, l, Icon]) => (
          <button key={k} type="button" aria-current={view === k ? "page" : undefined} onClick={() => onView(k)} className={segmented(view === k)}>
            <Icon className="h-3.5 w-3.5" />{l}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Lista da agenda (tabela por período). */
export function AgendaListView({ list, onOpen, onAssign, highlightId, alertsByRequest, filtersOn = false, onClear }: {
  list: ImplantationRequest[]; onOpen: (r: ImplantationRequest) => void; onAssign?: (r: ImplantationRequest) => void;
  highlightId: string | null; alertsByRequest: Map<string, AgendaAlert[]>; filtersOn?: boolean; onClear?: () => void;
}) {
  const rows = [...list].sort((a, b) => +periodOf(a).start - +periodOf(b).start);
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border/60 bg-card">
        <EmptyBlock icon={SearchX} title={filtersOn ? "Nada com esses filtros" : "Nenhuma visita neste período"}
          text={filtersOn ? "Ajuste ou limpe os filtros para ver mais visitas." : "Use as setas para ver outro período."}
          action={filtersOn && onClear ? <Button variant="outline" size="sm" onClick={onClear}>Limpar filtros</Button> : undefined} />
      </div>
    );
  }
  const now = new Date();
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-4 py-3">Período</th><th className="px-4 py-3">Cliente / projeto</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Técnicos</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">GP</th></tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(r => {
            const open = () => (r.status === "pendente" && onAssign ? onAssign(r) : onOpen(r));
            const alerts = alertsByRequest.get(r.id) ?? [];
            return (
              <VisitHover key={r.id} request={r} alerts={alerts} onOpen={onOpen} onAssign={onAssign}>
                <tr data-req={r.id} onClick={open} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") open(); }}
                  className={`cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none ${r.id === highlightId ? "bg-amber-400/20" : ""}`}>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px]">{visitSummary(r)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.project?.company_name ?? "Projeto removido"}</p>
                    <p className="text-[11px] text-muted-foreground">{r.project?.project_code ? <span className="font-mono">{r.project.project_code} · </span> : null}{placeLabel(placeOf(r))}</p>
                  </td>
                  <td className="px-4 py-3"><KindChip purpose={r.visit_purpose} /><p className="mt-1 text-[11px] text-muted-foreground">{r.visit_purpose}</p></td>
                  <td className="px-4 py-3">
                    {techniciansOf(r).length
                      ? <div className="flex -space-x-1.5">{techniciansOf(r).map(t => <TechAvatar key={t.id} tech={t} />)}</div>
                      : <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">A atribuir</span>}
                  </td>
                  <td className="px-4 py-3"><VisitStatePill request={r} now={now} />{alerts.length > 0 && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{alerts.length} alerta{alerts.length > 1 ? "s" : ""}</p>}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.project?.manager?.full_name ?? "—"}</td>
                </tr>
              </VisitHover>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
