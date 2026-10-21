import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarDays, FolderKanban, RefreshCw, Smartphone, UserX, WifiOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCustomHolidays } from "@/hooks/useCustomHolidays";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyBlock } from "@/components/agendamento/AgendaShared";
import { InstallAppButton } from "@/pwa/InstallAppButton";
import { RequestDetailSheet } from "@/components/agendamento/AgendaDialogs";
import { DayVisits, MonthGrid } from "@/components/agendamento/MonthGrid";
import { MonthGantt } from "@/components/agendamento/MonthGantt";
import { TechnicianTimeline } from "@/components/agendamento/TechnicianTimeline";
import { AgendaLegend } from "@/components/agendamento/AgendaPanels";
import { AgendaListView, AgendaToolbar, type AgendaView } from "@/components/agendamento/AgendaViews";
import { MinhaAgendaHeader } from "@/components/agendamento/MinhaAgenda";
import { ProjectBriefPanel } from "@/components/agendamento/ProjectBriefPanel";
import { holidaysByDay } from "@/lib/holidays";
import { formatLocation } from "@/lib/location";
import {
  MONTH_LONG, VISIT_KIND_ORDER, WEEK_OPTIONS, dayDiff, fmtDM, fmtDayRange, fmtWeekRange, lastWorkdayUntil, mondayOf, plusDays, startOfDay,
  techLoad, visitDays, visitKindOf,
} from "@/lib/agendaTecnica";
import {
  colorFor, errorMessage, fetchProjectBrief, fetchTechnicianAgenda, fetchTechnicians, initials,
  type AgendaVisit, type ImplantationRequest, type ProjectBrief, type Technician, type TechnicianAgenda,
} from "@/lib/implantationScheduling";

// mesma visão e semanas da Agenda técnica: o técnico vê a agenda dele do jeito padrão
const VIEW_KEY = "transdata:implantacao-calendario-view";
const WEEKS_KEY = "transdata:implantacao-calendario-semanas";
const TAB_KEY = "transdata:area-implantador-aba";
type Tab = "projeto" | "agenda";
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const read = <T,>(key: string, ok: (v: string) => boolean, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v != null && ok(v) ? (v as unknown as T) : fallback; } catch { return fallback; }
};
const save = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* ignora */ } };

/** Visita da Área no formato usado pela agenda e pelo detalhe. */
function toRequest(v: AgendaVisit, tech: NonNullable<TechnicianAgenda["technician"]>): ImplantationRequest {
  const t = (id: string, full_name: string, photo_url?: string | null) => ({ technician: { id, full_name, email: null, area: null, active: true, photo_url } });
  return {
    id: v.id, project_id: v.project.id, requested_by: null, requester_name: v.requester_name,
    visit_purpose: v.visit_purpose, visit_purpose_is_custom: false,
    requested_start: v.start, requested_end: v.end, location: v.location, notes: v.notes, status: v.status,
    visit_format: v.visit_format, address_street: v.address_street, address_district: v.address_district,
    address_city: v.address_city, address_state: v.address_state, meeting_url: v.meeting_url,
    approved_start: v.start, approved_end: v.end, reviewer_name: v.reviewer_name, reviewed_at: null, rejection_reason: null,
    attendance: v.attendance, attendance_note: v.attendance_note, attended_by_name: v.attended_by_name, attended_at: v.attended_at,
    cancel_reason: v.cancel_reason, created_at: v.start,
    project: { id: v.project.id, company_name: v.project.company_name, project_code: v.project.project_code, city: v.project.city,
      state: v.project.state, country_code: v.project.country_code, manager: v.project.manager_name ? { full_name: v.project.manager_name } : null },
    members: [t(tech.id, tech.full_name, tech.photo_url), ...v.colleagues.map(c => t(c.id, c.full_name, c.photo_url))],
  };
}

