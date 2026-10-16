import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban, CalendarCheck, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, FolderKanban, HardHat, List, MapPin, Monitor, RefreshCw,
  Smartphone, UserRound, UserX, UsersRound, WifiOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCustomHolidays } from "@/hooks/useCustomHolidays";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyBlock, Kpi } from "@/components/agendamento/AgendaShared";
import { HolidayWarning } from "@/components/agendamento/HolidaysDialog";
import { InstallAppButton } from "@/pwa/InstallAppButton";
import { RequestDetailSheet } from "@/components/agendamento/AgendaDialogs";
import { MonthGrid } from "@/components/agendamento/MonthGrid";
import { MinhaAgenda, MinhaAgendaHeader } from "@/components/agendamento/MinhaAgenda";
import { useCityIndex } from "@/hooks/useCityIndex";
import { holidaysByDay } from "@/lib/holidays";
import { formatLocation } from "@/lib/location";
import {
  errorMessage, fetchTechnicianAgenda, fetchTechnicians, formatPeriod,
  type AgendaVisit, type ImplantationRequest, type Technician, type TechnicianAgenda,
} from "@/lib/implantationScheduling";

type Period = "mes" | "tri" | "ano";
const PERIODS: [Period, string][] = [["mes", "Este mês"], ["tri", "Últimos 3 meses"], ["ano", "Este ano"]];
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const VIEW_KEY = "transdata:area-implantador-view";
type View = "lista" | "calendario";

/** Visita da Área no formato usado pela grade do mês e pelo detalhe. */
function toRequest(v: AgendaVisit, tech: NonNullable<TechnicianAgenda["technician"]>): ImplantationRequest {
  const t = (id: string, full_name: string, photo_url?: string | null) => ({ technician: { id, full_name, email: null, area: null, active: true, photo_url } });
  return {
    id: v.id, project_id: v.project.id, requested_by: null, requester_name: v.requester_name,
    visit_purpose: v.visit_purpose, visit_purpose_is_custom: false,
    requested_start: v.start, requested_end: v.end, location: v.location, notes: v.notes, status: v.status,
    approved_start: v.start, approved_end: v.end, reviewer_name: v.reviewer_name, reviewed_at: null, rejection_reason: null,
    attendance: v.attendance, attendance_note: v.attendance_note, attended_by_name: v.attended_by_name, attended_at: v.attended_at,
    cancel_reason: v.cancel_reason, created_at: v.start,
    project: { id: v.project.id, company_name: v.project.company_name, project_code: v.project.project_code, city: v.project.city,
      state: v.project.state, country_code: v.project.country_code, manager: v.project.manager_name ? { full_name: v.project.manager_name } : null },
    members: [t(tech.id, tech.full_name, tech.photo_url), ...v.colleagues.map(c => t(c.id, c.full_name, c.photo_url))],
  };
}

