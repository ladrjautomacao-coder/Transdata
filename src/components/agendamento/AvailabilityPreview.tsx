import { CalendarRange, CheckCircle2, Hourglass, UserRoundCog } from "lucide-react";
import {
  colorFor, conflictsFor, formatPeriod, periodOf, techniciansOf,
  type ImplantationRequest, type Technician,
} from "@/lib/implantationScheduling";
import { TechAvatar } from "./AgendaShared";

const DAY = 864e5;
const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_DAYS = 28;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const dayIdx = (d: Date, s0: Date) => Math.round((+startOfDay(d) - +s0) / DAY);

/**
 * Disponibilidade dos técnicos na(s) semana(s) do período solicitado.
 * Mostra o que já está aprovado, destaca o período pedido e resume quem está livre,
 * para o Aprovador decidir sem precisar abrir o Calendário.
 */
export function AvailabilityPreview({ start, end, technicians, requests, ignoreId, selectedIds = [], onManageTechnicians, compact }: {
  start: Date; end: Date; technicians: Technician[]; requests: ImplantationRequest[];
  ignoreId?: string; selectedIds?: string[]; onManageTechnicians?: () => void; compact?: boolean;
}) {
  if (isNaN(+start) || isNaN(+end) || end <= start) return null;

  // da segunda-feira da semana do início até o domingo da semana do fim (limitado)
  const s0 = mondayOf(start);
  const total = Math.min(MAX_DAYS, dayIdx(addDays(mondayOf(end), 6), s0) + 1);
  const days = Array.from({ length: total }, (_, i) => addDays(s0, i));
  const sEnd = addDays(s0, total);
  const reqA = Math.max(0, dayIdx(start, s0)), reqB = Math.min(total - 1, dayIdx(end, s0));
  const today = startOfDay(new Date()).getTime();

  const approved = requests.filter(r => r.status === "aprovada" && r.id !== ignoreId && periodOf(r).start < sEnd && s0 < periodOf(r).end);
  const otherPending = requests.filter(r => r.status === "pendente" && r.id !== ignoreId && periodOf(r).start < end && start < periodOf(r).end);
  const free = technicians.filter(t => conflictsFor(t.id, start, end, requests, ignoreId).length === 0);
  const busy = technicians.filter(t => !free.includes(t));
  const pct = (i: number) => `${(i / total) * 100}%`;

  return (
    <div className="rounded-lg border border-border/60 bg-background/60">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b px-3 py-2 text-[11px]">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <CalendarRange className="h-3.5 w-3.5 text-primary" />Disponibilidade {total > 7 ? "no período" : "na semana"} · {formatPeriod(start, end)}
        </span>
        {technicians.length > 0 && (
          <span className={`flex items-center gap-1 font-medium ${free.length ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            <CheckCircle2 className="h-3.5 w-3.5" />{free.length} de {technicians.length} técnico(s) livre(s) no período
          </span>
        )}
        {otherPending.length > 0 && (
          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300" title={otherPending.map(r => r.project?.company_name).join(", ")}>
            <Hourglass className="h-3.5 w-3.5" />{otherPending.length} outra(s) solicitação(ões) pendente(s) no mesmo período
          </span>
        )}
      </div>

      {technicians.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
          <UserRoundCog className="h-4 w-4" />Nenhum técnico cadastrado para mostrar a disponibilidade.
          {onManageTechnicians && <button type="button" onClick={onManageTechnicians} className="font-semibold text-primary hover:underline">Cadastrar técnicos</button>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 150 + total * (compact ? 34 : 42) }}>
            {/* cabeçalho de dias */}
            <div className="flex border-b text-[10px] text-muted-foreground">
              <div className="w-[150px] shrink-0 px-3 py-1.5 font-semibold">Técnico</div>
              <div className="relative flex flex-1">
                <div className="absolute inset-y-0 rounded-sm bg-primary/10" style={{ left: pct(reqA), width: pct(reqB - reqA + 1) }} />
                {days.map(d => {
                  const inReq = dayIdx(d, s0) >= reqA && dayIdx(d, s0) <= reqB;
                  return (
                    <div key={+d} className={`relative flex-1 border-l py-1 text-center ${d.getDay() === 0 || d.getDay() === 6 ? "opacity-60" : ""} ${inReq ? "font-bold text-primary" : ""}`}>
                      {WD[d.getDay()]}<div className={`text-xs ${d.getTime() === today ? "mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground" : inReq ? "" : "text-foreground"}`}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* linhas por técnico: livres primeiro */}
            {[...free, ...busy].map(t => {
              const mine = approved.filter(r => techniciansOf(r).some(x => x.id === t.id));
              const isFree = free.includes(t);
              const isSel = selectedIds.includes(t.id);
              return (
                <div key={t.id} className={`flex border-b last:border-0 ${isSel ? "bg-primary/5" : ""}`} style={{ height: compact ? 34 : 40 }}>
                  <div className="flex w-[150px] shrink-0 items-center gap-2 px-3">
                    <TechAvatar tech={t} size="h-6 w-6 text-[9px]" />
                    <div className="min-w-0 leading-tight">
                      <p className={`truncate text-xs ${isSel ? "font-semibold text-primary" : "font-medium"}`}>{t.full_name}</p>
                      <p className={`text-[9px] font-semibold uppercase ${isFree ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>{isFree ? "livre" : "ocupado"}</p>
                    </div>
                  </div>
                  <div className="relative flex flex-1">
                    <div className="pointer-events-none absolute inset-y-0 border-x border-dashed border-primary/40 bg-primary/[0.07]" style={{ left: pct(reqA), width: pct(reqB - reqA + 1) }} />
                    {days.map(d => <div key={+d} className={`flex-1 border-l ${d.getDay() === 0 || d.getDay() === 6 ? "bg-muted/40" : ""}`} />)}
                    {mine.map(r => {
                      const p = periodOf(r);
                      const a = Math.max(0, dayIdx(p.start, s0)), b = Math.min(total - 1, dayIdx(p.end, s0));
                      const clash = p.start < end && start < p.end;
                      return (
                        <div key={r.id} title={`${r.project?.company_name} · ${formatPeriod(p.start, p.end)}`}
                          className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md px-1.5 text-[10px] font-medium text-white shadow-sm ${clash ? "ring-2 ring-destructive ring-offset-1 ring-offset-background" : "opacity-80"}`}
                          style={{ left: `calc(${pct(a)} + 2px)`, width: `calc(${pct(b - a + 1)} - 4px)`, background: colorFor(r.project_id) }}>
                          <span className="truncate">{r.project?.company_name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-1.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm border border-dashed border-primary/50 bg-primary/10" />Período solicitado</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-slate-500" />Já alocado (aprovado)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-slate-500 ring-2 ring-destructive" />Conflita com o pedido</span>
        {total >= MAX_DAYS && <span>Mostrando os primeiros {MAX_DAYS} dias do período.</span>}
      </div>
    </div>
  );
}