/** Marca do projeto na lista: iniciais na cor do projeto e ponto da fase. */
function ProjectMark({ id, name, phase }: { id: string; name: string; phase: Phase }) {
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: colorFor(id) }}>
      {initials(name)}
      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${PHASE[phase].dot}`} />
    </span>
  );
}

type Phase = "agora" | "proximo" | "atendido";
const PHASE: Record<Phase, { title: string; dot: string }> = {
  agora: { title: "Em atendimento", dot: "bg-emerald-500" },
  proximo: { title: "Próximos", dot: "bg-primary" },
  atendido: { title: "Já atendidos", dot: "bg-muted-foreground/40" },
};
interface ProjectEntry { id: string; name: string; place: string; phase: Phase; visit: AgendaVisit; when: string }

/** Projetos do técnico com a visita que importa agora: a em andamento, senão a próxima, senão a última. */
function projectsOf(visits: AgendaVisit[], now: Date): ProjectEntry[] {
  const today = startOfDay(now);
  const byProject = new Map<string, AgendaVisit[]>();
  for (const v of visits) if (v.status === "aprovada") byProject.set(v.project.id, [...(byProject.get(v.project.id) ?? []), v]);
  const days = (v: AgendaVisit) => {
    const s = new Date(v.start), e = new Date(v.end);
    return { first: startOfDay(s), last: startOfDay(e > s ? new Date(+e - 1) : s) };
  };
  const out: (ProjectEntry & { sort: number })[] = [];
  for (const list of byProject.values()) {
    list.sort((a, b) => +new Date(a.start) - +new Date(b.start));
    const cur = list.find(v => +days(v).first <= +today && +today <= +days(v).last);
    const next = list.find(v => +days(v).first > +today);
    const last = [...list].reverse().find(v => +days(v).last < +today);
    const visit = cur ?? next ?? last!;
    const phase: Phase = cur ? "agora" : next ? "proximo" : "atendido";
    const { first, last: end } = days(visit);
    const range = fmtDayRange(first, end);
    const d = dayDiff(today, first);
    out.push({
      id: visit.project.id, name: visit.project.company_name, visit, phase,
      place: formatLocation(visit.project.city, visit.project.state, visit.project.country_code),
      when: phase === "agora" ? `até ${fmtDM(end)}` : phase === "proximo" ? `${range} · ${d === 1 ? "amanhã" : `em ${d} dias`}` : range,
      sort: phase === "atendido" ? -+end : +first,
    });
  }
  const order: Phase[] = ["agora", "proximo", "atendido"];
  return out.sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase) || a.sort - b.sort);
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
  const [detail, setDetail] = useState<ImplantationRequest | null>(null);
  const { custom: customHolidays } = useCustomHolidays();

  const [tab, setTabState] = useState<Tab>(() => read<Tab>(TAB_KEY, v => v === "agenda" || v === "projeto", "projeto"));
  const setTab = (t: Tab) => { setTabState(t); save(TAB_KEY, t); };

  // ficha do projeto escolhido (guardada por projeto até o próximo "Atualizar")
  const [picked, setPicked] = useState<string | null>(null);
  const [briefs, setBriefs] = useState<Record<string, { data?: ProjectBrief; error?: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBriefs({});
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
  const projects = useMemo(() => projectsOf(visits, now), [visits, now]);
  const current = projects.find(p => p.id === picked) ?? projects[0] ?? null;

  const loadBrief = useCallback((projectId: string) => {
    setBriefs(b => ({ ...b, [projectId]: {} }));
    fetchProjectBrief(projectId)
      .then(data => setBriefs(b => ({ ...b, [projectId]: { data } })))
      .catch(e => setBriefs(b => ({ ...b, [projectId]: { error: errorMessage(e) } })));
  }, []);
  const currentId = current?.id;
  useEffect(() => {
    if (tab === "projeto" && currentId && !(currentId in briefs)) loadBrief(currentId);
  }, [tab, currentId, briefs, loadBrief]);

  /* ─── agenda no padrão da Agenda técnica ─── */
  const [view, setViewState] = useState<AgendaView>(() => read<AgendaView>(VIEW_KEY, v => v === "mes" || v === "lista" || v === "tecnico", "tecnico"));
  const [weeks, setWeeksState] = useState<number>(() => {
    const n = Number(read<string>(WEEKS_KEY, () => true, "1"));
    return (WEEK_OPTIONS as readonly number[]).includes(n) ? n : 1;
  });
  const [anchor, setAnchor] = useState(() => (view === "mes" ? firstOfMonth(new Date()) : mondayOf(new Date())));
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const setView = (v: AgendaView) => {
    setViewState(v); save(VIEW_KEY, v);
    const t = new Date();
    if (v === "mes") setAnchor(a => (view === "mes" ? a : firstOfMonth(a)));
    else if (view === "mes") setAnchor(a => (a.getFullYear() === t.getFullYear() && a.getMonth() === t.getMonth() ? mondayOf(t) : mondayOf(a)));
  };
  const setWeeks = (n: number) => { setWeeksState(n); save(WEEKS_KEY, String(n)); };
  const nav = (n: number) => setAnchor(a => (view === "mes" ? new Date(a.getFullYear(), a.getMonth() + n, 1) : plusDays(a, 7 * weeks * n)));
  const goToday = () => { const t = new Date(); setAnchor(view === "mes" ? firstOfMonth(t) : mondayOf(t)); setPickedDay(null); };

  const today = startOfDay(now);
  const rangeStart = view === "mes" ? firstOfMonth(anchor) : startOfDay(anchor);
  const rangeEnd = view === "mes" ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) : plusDays(anchor, weeks * 7 - 1);
  const holidayMap = useMemo(() => {
    const y = rangeStart.getFullYear();
    return holidaysByDay([y - 1, y, y + 1], customHolidays);
  }, [rangeStart.getFullYear(), customHolidays]); // eslint-disable-line react-hooks/exhaustive-deps
  const calendarList = useMemo(() => agenda?.technician
    ? visits.filter(v => v.status === "aprovada").map(v => toRequest(v, agenda.technician!)) : [], [visits, agenda]);
  const inRange = (r: ImplantationRequest) => +visitDays(r).first <= +rangeEnd && +visitDays(r).last >= +rangeStart;
  const spanLabel = view === "mes"
    ? `${MONTH_LONG[anchor.getMonth()].replace(/^./, c => c.toUpperCase())} ${anchor.getFullYear()}`
    : `${fmtWeekRange(rangeStart, rangeEnd)} ${rangeEnd.getFullYear()}`;

  const isStandalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;
  const techName = agenda?.technician?.full_name;

  const techPicker = canPickOther && (
    <Select value={techId ?? "me"} onValueChange={v => { setTechId(v === "me" ? null : v); setPicked(null); }}>
      <SelectTrigger className={`h-9 text-xs ${isMobile ? "flex-1" : "w-[220px]"}`} aria-label="Técnico"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="me">Minha agenda</SelectItem>
        {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const header = (
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1 basis-64">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Implantação</span>
        <h1 className="text-2xl font-bold tracking-tight">Área do Implantador</h1>
        <p className="text-sm text-muted-foreground">
          {techName ? <>Projetos e agenda de <b className="text-foreground">{techName}</b>.</> : "Seus projetos e sua agenda de visitas técnicas."}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
        {techPicker}
        <Button variant="outline" size="sm" className="h-9" onClick={() => void load()}><RefreshCw className="mr-1.5 h-4 w-4" />Atualizar</Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-80 rounded-2xl" /></div>
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

  const tech: Technician = { ...agenda.technician, active: true };
  const brief = current ? briefs[current.id] : undefined;

  /* ─── aba Projeto ─── */
  const projectTab = projects.length === 0 ? (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <EmptyBlock icon={CalendarCheck} title="Nenhuma visita agendada"
        text="Quando o Aprovador alocar você numa visita, o projeto aparece aqui com todas as informações para o atendimento." />
    </div>
  ) : (
    <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label="Seus projetos" className="min-w-0 lg:sticky lg:top-4">
        {/* celular: projetos lado a lado; computador: lista agrupada */}
        <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 lg:hidden">
          {projects.map(p => {
            const on = p.id === current?.id;
            return (
              <button key={p.id} type="button" onClick={() => setPicked(p.id)} aria-current={on ? "true" : undefined}
                className={`flex w-[230px] shrink-0 items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${on ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border/60 bg-card"}`}>
                <ProjectMark id={p.id} name={p.name} phase={p.phase} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{PHASE[p.phase].title} · {p.when}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm lg:block">
          <p className="border-b border-border/60 px-4 py-3 text-sm font-semibold">Seus projetos <span className="ml-1 font-normal text-muted-foreground">{projects.length}</span></p>
          {(["agora", "proximo", "atendido"] as const).filter(ph => projects.some(p => p.phase === ph)).map(ph => (
            <div key={ph} className="px-2 pb-2 pt-3">
              <p className="flex items-center gap-1.5 px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${PHASE[ph].dot}`} />{PHASE[ph].title}
              </p>
              <ul className="flex flex-col gap-1">
                {projects.filter(p => p.phase === ph).map(p => {
                  const on = p.id === current?.id;
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => setPicked(p.id)} aria-current={on ? "true" : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${on ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/60"}`}>
                        <ProjectMark id={p.id} name={p.name} phase={p.phase} />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm ${on ? "font-semibold text-primary" : "font-medium"}`}>{p.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{p.place} · {p.when}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      {current && (
        <ProjectBriefPanel key={current.id} visit={current.visit} tech={tech} brief={brief?.data ?? null}
          loading={!brief || (!brief.data && !brief.error)} error={brief?.error ?? null} onRetry={() => loadBrief(current.id)}
          onOpenVisit={() => setDetail(toRequest(current.visit, agenda.technician!))} now={now} custom={customHolidays} />
      )}
    </div>
  );

  /* ─── aba Agenda (mesma visualização da Agenda técnica) ─── */
  let agendaBody;
  if (view === "tecnico") {
    const winFrom = +today > +rangeStart ? today : rangeStart;
    const winTo = lastWorkdayUntil(rangeEnd, holidayMap);
    const loadUntil = +winTo >= +winFrom ? winTo : null;
    const loads = new Map([[tech.id, techLoad(tech, calendarList, winFrom, loadUntil ?? plusDays(winFrom, -1), holidayMap, today)]]);
    const kinds = VISIT_KIND_ORDER.filter(k => calendarList.some(r => inRange(r) && visitKindOf(r.visit_purpose) === k));
    agendaBody = (
      <section aria-label={`Linha do tempo, ${spanLabel}`} className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <TechnicianTimeline start={rangeStart} weeks={weeks} techs={[tech]} approved={calendarList}
          loads={loads} loadUntil={loadUntil} holidays={holidayMap} alertsByRequest={new Map()} highlightId={null} onOpen={setDetail} />
        <AgendaLegend kinds={kinds} />
      </section>
    );
  } else if (view === "mes") {
    const selectedDay = pickedDay && pickedDay.getMonth() === anchor.getMonth() && pickedDay.getFullYear() === anchor.getFullYear()
      ? pickedDay : today.getMonth() === anchor.getMonth() && today.getFullYear() === anchor.getFullYear() ? today : anchor;
    const winTo = lastWorkdayUntil(rangeEnd, holidayMap);
    const loads = new Map([[tech.id, techLoad(tech, calendarList, rangeStart, winTo, holidayMap, today)]]);
    agendaBody = isMobile ? (
      <div className="flex flex-col gap-4">
        <MonthGrid month={anchor} list={calendarList} onOpen={setDetail} highlightId={null} selected={selectedDay}
          holidays={holidayMap} custom={customHolidays} onSelect={setPickedDay} />
        <DayVisits list={calendarList} selected={selectedDay} holidays={holidayMap} onOpen={setDetail} />
      </div>
    ) : (
      <MonthGantt month={anchor} techs={[tech]} approved={calendarList} loads={loads} loadUntil={winTo}
        holidays={holidayMap} alertsByRequest={new Map()} highlightId={null} onOpen={setDetail} />
    );
  } else {
    agendaBody = <AgendaListView list={calendarList.filter(inRange)} onOpen={setDetail} highlightId={null} alertsByRequest={new Map()} />;
  }

  const upcoming = calendarList.filter(r => +visitDays(r).last >= +today).length;
  const tabs = (
    <div role="tablist" aria-label="Área do Implantador" className="flex h-12 w-full items-center gap-1 rounded-2xl bg-muted p-1 sm:w-fit">
      {([["projeto", "Projetos", FolderKanban, projects.length], ["agenda", "Minha agenda", CalendarDays, upcoming]] as const).map(([k, l, Icon, n]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
          className={`flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm transition-colors sm:flex-none sm:px-4 ${tab === k ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Icon className={`h-4 w-4 ${tab === k ? "text-primary" : ""}`} />{l}
          {n > 0 && <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${tab === k ? "bg-primary text-primary-foreground" : "bg-foreground/10"}`}>{n}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {isMobile ? (
        <>
          <MinhaAgendaHeader tech={tech} today={now} title={techId ? `Agenda de ${tech.full_name.split(" ")[0]}` : "Minha agenda"} />
          {canPickOther && (
            <div className="-mt-2 flex items-center gap-2">
              {techPicker}
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => void load()} aria-label="Atualizar"><RefreshCw className="h-4 w-4" /></Button>
            </div>
          )}
        </>
      ) : header}

      {tabs}

      {tab === "projeto" ? projectTab : (
        <div className="flex flex-col gap-4">
          <AgendaToolbar view={view} onView={setView} weeks={weeks} onWeeks={setWeeks} spanLabel={spanLabel} onToday={goToday} onNav={nav} />
          {agendaBody}
        </div>
      )}

      {isMobile && !isStandalone && (
        <div className="flex items-start gap-2.5 rounded-lg bg-sky-500/10 px-3.5 py-3 text-xs text-sky-800 dark:text-sky-200">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">Use a Área do Implantador como aplicativo no celular: instale o portal e entre pelo ícone da Transdata.</span>
          <InstallAppButton variant="inline" />
        </div>
      )}
      <RequestDetailSheet request={detail} open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }} mode="cal" />
    </div>
  );
}
