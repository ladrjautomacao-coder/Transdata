import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, CalendarDays, CheckCircle2, Clock3, Inbox, Info, Palmtree, UserCheck, UserX, UsersRound, XCircle,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { isAvailable, periodOf, type ImplantationRequest, type Technician } from "@/lib/implantationScheduling";
import type { Holiday } from "@/lib/holidays";
import {
  MONTH_SHORT, VISIT_KIND, dayDiff, fmtDayRange, fmtDM, fmtWdDM, p2, placeLabel, placeOf,
  visitDays, workdaysIn, type AgendaAlert, type VisitKind,
} from "@/lib/agendaTecnica";

/* ─── Resumo no topo (4 indicadores numa faixa) ─────────────────────────── */
function SummaryCell({ icon: Icon, tone, label, value, caption, captionTone = "text-muted-foreground", info, action, first }: {
  icon: LucideIcon; tone: string; label: string; value: string; caption: ReactNode; captionTone?: string; info: string;
  action?: { label: string; onClick: () => void }; first?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-1 items-start gap-3 px-4 py-3 sm:basis-[230px] sm:px-[18px] sm:py-3.5 ${first ? "" : "border-t border-border/60 sm:border-l sm:border-t-0"}`}>
      <span aria-hidden className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] ${tone}`}><Icon className="h-[17px] w-[17px]" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-xs text-muted-foreground" title={label}>{label}</span>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label={`O que significa ${label}`} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground">
                <Info className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-64 text-sm">
              <p className="mb-1 font-semibold">{label}</p>
              <p className="text-muted-foreground">{info}</p>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-xl font-semibold leading-[26px]">{value}</p>
          {action && (
            <button type="button" onClick={action.onClick} className="shrink-0 text-[13px] font-semibold text-primary underline underline-offset-2 hover:text-primary/80">{action.label}</button>
          )}
        </div>
        <p className={`truncate text-[13px] leading-[18px] ${captionTone}`} title={typeof caption === "string" ? caption : undefined}>{caption}</p>
      </div>
    </div>
  );
}

export function AgendaSummary({
  today, todayVisits, techsInField, techTotal, freeTotal, freeUntil, freeBreakdown, pending, onEvaluate, alertsCount, conflicts, onSeeAlerts,
}: {
  today: Date;
  todayVisits: number;
  techsInField: number;
  techTotal: number;
  freeTotal: number | null;
  freeUntil: Date | null;
  freeBreakdown: { name: string; free: number }[];
  pending: ImplantationRequest[];
  onEvaluate?: () => void;
  alertsCount: number;
  conflicts: number;
  onSeeAlerts: () => void;
}) {
  const soonest = [...pending].sort((a, b) => +periodOf(a).start - +periodOf(b).start)[0];
  const d = soonest ? dayDiff(today, visitDays(soonest).first) : null;
  const pendingCaption = d === null ? "Nada para avaliar"
    : d < 0 ? "1 já começou sem avaliação"
    : d === 0 ? "1 começa hoje"
    : d === 1 ? "1 começa amanhã"
    : d <= 7 ? `1 começa em ${d} dias` : `A próxima começa em ${d} dias`;
  const pendingTone = d === null ? "text-emerald-700 dark:text-emerald-400" : d < 0 ? "font-medium text-red-600 dark:text-red-400" : d <= 7 ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground";
  const breakdown = freeBreakdown.slice(0, 6).map(x => `${x.name} ${x.free}`).join(", ") + (freeBreakdown.length > 6 ? "…" : "");
  return (
    <section aria-label="Resumo da agenda" className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm sm:flex-row sm:flex-wrap">
      <SummaryCell first icon={CalendarDays} tone="bg-primary/10 text-primary" label={`Hoje, ${fmtWdDM(today)}`}
        value={`${todayVisits} visita${todayVisits !== 1 ? "s" : ""}`}
        caption={`${techsInField} de ${techTotal} técnico${techTotal !== 1 ? "s" : ""} em campo`}
        info="Visitas aprovadas que ocupam o dia de hoje e quantos técnicos estão alocados nelas." />
      <SummaryCell icon={UsersRound} tone="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        label={freeUntil ? `Dias livres na equipe até ${fmtDM(freeUntil)}` : "Dias livres na equipe"}
        value={freeTotal === null ? "—" : `${freeTotal} dia${freeTotal !== 1 ? "s" : ""}`}
        caption={freeUntil ? breakdown || "Nenhum técnico" : "O período exibido já passou"}
        info="Soma dos dias úteis sem visita aprovada de cada técnico, de hoje até o último dia útil do período exibido. Fins de semana e feriados nacionais ou da empresa não contam." />
      <SummaryCell icon={Inbox} tone="bg-amber-500/15 text-amber-700 dark:text-amber-300" label="Aguardando aprovação"
        value={`${pending.length} solicitaç${pending.length === 1 ? "ão" : "ões"}`} caption={pendingCaption} captionTone={pendingTone}
        info="Solicitações dos Gerentes de Projeto ainda sem avaliação. Elas aparecem tracejadas na linha “A atribuir” e não contam como agenda confirmada."
        action={pending.length && onEvaluate ? { label: "Avaliar", onClick: onEvaluate } : undefined} />
      <SummaryCell icon={AlertTriangle} tone="bg-amber-500/15 text-amber-700 dark:text-amber-300" label="Alertas da agenda"
        value={`${alertsCount} alerta${alertsCount !== 1 ? "s" : ""}`}
        caption={conflicts ? `${conflicts} conflito${conflicts > 1 ? "s" : ""} de horário` : "Nenhum conflito de horário"}
        captionTone={conflicts ? "font-medium text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}
        info="Situações que pedem atenção no período: viagem longa sem um dia livre entre visitas, técnico sem nenhum dia livre, trabalho no fim de semana ou feriado e conflito de horário."
        action={alertsCount ? { label: "Ver", onClick: onSeeAlerts } : undefined} />
    </section>
  );
}

/* ─── Legenda ────────────────────────────────────────────────────────────── */
// Mostra só três tipos (ITS, Bilhetagem e Outros) para evitar poluição visual —
// os demais tipos agora compartilham o visual neutro ("Outros").
const SIMPLE_KINDS: VisitKind[] = ["its", "bilhetagem", "outro"];
export function AgendaLegend({ kinds, pending: _pending = true, travel: _travel = false, hint }: { kinds: VisitKind[]; pending?: boolean; travel?: boolean; hint?: string }) {
  const visible = SIMPLE_KINDS.filter(k => k === "outro"
    ? kinds.some(x => x !== "its" && x !== "bilhetagem")
    : kinds.includes(k));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
      {visible.map(k => (
        <span key={k} className="flex items-center gap-1.5"><span className={`h-2.5 w-4 rounded-[3px] border ${VISIT_KIND[k].swatch}`} />{k === "its" ? "ITS / Gestão de Frotas" : k === "bilhetagem" ? "Bilhetagem" : "Outros serviços"}</span>
      ))}
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[3px] border border-rose-400/60 bg-rose-500/10" />Feriado</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[3px] border border-border bg-muted" />Fim de semana</span>
      {hint && <span className="basis-full text-[11px] sm:ml-auto sm:basis-auto">{hint}</span>}
    </div>
  );
}