/** Janela do filtro de período (histórico e KPIs de resultado). */
function periodRange(p: Period) {
  const now = new Date();
  if (p === "ano") return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
  if (p === "tri") return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

/** Situação da visita para o técnico. */
function resultOf(v: AgendaVisit, now: Date) {
  if (v.status === "cancelada") return { label: "Cancelada", cls: "bg-muted text-muted-foreground", border: "border-l-muted-foreground/40" };
  if (v.attendance === "presencial") return { label: "Atendida presencial", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", border: "border-l-emerald-500" };
  if (v.attendance === "remoto") return { label: "Atendida remota", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300", border: "border-l-sky-500" };
  if (new Date(v.end) < now) return { label: "Aguardando registro", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300", border: "border-l-amber-400" };
  if (new Date(v.start) <= now) return { label: "Em andamento", cls: "bg-primary/15 text-primary", border: "border-l-primary" };
  return { label: "Agendada", cls: "bg-primary/10 text-primary", border: "border-l-primary/60" };
}

export default function AreaImplantador() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isMobile = useIsMobile();
  // Aprovador/admin podem abrir a área de outro técnico
  const canPickOther = can("agenda_solicitacao", "approve");
  const [techId, setTechId] = useState<string | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [agenda, setAgenda] = useState<TechnicianAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("mes");
  const [view, setViewState] = useState<View>(() => {
    try { return (localStorage.getItem(VIEW_KEY) as View) || "lista"; } catch { return "lista"; }
  });
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignora */ } };
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const [detail, setDetail] = useState<ImplantationRequest | null>(null);
  const { custom: customHolidays } = useCustomHolidays();
  const cityIndex = useCityIndex();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAgenda(await fetchTechnicianAgenda(techId));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [techId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (canPickOther) fetchTechnicians().then(setTechnicians).catch(() => setTechnicians([]));
  }, [canPickOther]);

  const now = useMemo(() => new Date(), [agenda]); // eslint-disable-line react-hooks/exhaustive-deps
  const visits = useMemo(() => agenda?.visits ?? [], [agenda]);
  const { from, to } = periodRange(period);
  const inPeriod = visits.filter(v => new Date(v.start) >= from && new Date(v.start) < to);
  const upcoming = visits.filter(v => v.status === "aprovada" && new Date(v.end) >= now)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const history = inPeriod.filter(v => v.status === "cancelada" || new Date(v.end) < now)
    .sort((a, b) => +new Date(b.start) - +new Date(a.start));
  const count = {
    presencial: inPeriod.filter(v => v.status === "aprovada" && v.attendance === "presencial").length,
    remoto: inPeriod.filter(v => v.status === "aprovada" && v.attendance === "remoto").length,
    canceladas: inPeriod.filter(v => v.status === "cancelada").length,
    pendentes: inPeriod.filter(v => v.status === "aprovada" && !v.attendance && new Date(v.end) < now).length,
  };
  const periodLabel = PERIODS.find(p => p[0] === period)![1].toLowerCase();

  // Projetos: em atendimento (visita futura/em andamento) e já atendidos
  const projects = useMemo(() => {
    const map = new Map<string, { p: AgendaVisit["project"]; visits: number; active: boolean; last: Date }>();
    for (const v of visits) {
      if (v.status === "cancelada") continue;
      const cur = map.get(v.project.id) ?? { p: v.project, visits: 0, active: false, last: new Date(0) };
      cur.visits++;
      if (new Date(v.end) >= now) cur.active = true;
      if (new Date(v.start) > cur.last) cur.last = new Date(v.start);
      map.set(v.project.id, cur);
    }
    const all = [...map.values()].sort((a, b) => +b.last - +a.last);
    return { active: all.filter(x => x.active), done: all.filter(x => !x.active) };
  }, [visits, now]);

  // Calendário: só as visitas aprovadas (ativas) do técnico, com feriados
  const calendarList = useMemo(() => agenda?.technician
    ? visits.filter(v => v.status === "aprovada").map(v => toRequest(v, agenda.technician!)) : [], [visits, agenda]);
  const holidayMap = useMemo(() => holidaysByDay([month.getFullYear() - 1, month.getFullYear(), month.getFullYear() + 1], customHolidays), [month, customHolidays]);
  const todayHolidays = useMemo(() => holidaysByDay([now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], customHolidays), [now, customHolidays]);
  const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const selectedDay = pickedDay && sameMonth(pickedDay, month) ? pickedDay : sameMonth(today0, month) ? today0 : month;
  const dayVisits = visits.filter(v => v.status === "aprovada" && new Date(v.start) < new Date(+selectedDay + 864e5) && selectedDay < new Date(v.end))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));

  const isStandalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;
  const techName = agenda?.technician?.full_name;

  const header = (
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1 basis-64">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Implantação</span>
        <h1 className="text-2xl font-bold tracking-tight">Área do Implantador</h1>
        <p className="text-sm text-muted-foreground">
          {techName ? <>Agenda de visitas técnicas de <b className="text-foreground">{techName}</b>.</> : "Sua agenda de visitas técnicas, para se programar e consultar em campo."}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
        {canPickOther && (
          <Select value={techId ?? "me"} onValueChange={v => setTechId(v === "me" ? null : v)}>
            <SelectTrigger className="h-9 w-full text-xs sm:w-[220px]" aria-label="Técnico"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Minha agenda</SelectItem>
              {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" className="h-9" onClick={() => void load()}><RefreshCw className="mr-1.5 h-4 w-4" />Atualizar</Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</div>
        <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5">
          <EmptyBlock icon={WifiOff} title="Não foi possível carregar a agenda" text={error}
            action={<Button onClick={() => void load()}><RefreshCw className="mr-1.5 h-4 w-4" />Tentar novamente</Button>} />
        </div>
      </div>
    );
  }
  if (!agenda?.technician) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <EmptyBlock icon={UserX} title="Seu usuário ainda não está vinculado a um técnico"
            text={`Peça ao Aprovador para cadastrar o seu e-mail (${user?.email ?? "do login"}) em Aprovação de agenda › Técnicos. O vínculo é feito pelo e-mail.`} />
        </div>
      </div>
    );
  }

  const tech = { ...agenda.technician, active: true };
  return (
    <div className="flex flex-col gap-5">
      {isMobile ? (
        <>
          <MinhaAgendaHeader tech={tech} today={now} title={techId ? `Agenda de ${tech.full_name.split(" ")[0]}` : "Minha agenda"} />
          {canPickOther && (
            <div className="-mt-2 flex items-center gap-2">
              <Select value={techId ?? "me"} onValueChange={v => setTechId(v === "me" ? null : v)}>
                <SelectTrigger className="h-9 flex-1 text-xs" aria-label="Técnico"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Minha agenda</SelectItem>
                  {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => void load()} aria-label="Atualizar"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          )}
        </>
      ) : header}

      <MinhaAgenda visits={calendarList} today={now} holidays={todayHolidays} index={cityIndex} onOpen={setDetail}
        compactList={isMobile} layout={isMobile ? "stack" : "row"} />

      {isMobile && !isStandalone && (
        <div className="flex items-start gap-2.5 rounded-lg bg-sky-500/10 px-3.5 py-3 text-xs text-sky-800 dark:text-sky-200">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">Use a Área do Implantador como aplicativo no celular: instale o portal e entre pelo ícone da Transdata.</span>
          <InstallAppButton variant="inline" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border/60 bg-card p-0.5 shadow-sm" role="group" aria-label="Visão">
          {([["lista", "Lista", List], ["calendario", "Calendário", CalendarDays]] as const).map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k}
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${view === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />{l}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-border/60 bg-muted/50 p-0.5" role="group" aria-label="Período">
          {PERIODS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setPeriod(k)} aria-pressed={period === k}
              className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${period === k ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {l}
            </button>
          ))}
        </div>
        {count.pendentes > 0 && (
          <span className="text-[11px] text-amber-700 dark:text-amber-300">{count.pendentes} visita(s) aguardando o Aprovador registrar o atendimento</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={CalendarClock} label="Próximas" value={upcoming.length} caption="agendadas e em andamento" tone="bg-primary/10 text-primary"
          info="Visitas aprovadas que ainda não terminaram, independentemente do período escolhido." />
        <Kpi icon={MapPin} label="Presencial" value={count.presencial} caption={`atendidas · ${periodLabel}`} tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
          info="Visitas do período que o Aprovador registrou como atendidas presencialmente." />
        <Kpi icon={Monitor} label="Remota" value={count.remoto} caption={`atendidas · ${periodLabel}`} tone="bg-sky-500/15 text-sky-600 dark:text-sky-300"
          info="Visitas do período que o Aprovador registrou como atendidas de forma remota." />
        <Kpi icon={Ban} label="Canceladas" value={count.canceladas} caption={periodLabel} tone="bg-red-500/15 text-red-600 dark:text-red-300"
          info="Visitas do período que já estavam aprovadas e foram canceladas, com motivo." />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {view === "calendario" ? (
            <>
              <div className="flex items-center gap-1 self-start rounded-xl border border-border/60 bg-card p-1 shadow-sm">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mês anterior" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setPickedDay(null); }}>Hoje</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Próximo mês" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
                <span className="px-2 text-sm font-semibold">{MONTHS_FULL[month.getMonth()]} de {month.getFullYear()}</span>
              </div>
              <MonthGrid month={month} list={calendarList} onOpen={setDetail} highlightId={null}
                selected={selectedDay} onSelect={setPickedDay} holidays={holidayMap} custom={customHolidays}
                hint={isMobile ? "Toque num dia para ver a agenda dele" : "Clique numa visita para ver os detalhes · clique num dia para ver a agenda dele"} />
              <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">{WD[selectedDay.getDay()].replace(/^./, c => c.toUpperCase())}, {selectedDay.getDate()} de {MONTHS_FULL[selectedDay.getMonth()]}</h2>
                  <span className="ml-auto text-[11px] text-muted-foreground">{dayVisits.length ? `${dayVisits.length} visita${dayVisits.length > 1 ? "s" : ""}` : ""}</span>
                </div>
                {dayVisits.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma visita neste dia.</p>
                ) : (
                  <ul>{dayVisits.map(v => <VisitCard key={v.id} v={v} now={now} customHolidays={customHolidays} />)}</ul>
                )}
              </section>
            </>
          ) : (<>
          {!isMobile && <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <CalendarClock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Próximas visitas</h2>
              <span className="ml-auto text-[11px] text-muted-foreground">{upcoming.length}</span>
            </div>
            {upcoming.length === 0 ? (
              <EmptyBlock icon={CalendarCheck} title="Nenhuma visita agendada" text="Quando o Aprovador alocar você numa visita, ela aparece aqui." />
            ) : (
              <ul>{upcoming.map(v => <VisitCard key={v.id} v={v} now={now} customHolidays={customHolidays} />)}</ul>
            )}
          </section>}

          <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <CalendarCheck className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Histórico · {periodLabel}</h2>
              <span className="ml-auto text-[11px] text-muted-foreground">{history.length}</span>
            </div>
            {history.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma visita realizada ou cancelada neste período.</p>
            ) : (
              <ul>{history.map(v => <VisitCard key={v.id} v={v} now={now} compact customHolidays={customHolidays} />)}</ul>
            )}
          </section>
          </>)}
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <ProjectsCard title="Em atendimento" icon={FolderKanban} items={projects.active} empty="Nenhum projeto com visita agendada." />
          <ProjectsCard title="Já atendidos" icon={CalendarCheck} items={projects.done} empty="Ainda não há projetos atendidos." />
        </aside>
      </div>
      <RequestDetailSheet request={detail} open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }} mode="cal" />
    </div>
  );
}

