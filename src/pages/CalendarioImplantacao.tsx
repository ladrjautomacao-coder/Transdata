import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarOff, CalendarX, Inbox, Plus, RefreshCw, Search, WifiOff, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCustomHolidays } from "@/hooks/useCustomHolidays";
import { useCityIndex } from "@/hooks/useCityIndex";
import { holidaysByDay } from "@/lib/holidays";
import {
  errorMessage, fetchRequests, fetchTechnicians, techniciansOf,
  type EligibleProject, type ImplantationRequest, type Technician,
} from "@/lib/implantationScheduling";
import {
  MONTH_LONG, WEEK_OPTIONS, VISIT_KIND, VISIT_KIND_ORDER, VISIT_STATE, VISIT_STATE_FILTER, computeAlerts, coversDay, fmtWeekRange,
  lastWorkdayUntil, mondayOf, placeLabel, placeOf, plusDays, startOfDay, techLoad, visitDays, visitKindOf, visitState,
  type AgendaAlert, type VisitKind, type VisitState,
} from "@/lib/agendaTecnica";
import { EmptyBlock } from "@/components/agendamento/AgendaShared";
import { RejectDialog, RequestDetailSheet, RequestDialog, TechniciansDialog } from "@/components/agendamento/AgendaDialogs";
import { HolidaysDialog } from "@/components/agendamento/HolidaysDialog";
import { TechnicianTimeline } from "@/components/agendamento/TechnicianTimeline";
import { DayVisits, MonthGrid } from "@/components/agendamento/MonthGrid";
import { MonthGantt } from "@/components/agendamento/MonthGantt";
import { AgendaLegend } from "@/components/agendamento/AgendaPanels";
import { AssignSheet } from "@/components/agendamento/AssignSheet";
import { NewVisitDialog } from "@/components/agendamento/NewVisitDialog";
import { AgendaListView, AgendaToolbar, type AgendaView } from "@/components/agendamento/AgendaViews";