/* ─── Aguardando aprovação ───────────────────────────────────────────────── */
function DateBox({ first, last }: { first: Date; last: Date }) {
  const same = dayDiff(first, last) === 0;
  const cross = first.getMonth() !== last.getMonth();
  return (
    <span className="flex w-[60px] shrink-0 flex-col items-center justify-center rounded-lg border border-border/60 bg-muted/40 py-2 text-center">
      <span className="text-[15px] font-semibold leading-5 tabular-nums">{same ? p2(first.getDate()) : `${p2(first.getDate())}–${p2(last.getDate())}`}</span>
      <span className="text-[11px] text-muted-foreground">{cross ? `${MONTH_SHORT[first.getMonth()]}–${MONTH_SHORT[last.getMonth()]}` : MONTH_SHORT[first.getMonth()]}</span>
    </span>
  );
}

const joinNames = (names: string[]) => names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;

export function PendingPanel({ pending, techs, requests, holidays, today, canApprove, onAssign, onOpen }: {
  pending: ImplantationRequest[];
  techs: Technician[];
  requests: ImplantationRequest[];
  holidays: Map<string, Holiday[]>;
  today: Date;
  canApprove: boolean;
  onAssign: (r: ImplantationRequest) => void;
  onOpen: (r: ImplantationRequest) => void;
}) {
  const list = [...pending].sort((a, b) => +periodOf(a).start - +periodOf(b).start);
  return (
    <section id="aguardando" aria-label="Aguardando aprovação" className="scroll-mt-4 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center gap-2 px-5 pb-1 pt-4">
        <h2 className="text-base font-semibold">Aguardando aprovação</h2>
        <span className="ml-auto flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="flex items-center gap-2 px-5 pb-5 pt-3 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" />Nenhuma solicitação aguardando aprovação.</p>
      ) : (
        <ul className="px-5 pb-2">
          {list.map((r, i) => {
            const { first, last } = visitDays(r);
            const { start, end } = periodOf(r);
            const d = dayDiff(today, first);
            const wd = workdaysIn(first, last, holidays).length;
            const free = techs.filter(t => isAvailable(t, start, end, requests, r.id, r.visit_format));
            const names = free.map(t => t.full_name.trim().split(/\s+/)[0]);
            const urgency = d < 0
              ? { text: `Começou ${fmtWdDM(first)} e ainda não foi avaliada`, tone: "text-red-600 dark:text-red-400" }
              : { text: d === 0 ? "Começa hoje" : d === 1 ? `Começa amanhã, ${fmtWdDM(first)}` : `Começa em ${d} dias, na ${fmtWdDM(first)}`, tone: d <= 7 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground" };
            return (
              <li key={r.id} className="flex items-start gap-3.5 border-t border-border/60 py-3.5 first:border-t-0">
                <DateBox first={first} last={last} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] font-semibold">{r.project?.company_name ?? "Projeto removido"}</span>
                    <span className="rounded-full bg-amber-500/15 px-2 text-[11px] font-medium leading-5 text-amber-800 dark:text-amber-200">Sem técnico</span>
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {r.visit_purpose}, {r.location?.trim() || placeLabel(placeOf(r))}, {wd ? `${wd} dia${wd > 1 ? "s" : ""} út${wd > 1 ? "eis" : "il"}` : "fim de semana ou feriado"}
                  </p>
                  <p className={`mt-0.5 flex items-center gap-1.5 text-[13px] font-medium ${urgency.tone}`}><Clock3 className="h-3.5 w-3.5 shrink-0" />{urgency.text}</p>
                  {canApprove && techs.length > 0 && (
                    <p className={`mt-0.5 flex items-center gap-1.5 text-[13px] ${free.length ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {free.length ? <UserCheck className="h-3.5 w-3.5 shrink-0" /> : <UserX className="h-3.5 w-3.5 shrink-0" />}
                      {free.length === 0 ? `Nenhum técnico livre em ${fmtDayRange(first, last)}`
                        : free.length > 3 ? `${free.length} técnicos estão livres em ${fmtDayRange(first, last)}`
                        : `${joinNames(names)} ${free.length > 1 ? "estão livres" : "está livre"} em ${fmtDayRange(first, last)}`}
                    </p>
                  )}
                </div>
                {canApprove
                  ? <Button size="sm" variant={i === 0 ? "default" : "outline"} className="h-9 shrink-0" onClick={() => onAssign(r)}>Avaliar</Button>
                  : <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => onOpen(r)}>Ver</Button>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ─── Alertas da agenda ──────────────────────────────────────────────────── */
export function AlertsPanel({ alerts, conflicts, onPick, onSuggestion }: {
  alerts: AgendaAlert[];
  conflicts: number;
  onPick: (a: AgendaAlert) => void;
  onSuggestion: (requestId: string) => void;
}) {
  return (
    <section id="alertas" aria-label="Alertas da agenda" className="scroll-mt-4 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center gap-2 px-5 pb-1 pt-4">
        <h2 className="text-base font-semibold">Alertas da agenda</h2>
        <span className="ml-auto flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">{alerts.length}</span>
      </div>
      {alerts.length === 0 ? (
        <p className="px-5 pb-2 pt-3 text-sm text-muted-foreground">Nenhum alerta no período exibido.</p>
      ) : (
        <ul className="px-5">
          {alerts.map(a => {
            const Icon = a.kind === "conflito" ? XCircle : a.kind === "ferias" ? Palmtree : a.kind === "fim_de_semana" ? CalendarDays : AlertTriangle;
            const tone = a.kind === "conflito" || a.kind === "ferias" ? "bg-destructive/10 text-destructive" : a.kind === "fim_de_semana" ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-700 dark:text-amber-300";
            return (
              <li key={a.id} className="border-t border-border/60 first:border-t-0">
                <div className="flex gap-3 py-3.5">
                  <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => onPick(a)} className="flex w-full items-baseline justify-between gap-3 text-left hover:underline" title="Mostrar na agenda">
                      <span className="text-[15px] font-semibold">{a.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
                    </button>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{a.text}</p>
                    {a.suggestion && (
                      <p className="mt-1 text-[13px] leading-relaxed">
                        {a.suggestion.text}{" "}
                        <button type="button" onClick={() => onSuggestion(a.suggestion!.requestId)} className="font-semibold text-primary underline underline-offset-2">Ver a visita</button>
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className={`flex items-center gap-2 border-t border-border/60 px-5 py-3.5 text-[13px] ${conflicts ? "font-medium text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
        {conflicts ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {conflicts ? `${conflicts} conflito${conflicts > 1 ? "s" : ""} de horário no período.` : "Nenhum conflito de horário no período."}
      </p>
    </section>
  );
}