function VisitCard({ v, now, compact = false, customHolidays }: {
  v: AgendaVisit; now: Date; compact?: boolean; customHolidays: Parameters<typeof HolidayWarning>[0]["custom"];
}) {
  const start = new Date(v.start), end = new Date(v.end);
  const r = resultOf(v, now);
  const today = start <= now && end >= now;
  return (
    <li className={`border-l-[3px] border-t border-border/60 px-4 py-3 first:border-t-0 ${r.border} ${today ? "bg-primary/[0.04]" : ""}`}>
      <div className="flex gap-3">
        <span className="w-11 shrink-0 text-center">
          <span className="block text-[10px] uppercase text-muted-foreground">{WD[start.getDay()]}</span>
          <span className="block text-xl font-bold leading-none">{start.getDate()}</span>
          <span className="block text-[10px] uppercase text-muted-foreground">{MONTHS[start.getMonth()]}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold">{v.project.company_name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.cls}`}>{today && v.status === "aprovada" && !v.attendance ? "Hoje" : r.label}</span>
          </div>
          <p className="text-xs text-muted-foreground">{v.visit_purpose}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{formatPeriod(start, end)}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{formatLocation(v.project.city, v.project.state, v.project.country_code)}</span>
            <span className="flex items-center gap-1"><UserRound className="h-3 w-3" />GP: <b className="font-medium text-foreground/80">{v.project.manager_name ?? "—"}</b></span>
          </p>
          {!compact && (
            <>
              {v.location && <p className="mt-1 text-[11px] text-muted-foreground"><b className="font-medium text-foreground/80">Local:</b> {v.location}</p>}
              {v.notes && <p className="mt-1 whitespace-pre-line text-[11px] text-muted-foreground">“{v.notes}”</p>}
              {v.colleagues.length > 0 && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><UsersRound className="h-3 w-3" />Com {v.colleagues.map(c => c.full_name).join(", ")}</p>
              )}
              <div className="mt-2"><HolidayWarning start={start} end={end} custom={customHolidays} place={{ city: v.project.city, state: v.project.state }} /></div>
            </>
          )}
          {v.status === "cancelada" && v.cancel_reason && <p className="mt-1 text-[11px] text-muted-foreground"><b className="font-medium">Motivo:</b> {v.cancel_reason}</p>}
          {v.attendance && v.attendance_note && <p className="mt-1 text-[11px] text-muted-foreground"><b className="font-medium">Obs.:</b> {v.attendance_note}</p>}
        </div>
      </div>
    </li>
  );
}

function ProjectsCard({ title, icon: Icon, items, empty }: {
  title: string; icon: typeof HardHat; items: { p: AgendaVisit["project"]; visits: number }[]; empty: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-5 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul>
          {items.map(({ p, visits }) => (
            <li key={p.id} className="border-t border-border/60 px-4 py-2.5 first:border-t-0">
              <p className="truncate text-xs font-semibold">{p.company_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {formatLocation(p.city, p.state, p.country_code)} · GP: {p.manager_name ?? "—"} · {visits} visita{visits !== 1 ? "s" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