type View = AgendaView;
const VIEW_KEY = "transdata:implantacao-calendario-view";
const WEEKS_KEY = "transdata:implantacao-calendario-semanas";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/** Filtro em forma de botão (mostra o nome do filtro ou o valor escolhido). */
function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  const current = options.find(o => o.value === value);
  return (
    <Select value={value || "all"} onValueChange={v => onChange(v === "all" ? "" : v)}>
      <SelectTrigger aria-label={label} className={`h-10 w-auto min-w-0 max-w-[220px] gap-1.5 rounded-xl px-3 text-[13px] ${current ? "border-primary/40 bg-primary/5 font-medium text-primary" : "bg-card"}`}>
        <span className="truncate">{current ? current.label : label}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: todos</SelectItem>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function CalendarioImplantacao() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canApprove = can("agenda_solicitacao", "approve");
  const canRequest = can("agenda_solicitacao", "create");
  const canManageTechs = can("agenda_tecnicos", "edit");
  const canSeeRequests = can("agenda_solicitacao", "view");
  const isMobile = useIsMobile();

  const [requests, setRequests] = useState<ImplantationRequest[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setViewState] = useState<View>(() => {
    try { const v = localStorage.getItem(VIEW_KEY) as View; return v === "mes" || v === "lista" ? v : "tecnico"; } catch { return "tecnico"; }
  });
  const [weeks, setWeeksState] = useState<number>(() => {
    try {
      const n = Number(localStorage.getItem(WEEKS_KEY));
      if ((WEEK_OPTIONS as readonly number[]).includes(n)) return n;
    } catch { /* ignora */ }
    return 1;
  });

  // ?data=AAAA-MM-DD&destaque=<id>: abre já na data da visita, com ela destacada
  const [params, setParams] = useSearchParams();
  const linkDate = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.get("data") ?? "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  })();
  const [anchor, setAnchor] = useState(() => {
    const t = linkDate ?? new Date();
    return view === "mes" ? firstOfMonth(t) : mondayOf(t);
  });
  const [highlightId, setHighlightId] = useState<string | null>(() => params.get("destaque"));

  // filtros
  const [search, setSearch] = useState("");
  const [techFilter, setTechFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [ufFilter, setUfFilter] = useState("");

  // janelas
  const [detail, setDetail] = useState<ImplantationRequest | null>(null);
  const [assign, setAssign] = useState<{ r: ImplantationRequest; techs?: string[] } | null>(null);
  const [rejecting, setRejecting] = useState<ImplantationRequest | null>(null);
  const [techOpen, setTechOpen] = useState(false);
  const [newVisitOpen, setNewVisitOpen] = useState(false);
  const [reqProject, setReqProject] = useState<EligibleProject | null>(null);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const [pickedDay, setPickedDay] = useState<Date | null>(null);

  const { custom: customHolidays, reload: reloadHolidays } = useCustomHolidays();
  const index = useCityIndex();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [reqs, techs] = await Promise.all([fetchRequests(), fetchTechnicians()]);
      setRequests(reqs); setTechnicians(techs);
      return reqs;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Rola até a visita destacada e tira o destaque depois de alguns segundos
  useEffect(() => {
    if (loading || !highlightId) return;
    const el = document.querySelector(`[data-req="${highlightId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const t = setTimeout(() => setHighlightId(null), 6000);
    if (params.get("destaque") || params.get("data")) setParams({}, { replace: true });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, highlightId, view]);

  const setView = (v: View) => {
    setViewState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignora */ }
    const today = new Date();
    if (v === "mes") setAnchor(a => (view === "mes" ? a : firstOfMonth(a)));
    else if (view === "mes") setAnchor(a => (a.getFullYear() === today.getFullYear() && a.getMonth() === today.getMonth() ? mondayOf(today) : mondayOf(a)));
  };
  const setWeeks = (n: number) => { setWeeksState(n); try { localStorage.setItem(WEEKS_KEY, String(n)); } catch { /* ignora */ } };
  const nav = (n: number) => setAnchor(a => (view === "mes" ? new Date(a.getFullYear(), a.getMonth() + n, 1) : plusDays(a, 7 * weeks * n)));
  const goToday = () => { const t = new Date(); setAnchor(view === "mes" ? firstOfMonth(t) : mondayOf(t)); };

  /* ─── período, feriados e filtros ─── */
  const today = useMemo(() => startOfDay(new Date()), [requests]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [requests]); // eslint-disable-line react-hooks/exhaustive-deps
  const rangeStart = view === "mes" ? firstOfMonth(anchor) : startOfDay(anchor);
  const rangeEnd = view === "mes" ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) : plusDays(anchor, weeks * 7 - 1);
  const holidayMap = useMemo(() => {
    const y = rangeStart.getFullYear();
    return holidaysByDay([y - 1, y, y + 1], customHolidays);
  }, [rangeStart.getFullYear(), customHolidays]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useMemo(() => requests.filter(r => r.status === "aprovada" || r.status === "pendente"), [requests]);
  const approvedAll = useMemo(() => requests.filter(r => r.status === "aprovada"), [requests]);
  const inRange = useCallback((r: ImplantationRequest) => +visitDays(r).first <= +rangeEnd && +visitDays(r).last >= +rangeStart, [+rangeStart, +rangeEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    return active.filter(r => {
      if (q) {
        const hay = norm(`${r.project?.company_name ?? ""} ${r.project?.project_code ?? ""} ${placeLabel(placeOf(r))} ${r.location ?? ""} ${r.project?.manager?.full_name ?? ""} ${r.requester_name ?? ""} ${r.visit_purpose} ${techniciansOf(r).map(t => t.full_name).join(" ")}`);
        if (!hay.includes(q)) return false;
      }
      if (techFilter && !techniciansOf(r).some(t => t.id === techFilter)) return false;
      if (kindFilter && visitKindOf(r.visit_purpose) !== kindFilter) return false;
      if (stateFilter && visitState(r, now) !== stateFilter) return false;
      if (ufFilter && (r.project?.state ?? "") !== ufFilter) return false;
      return true;
    });
  }, [active, search, techFilter, kindFilter, stateFilter, ufFilter, now]);
  const approvedF = useMemo(() => filtered.filter(r => r.status === "aprovada"), [filtered]);
  const pendingF = useMemo(() => filtered.filter(r => r.status === "pendente"), [filtered]);
  const filtersOn = !!(search || techFilter || kindFilter || stateFilter || ufFilter);
  const clearFilters = () => { setSearch(""); setTechFilter(""); setKindFilter(""); setStateFilter(""); setUfFilter(""); };

  // técnicos: ativos + quem estiver alocado no período (mesmo se inativado depois);
  // removido do cadastro não volta como linha — o nome fica só no detalhe da visita
  const allTechs = useMemo(() => {
    const map = new Map<string, Technician>(technicians.map(t => [t.id, t]));
    approvedAll.filter(inRange).forEach(r => techniciansOf(r).forEach(t => { if (!t.removed_at && !map.has(t.id)) map.set(t.id, t); }));
    return [...map.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [technicians, approvedAll, inRange]);
  const rowTechs = useMemo(() => allTechs.filter(t => !techFilter || t.id === techFilter), [allTechs, techFilter]);

  /* ─── carga, indicadores e alertas ─── */
  const winFrom = +today > +rangeStart ? today : rangeStart;
  const winTo = lastWorkdayUntil(rangeEnd, holidayMap);
  const loadUntil = +winTo >= +winFrom ? winTo : null;
  const loads = useMemo(() => new Map(allTechs.map(t => [t.id, techLoad(t, approvedAll, winFrom, loadUntil ?? plusDays(winFrom, -1), holidayMap, today)])),
    [allTechs, approvedAll, +winFrom, +(loadUntil ?? 0), holidayMap, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const todayList = approvedAll.filter(r => coversDay(r, today));
  const inField = new Set(todayList.flatMap(r => techniciansOf(r).filter(t => !t.removed_at).map(t => t.id))).size;

  const alerts = useMemo(() => computeAlerts({
    techs: allTechs, approved: approvedAll, from: rangeStart, to: rangeEnd, today, holidays: holidayMap, custom: customHolidays, index,
  }).filter(a => !techFilter || a.techId === techFilter),
  [allTechs, approvedAll, +rangeStart, +rangeEnd, today, holidayMap, customHolidays, index, techFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const conflicts = alerts.filter(a => a.kind === "conflito").length;
  const alertsByRequest = useMemo(() => {
    const m = new Map<string, AgendaAlert[]>();
    for (const a of alerts) {
      if (a.kind === "sem_dia_livre") continue; // alerta do técnico, não de uma visita
      // "sem folga" marca a visita de chegada; conflito marca as duas
      for (const id of a.kind === "sem_folga" ? a.requestIds.slice(1) : a.requestIds) m.set(id, [...(m.get(id) ?? []), a]);
    }
    return m;
  }, [alerts]);

  const kindsInView = VISIT_KIND_ORDER.filter(k => approvedF.some(r => inRange(r) && visitKindOf(r.visit_purpose) === k));
  const visibleCount = filtered.filter(inRange).length;
  const pendingAll = requests.filter(r => r.status === "pendente");
  const openAssign = (r: ImplantationRequest, techId?: string) => setAssign({ r, techs: techId ? [techId] : undefined });
  const pickAlert = (a: AgendaAlert) => {
    if (view === "lista") setView("tecnico");
    setHighlightId(null);
    setTimeout(() => setHighlightId(a.requestIds[0] ?? null), 0);
  };

  const spanLabel = view === "mes"
    ? `${MONTH_LONG[anchor.getMonth()].replace(/^./, c => c.toUpperCase())} ${anchor.getFullYear()}`
    : `${fmtWeekRange(rangeStart, rangeEnd)} ${rangeEnd.getFullYear()}`;

  const freeToday = technicians.filter(t => !todayList.some(r => techniciansOf(r).some(x => x.id === t.id))).length;
  const summarySentence = technicians.length === 0
    ? "Sem técnicos cadastrados."
    : `Hoje: ${inField} em campo, ${freeToday} livre${freeToday === 1 ? "" : "s"}${pendingAll.length ? ` · ${pendingAll.length} pedido${pendingAll.length === 1 ? "" : "s"} aguardando técnico` : ""}.`;
  const header = (
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-0 basis-[420px] flex-1">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Implantação</span>
        <h1 className="text-2xl font-bold tracking-tight">Agenda técnica</h1>
        <p className="text-sm text-muted-foreground">{summarySentence}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="h-10" onClick={() => setHolidaysOpen(true)}><CalendarOff className="mr-1.5 h-4 w-4" />Feriados</Button>
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => { setLoading(true); void load(); }} aria-label="Atualizar" title="Atualizar"><RefreshCw className="h-4 w-4" /></Button>
        {(canApprove || canSeeRequests) && (
          <Button variant="outline" className="h-10" onClick={() => navigate(canApprove ? "/implantacao/aprovacao" : "/implantacao/solicitacoes")}>
            <Inbox className="mr-1.5 h-4 w-4" />Solicitações
            {pendingAll.length > 0 && <span className="ml-2 flex h-5 min-w-[22px] items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">{pendingAll.length}</span>}
          </Button>
        )}
        {canRequest && <Button className="h-10" onClick={() => setNewVisitOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Nova visita</Button>}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Skeleton className="h-10 w-full max-w-2xl rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5">
          <EmptyBlock icon={WifiOff} title="Não foi possível carregar a agenda" text={error}
            action={<Button onClick={() => { setLoading(true); void load(); }}><RefreshCw className="mr-1.5 h-4 w-4" />Tentar novamente</Button>} />
        </div>
      </div>
    );
  }

  const toolbar = (
    <AgendaToolbar view={view} onView={setView} weeks={weeks} onWeeks={setWeeks} spanLabel={spanLabel} onToday={goToday} onNav={nav} />
  );

  const ufs = [...new Set(active.map(r => r.project?.state).filter(Boolean) as string[])].sort();
  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-[1_1_240px] sm:max-w-[320px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, cidade, código ou GP" aria-label="Buscar na agenda" className="h-10 rounded-xl bg-card pl-9 text-[13px]" />
      </div>
      <FilterSelect label="Técnico" value={techFilter} onChange={setTechFilter} options={allTechs.map(t => ({ value: t.id, label: t.full_name }))} />
      <FilterSelect label="Tipo de visita" value={kindFilter} onChange={setKindFilter}
        options={VISIT_KIND_ORDER.filter(k => active.some(r => visitKindOf(r.visit_purpose) === k)).map(k => ({ value: k, label: VISIT_KIND[k as VisitKind].label }))} />
      <FilterSelect label="Status" value={stateFilter} onChange={setStateFilter}
        options={VISIT_STATE_FILTER.map(s => ({ value: s, label: s === "pendente" ? "Pendente de aprovação" : VISIT_STATE[s as VisitState].label }))} />
      <FilterSelect label="UF" value={ufFilter} onChange={setUfFilter} options={ufs.map(u => ({ value: u, label: u }))} />
      {filtersOn && <Button variant="ghost" size="sm" className="h-10 text-[13px]" onClick={clearFilters}><X className="mr-1 h-4 w-4" />Limpar</Button>}
      <span className="ml-auto whitespace-nowrap text-[13px] text-muted-foreground">{visibleCount} visita{visibleCount !== 1 ? "s" : ""} no período</span>
    </div>
  );

  let body;
  if (active.length === 0 && technicians.length === 0) {
    body = (
      <div className="rounded-xl border border-border/60 bg-card">
        <EmptyBlock icon={CalendarX} title="Agenda vazia" text="Cadastre os técnicos em Aprovação de agenda › Técnicos. As visitas aparecem aqui quando os Gerentes de Projeto solicitam e o Aprovador aprova."
          action={canManageTechs ? <Button onClick={() => setTechOpen(true)}>Cadastrar técnicos</Button> : undefined} />
      </div>
    );
  } else if (view === "tecnico") {
    body = (
      <section aria-label={`Linha do tempo por técnico, ${spanLabel}`} className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <TechnicianTimeline start={rangeStart} weeks={weeks} techs={rowTechs} approved={approvedF}
          loads={loads} loadUntil={loadUntil} holidays={holidayMap} alertsByRequest={alertsByRequest}
          highlightId={highlightId} onOpen={setDetail} onAssign={canApprove ? openAssign : undefined} />
        <AgendaLegend kinds={kindsInView} hint={filtersOn ? "Filtros ativos: algumas visitas estão ocultas" : undefined} />
      </section>
    );
  } else if (view === "mes") {
    const nowD = new Date();
    const selectedDay = pickedDay && pickedDay.getMonth() === anchor.getMonth() && pickedDay.getFullYear() === anchor.getFullYear()
      ? pickedDay : nowD.getMonth() === anchor.getMonth() && nowD.getFullYear() === anchor.getFullYear() ? today : anchor;
    body = isMobile ? (
      <div className="flex flex-col gap-4">
        <MonthGrid month={anchor} list={filtered} onOpen={setDetail} onAssign={canApprove ? r => openAssign(r) : undefined}
          highlightId={highlightId} selected={selectedDay} holidays={holidayMap} custom={customHolidays} alertsByRequest={alertsByRequest}
          onSelect={d => { setPickedDay(d); }} />
        <DayVisits list={filtered} selected={selectedDay} holidays={holidayMap} onOpen={setDetail} onAssign={canApprove ? r => openAssign(r) : undefined} />
      </div>
    ) : (
      <MonthGantt month={anchor} techs={rowTechs} approved={approvedF}
        loads={loads} loadUntil={loadUntil} holidays={holidayMap}
        alertsByRequest={alertsByRequest} highlightId={highlightId} onOpen={setDetail} />
    );
  } else {
    body = <AgendaListView list={filtered.filter(inRange)} onOpen={setDetail} onAssign={canApprove ? r => openAssign(r) : undefined}
      highlightId={highlightId} alertsByRequest={alertsByRequest} filtersOn={filtersOn} onClear={clearFilters} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      {toolbar}
      {filters}
      {body}

      <RequestDetailSheet request={detail} open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }} mode={canApprove ? "ap" : "cal"}
        onApprove={() => { if (detail) openAssign(detail); setDetail(null); }}
        onReject={() => { setRejecting(detail); setDetail(null); }}
        onResultChanged={canApprove ? () => { setDetail(null); void load(); } : undefined} />
      <AssignSheet request={assign?.r ?? null} open={!!assign} initialSelected={assign?.techs}
        onOpenChange={o => { if (!o) setAssign(null); }} technicians={technicians} allRequests={requests}
        onDone={() => void load()} onReject={r => { setAssign(null); setRejecting(r); }}
        onManageTechnicians={canManageTechs ? () => setTechOpen(true) : undefined}
        onTechnicianAdded={t => setTechnicians(list => [...list, t].sort((a, b) => a.full_name.localeCompare(b.full_name)))} />
      <RejectDialog request={rejecting} open={!!rejecting} onOpenChange={o => { if (!o) setRejecting(null); }} onDone={() => void load()} />
      <TechniciansDialog open={techOpen} onOpenChange={setTechOpen} onChanged={() => fetchTechnicians().then(setTechnicians).catch(() => undefined)} />
      <NewVisitDialog open={newVisitOpen} onOpenChange={setNewVisitOpen} onPick={setReqProject} />
      <RequestDialog project={reqProject} open={!!reqProject} onOpenChange={o => { if (!o) setReqProject(null); }} existing={requests}
        onCreated={async () => {
          const projectId = reqProject?.id;
          const fresh = await load();
          // quem aprova já segue para a atribuição do técnico
          if (canApprove && fresh && projectId) {
            const mine = fresh.filter(r => r.project_id === projectId && r.status === "pendente" && r.requested_by === user?.id)
              .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
            if (mine) openAssign(mine);
          }
        }} />
      <HolidaysDialog open={holidaysOpen} onOpenChange={setHolidaysOpen} custom={customHolidays} canEdit={canManageTechs} onChanged={reloadHolidays} />
    </div>
  );
}
