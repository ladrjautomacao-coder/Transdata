import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Ban, CalendarPlus, Check, CheckCircle2, ChevronDown, FolderKanban, FolderSearch, Hourglass, Inbox, Lock,
  RefreshCw, Search, SearchX, ShieldCheck, UserRound, UserRoundCog, UsersRound, WifiOff, X, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatLocation } from "@/lib/location";
import { statusLabels, subPhasesByStatus } from "@/pages/ProjectManagement";
import {
  ELIGIBLE_PROJECT_STATUSES, REQUEST_STATUS, errorMessage, fetchRequests, fetchTechnicians, periodOf,
  type EligibleProject, type ImplantationRequest, type RequestStatus, type Technician,
} from "@/lib/implantationScheduling";
import { EmptyBlock, Kpi, RequestRow } from "@/components/agendamento/AgendaShared";
import {
  ApproveDialog, CancelDialog, RejectDialog, RequestDetailSheet, RequestDialog, TechniciansDialog,
} from "@/components/agendamento/AgendaDialogs";

type Mode = "gp" | "ap";
type GpTab = "todas" | RequestStatus;

export default function SolicitacaoAgenda() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get("visao") === "aprovador" ? "ap" : "gp";
  const setMode = (m: Mode) => setParams(m === "ap" ? { visao: "aprovador" } : {}, { replace: true });

  const [projects, setProjects] = useState<EligibleProject[]>([]);
  const [requests, setRequests] = useState<ImplantationRequest[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [myManagerId, setMyManagerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filtros
  const [onlyMine, setOnlyMine] = useState(true);
  const [projSearch, setProjSearch] = useState("");
  const [gpTab, setGpTab] = useState<GpTab>("todas");
  const [apSearch, setApSearch] = useState("");
  const [apRequester, setApRequester] = useState("");
  const [collapsed, setCollapsed] = useState<Partial<Record<RequestStatus, boolean>>>({ cancelada: true });

  // diálogos
  const [reqProject, setReqProject] = useState<EligibleProject | null>(null);
  const [detail, setDetail] = useState<ImplantationRequest | null>(null);
  const [approving, setApproving] = useState<ImplantationRequest | null>(null);
  const [rejecting, setRejecting] = useState<ImplantationRequest | null>(null);
  const [cancelling, setCancelling] = useState<ImplantationRequest | null>(null);
  const [techOpen, setTechOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    try {
      const [projRes, reqs, techs, mgrRes] = await Promise.all([
        supabase.from("projects")
          .select("id, company_name, project_code, city, state, country_code, status, sub_phase, manager_id, manager:team_members!projects_manager_id_fkey(full_name)")
          .eq("tenant_id", profile.tenant_id)
          .in("status", [...ELIGIBLE_PROJECT_STATUSES])
          .order("company_name"),
        fetchRequests(),
        fetchTechnicians(),
        user?.email
          ? supabase.from("team_members").select("id").ilike("email", user.email).eq("active", true).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (projRes.error) throw projRes.error;
      setProjects((projRes.data as unknown as EligibleProject[]) ?? []);
      setRequests(reqs);
      setTechnicians(techs);
      setMyManagerId((mgrRes.data as { id: string } | null)?.id ?? null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [profile, user?.email]);

  useEffect(() => { load(); }, [load]);

  // Se o usuário não é GP de nenhum projeto, mostra todos (útil para o super admin testar)
  const myProjects = useMemo(() => projects.filter(p => !!myManagerId && p.manager_id === myManagerId), [projects, myManagerId]);
  useEffect(() => { if (!loading && myProjects.length === 0) setOnlyMine(false); }, [loading, myProjects.length]);

  const pendingByProject = useMemo(() => new Set(requests.filter(r => r.status === "pendente").map(r => r.project_id)), [requests]);
  const myRequests = useMemo(() => requests.filter(r => r.requested_by === user?.id), [requests, user?.id]);

  const refreshDetail = useCallback(async () => {
    await load();
  }, [load]);
  useEffect(() => { if (detail) setDetail(requests.find(r => r.id === detail.id) ?? null); }, [requests]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Implantação <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-700 dark:text-amber-300"><Lock className="h-3 w-3" />Em desenvolvimento · só Super Admin</span>
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Solicitação de agenda</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "gp" ? "Solicite visitas técnicas para os seus projetos e acompanhe a avaliação do Aprovador." : "Avalie as solicitações dos Gerentes de Projeto e aloque os técnicos."}
        </p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border/60 bg-muted/50 p-0.5">
          {([["gp", "Gerente de Projeto", UserRound], ["ap", "Aprovador", ShieldCheck]] as const).map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => setMode(k)}
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${mode === k ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />{l}
            </button>
          ))}
        </div>
        {mode === "ap" && <Button variant="outline" size="sm" className="h-9" onClick={() => setTechOpen(true)}><UserRoundCog className="mr-1.5 h-4 w-4" />Técnicos</Button>}
        <Button variant="outline" size="sm" className="h-9" onClick={() => { setLoading(true); load(); }}><RefreshCw className="mr-1.5 h-4 w-4" />Atualizar</Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5">
          <EmptyBlock icon={WifiOff} title="Não foi possível carregar os dados" text={error}
            action={<Button onClick={() => { setLoading(true); load(); }}><RefreshCw className="mr-1.5 h-4 w-4" />Tentar novamente</Button>} />
        </div>
      </div>
    );
  }

  /* ─── Visão do GP ─── */
  const gpView = () => {
    const base = onlyMine ? myProjects : projects;
    const q = projSearch.trim().toLowerCase();
    const list = base.filter(p => !q || `${p.company_name} ${p.project_code ?? ""}`.toLowerCase().includes(q));
    const count = (s: RequestStatus) => myRequests.filter(r => r.status === s).length;
    const tabs: [GpTab, string, number][] = [["todas", "Todas", myRequests.length], ["pendente", "Pendentes", count("pendente")], ["aprovada", "Aprovadas", count("aprovada")], ["reprovada", "Reprovadas", count("reprovada")]];
    const reqList = myRequests.filter(r => gpTab === "todas" || r.status === gpTab);
    return (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={FolderKanban} label="Projetos elegíveis" value={base.length} caption="planejamento / implantação" tone="bg-violet-500/15 text-violet-600 dark:text-violet-300"
            info="Projetos em Planejamento ou Implantação que podem receber visita técnica." />
          <Kpi icon={Hourglass} label="Pendentes" value={count("pendente")} caption="aguardando aprovador" tone="bg-amber-500/15 text-amber-600 dark:text-amber-300"
            info="Suas solicitações que ainda não foram avaliadas. Clique para filtrar." onClick={() => setGpTab("pendente")} />
          <Kpi icon={CheckCircle2} label="Aprovadas" value={count("aprovada")} caption="no calendário" tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
            info="Aprovadas pelo Aprovador: já aparecem no Calendário com os técnicos. Clique para filtrar." onClick={() => setGpTab("aprovada")} />
          <Kpi icon={XCircle} label="Reprovadas" value={count("reprovada")} caption="veja a justificativa" tone="bg-red-500/15 text-red-600 dark:text-red-300"
            info="Reprovadas pelo Aprovador, sempre com justificativa. Clique para filtrar." onClick={() => setGpTab("reprovada")} />
        </div>
        <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
          <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><FolderKanban className="h-4 w-4 text-primary" />{onlyMine ? "Meus projetos elegíveis" : "Projetos elegíveis"}</p>
              {myProjects.length > 0 && (
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Switch checked={onlyMine} onCheckedChange={setOnlyMine} className="scale-75" />Só os meus</label>
              )}
              <div className="relative ml-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={projSearch} onChange={e => setProjSearch(e.target.value)} placeholder="Buscar projeto..." className="h-8 w-48 pl-8 text-xs" />
              </div>
            </div>
            {base.length === 0 ? (
              <EmptyBlock icon={FolderSearch} title="Nenhum projeto elegível" text="Não há projetos em Planejamento ou Implantação no momento." />
            ) : list.length === 0 ? (
              <EmptyBlock icon={SearchX} title="Nada encontrado" text={`Nenhum projeto corresponde a “${projSearch}”.`} action={<Button variant="outline" size="sm" onClick={() => setProjSearch("")}>Limpar busca</Button>} />
            ) : (
              <ul className="max-h-[560px] divide-y overflow-y-auto">
                {list.map(p => {
                  const hot = p.sub_phase === "cronograma_visita";
                  const phase = p.sub_phase ? subPhasesByStatus[p.status as keyof typeof subPhasesByStatus]?.find(s => s.id === p.sub_phase)?.label : null;
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.company_name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {p.project_code && <span className="font-mono">{p.project_code} · </span>}
                          {formatLocation(p.city, p.state, p.country_code)} · <span className={hot ? "font-semibold text-primary" : ""}>{phase ?? statusLabels[p.status as keyof typeof statusLabels]}</span>
                          {!onlyMine && p.manager?.full_name ? ` · GP: ${p.manager.full_name}` : ""}
                        </p>
                        {pendingByProject.has(p.id) && <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-300"><Hourglass className="mr-0.5 inline h-3 w-3" />Já existe solicitação pendente</p>}
                      </div>
                      <Button size="sm" variant={hot ? "default" : "outline"} className="h-8 text-xs" onClick={() => setReqProject(p)}>
                        <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />Solicitar agenda
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><Inbox className="h-4 w-4 text-primary" />Minhas solicitações</p>
              <div className="ml-auto flex rounded-lg bg-muted p-0.5">
                {tabs.map(([k, l, n]) => (
                  <button key={k} type="button" onClick={() => setGpTab(k)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${gpTab === k ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    {l} <span className="opacity-60">{n}</span>
                  </button>
                ))}
              </div>
            </div>
            {reqList.length === 0 ? (
              <EmptyBlock icon={Inbox} title={myRequests.length ? "Nada nesta aba" : "Você ainda não fez solicitações"}
                text={myRequests.length ? "Troque de aba para ver outras solicitações." : "Escolha um projeto e clique em “Solicitar agenda”."} />
            ) : (
              <ul className="divide-y">
                {reqList.map(r => (
                  <RequestRow key={r.id} request={r} onOpen={() => setDetail(r)}
                    actions={r.status === "pendente" ? <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setCancelling(r)}><Ban className="mr-1 h-3.5 w-3.5" />Cancelar</Button> : undefined} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </>
    );
  };

  /* ─── Visão do Aprovador ─── */
  const apView = () => {
    const q = apSearch.trim().toLowerCase();
    const requesters = [...new Set(requests.map(r => r.requester_name).filter(Boolean) as string[])].sort();
    const list = requests.filter(r =>
      (!q || `${r.project?.company_name ?? ""} ${r.project?.project_code ?? ""} ${r.requester_name ?? ""} ${r.visit_purpose}`.toLowerCase().includes(q)) &&
      (!apRequester || r.requester_name === apRequester));
    const n = (s: RequestStatus) => requests.filter(r => r.status === s).length;
    const now = new Date(), dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()), dayEnd = new Date(dayStart.getTime() + 864e5);
    const inField = new Set(requests.filter(r => r.status === "aprovada" && periodOf(r).start < dayEnd && dayStart < periodOf(r).end).flatMap(r => r.members.map(m => m.technician?.id))).size;
    const groups: [RequestStatus, string, string][] = [
      ["pendente", "Pendentes de avaliação", "avalie e aloque os técnicos"],
      ["aprovada", "Aprovadas", "publicadas no calendário"],
      ["reprovada", "Reprovadas", "justificativa enviada ao GP"],
      ["cancelada", "Canceladas pelo solicitante", ""],
    ];
    return (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Inbox} label="Pendentes" value={n("pendente")} caption="para avaliar" tone="bg-amber-500/15 text-amber-600 dark:text-amber-300"
            info="Solicitações aguardando sua aprovação ou reprovação." />
          <Kpi icon={CheckCircle2} label="Aprovadas" value={n("aprovada")} caption="no calendário" tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
            info="Agendamentos aprovados e publicados no Calendário. Clique para abrir o Calendário." onClick={() => navigate("/implantacao/calendario")} />
          <Kpi icon={XCircle} label="Reprovadas" value={n("reprovada")} caption="com justificativa" tone="bg-red-500/15 text-red-600 dark:text-red-300"
            info="Solicitações reprovadas. A justificativa é obrigatória." />
          <Kpi icon={UsersRound} label="Técnicos em campo" value={inField} caption={`hoje · de ${technicians.length}`} tone="bg-sky-500/15 text-sky-600 dark:text-sky-300"
            info="Técnicos com visita aprovada que inclui o dia de hoje. Clique para abrir o Calendário." onClick={() => navigate("/implantacao/calendario")} />
        </div>
        {technicians.length === 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            <UserRoundCog className="h-4 w-4" />Nenhum técnico cadastrado: cadastre os técnicos para poder aprovar solicitações.
            <Button size="sm" className="ml-auto h-8" onClick={() => setTechOpen(true)}>Cadastrar técnicos</Button>
          </div>
        )}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={apSearch} onChange={e => setApSearch(e.target.value)} placeholder="Buscar por cliente, código, solicitante ou objetivo..." className="h-10 pl-9" />
          </div>
          <Select value={apRequester || "all"} onValueChange={v => setApRequester(v === "all" ? "" : v)}>
            <SelectTrigger className="h-10 w-full md:w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os solicitantes</SelectItem>
              {requesters.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          {(q || apRequester) && <Button variant="outline" className="h-10" onClick={() => { setApSearch(""); setApRequester(""); }}><X className="mr-1 h-4 w-4" />Limpar</Button>}
        </div>
        {requests.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card">
            <EmptyBlock icon={Inbox} title="Nenhuma solicitação recebida" text="Quando um Gerente de Projeto solicitar uma visita técnica, ela aparece aqui para avaliação." />
          </div>
        ) : groups.map(([st, title, sub]) => {
          const rs = list.filter(r => r.status === st).sort((a, b) => +periodOf(a).start - +periodOf(b).start);
          if (st === "cancelada" && rs.length === 0) return null;
          const col = collapsed[st];
          return (
            <section key={st} className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
              <button type="button" onClick={() => setCollapsed(c => ({ ...c, [st]: !c[st] }))} className="flex w-full items-center gap-2.5 border-b px-4 py-3 text-left transition-colors hover:bg-muted/40">
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${col ? "-rotate-90" : ""}`} />
                <span className={`h-2.5 w-2.5 rounded-full ${REQUEST_STATUS[st].dot}`} />
                <span className="text-sm font-semibold">{title}</span>
                <span className="rounded-full bg-muted px-2 text-[11px] font-semibold text-muted-foreground">{rs.length}</span>
                {sub && <span className="ml-2 hidden text-[11px] text-muted-foreground sm:inline">{sub}</span>}
              </button>
              {!col && (rs.length ? (
                <ul className="divide-y">
                  {rs.map(r => (
                    <RequestRow key={r.id} request={r} showRequester onOpen={() => setDetail(r)}
                      actions={r.status === "pendente" ? <>
                        <Button size="sm" className="h-8 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-500" onClick={() => setApproving(r)}><Check className="mr-1 h-3.5 w-3.5" />Aprovar</Button>
                        <Button size="sm" variant="outline" className="h-8 border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10" onClick={() => setRejecting(r)}><X className="mr-1 h-3.5 w-3.5" />Reprovar</Button>
                      </> : undefined} />
                  ))}
                </ul>
              ) : <p className="px-4 py-6 text-center text-xs text-muted-foreground">Nenhuma solicitação {q || apRequester ? "com esses filtros" : "neste status"}.</p>)}
            </section>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {header}
      {mode === "gp" ? gpView() : apView()}

      <RequestDialog project={reqProject} open={!!reqProject} onOpenChange={o => { if (!o) setReqProject(null); }}
        onCreated={() => { setGpTab("pendente"); load(); }} />
      <ApproveDialog request={approving} technicians={technicians} allRequests={requests} open={!!approving}
        onOpenChange={o => { if (!o) setApproving(null); }} onDone={refreshDetail} onManageTechnicians={() => setTechOpen(true)} />
      <RejectDialog request={rejecting} open={!!rejecting} onOpenChange={o => { if (!o) setRejecting(null); }} onDone={refreshDetail} />
      <CancelDialog request={cancelling} open={!!cancelling} onOpenChange={o => { if (!o) setCancelling(null); }} onDone={refreshDetail} />
      <TechniciansDialog open={techOpen} onOpenChange={setTechOpen} onChanged={() => fetchTechnicians().then(setTechnicians).catch(() => undefined)} />
      <RequestDetailSheet request={detail} open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }} mode={mode}
        onApprove={() => { setApproving(detail); setDetail(null); }}
        onReject={() => { setRejecting(detail); setDetail(null); }}
        onCancel={() => { setCancelling(detail); setDetail(null); }}
        onNewRequest={() => { const p = projects.find(x => x.id === detail?.project_id); setDetail(null); if (p) setReqProject(p); }}
        onGoCalendar={() => navigate("/implantacao/calendario")} />
    </div>
  );
}
