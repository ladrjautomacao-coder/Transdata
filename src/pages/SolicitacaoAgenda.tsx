import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  Ban, CalendarPlus, CalendarRange, Check, CheckCircle2, ChevronDown, FolderKanban, FolderSearch, Hourglass, Inbox,
  RefreshCw, Search, SearchX, ShieldCheck, UserRound, UserRoundCog, UsersRound, WifiOff, X, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatLocation } from "@/lib/location";
import { statusLabels, subPhasesByStatus } from "@/pages/ProjectManagement";
import {
  HIDDEN_BY_DEFAULT_STATUSES, REQUEST_STATUS, calendarLinkFor, errorMessage, fetchRequests, fetchTechnicians, formatPeriod, pendingAge, periodOf,
  type EligibleProject, type ImplantationRequest, type RequestStatus, type Technician,
} from "@/lib/implantationScheduling";
import { EmptyBlock, Kpi, RequestRow } from "@/components/agendamento/AgendaShared";
import { AvailabilityPreview } from "@/components/agendamento/AvailabilityPreview";
import {
  CancelDialog, RejectDialog, RequestDetailSheet, RequestDialog, TechniciansDialog,
} from "@/components/agendamento/AgendaDialogs";
import { AssignSheet } from "@/components/agendamento/AssignSheet";

type Mode = "gp" | "ap";
type GpTab = "todas" | RequestStatus;

/**
 * Duas telas sobre os mesmos dados: "Solicitação de agenda" (GP, view="gp") e
 * "Aprovação de agenda" (Aprovador, view="ap", rota /implantacao/aprovacao).
 */
export default function SolicitacaoAgenda({ view = "gp" }: { view?: Mode }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [params] = useSearchParams();
  // Painel de Permissões: Criar = solicitar visita; Aprovar = tela de Aprovação; Técnicos = cadastro
  const { can } = usePermissions();
  const canRequest = can("agenda_solicitacao", "create");
  const canManageTechs = can("agenda_tecnicos", "edit");
  const mode: Mode = view;

  const [projects, setProjects] = useState<EligibleProject[]>([]);
  const [requests, setRequests] = useState<ImplantationRequest[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [myManagerId, setMyManagerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filtros
  const [projSearch, setProjSearch] = useState("");
  const [gpTab, setGpTab] = useState<GpTab>("todas");
  const [apSearch, setApSearch] = useState("");
  const [apRequester, setApRequester] = useState("");
  const [collapsed, setCollapsed] = useState<Partial<Record<RequestStatus, boolean>>>({ cancelada: true });
  const [hiddenAvail, setHiddenAvail] = useState<Record<string, boolean>>({});

  // diálogos
  const [reqProject, setReqProject] = useState<EligibleProject | null>(null);
  const [detail, setDetail] = useState<ImplantationRequest | null>(null);
  const [approving, setApproving] = useState<ImplantationRequest | null>(null);
  const [approveInitial, setApproveInitial] = useState<string[]>([]);
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
          .order("company_name"),
        fetchRequests(),
        fetchTechnicians(),
        // e-mail de team_members não é legível pelo cliente; a função resolve o GP no banco
        supabase.rpc("get_my_manager_id"),
      ]);
      if (projRes.error) throw projRes.error;
      setProjects((projRes.data as unknown as EligibleProject[]) ?? []);
      setRequests(reqs);
      setTechnicians(techs);
      setMyManagerId((mgrRes.data as string | null) ?? null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const myRequests = useMemo(() => requests.filter(r => r.requested_by === user?.id), [requests, user?.id]);

  // Lista padrão ("Meus projetos"):
  //  - projetos que o GP logado gerencia (exceto implementados) — GP = team_member com o mesmo e-mail;
  //  - + projetos em que o usuário já solicitou agenda (para marcar as próximas visitas: 2ª, 3ª…),
  //    mesmo sem ser o GP ou já implementados.
  // Agendar NÃO tira o projeto da lista. A busca (abaixo) usa a base inteira.
  const myProjects = useMemo(() => {
    const requested = new Set(myRequests.filter(r => r.status !== "cancelada").map(r => r.project_id));
    return projects.filter(p =>
      requested.has(p.id) ||
      (!!myManagerId && p.manager_id === myManagerId && !HIDDEN_BY_DEFAULT_STATUSES.includes(p.status)));
  }, [projects, myManagerId, myRequests]);

  // Visitas (pendentes e aprovadas) de cada projeto, para mostrar "N visitas · próxima: …"
  const visitsByProject = useMemo(() => {
    const m = new Map<string, ImplantationRequest[]>();
    requests.filter(r => r.status === "pendente" || r.status === "aprovada").forEach(r => {
      const list = m.get(r.project_id) ?? [];
      list.push(r);
      m.set(r.project_id, list);
    });
    m.forEach(list => list.sort((a, b) => +periodOf(a).start - +periodOf(b).start));
    return m;
  }, [requests]);

  const refreshDetail = useCallback(async () => {
    await load();
  }, [load]);
  useEffect(() => { if (detail) setDetail(requests.find(r => r.id === detail.id) ?? null); }, [requests]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Implantação
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{mode === "gp" ? "Solicitação de agenda" : "Aprovação de agenda"}</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "gp" ? "Solicite visitas técnicas para os seus projetos e acompanhe a avaliação do Aprovador." : "Avalie as solicitações dos Gerentes de Projeto e aloque os técnicos."}
        </p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {mode === "ap" && canManageTechs && <Button variant="outline" size="sm" className="h-9" onClick={() => setTechOpen(true)}><UserRoundCog className="mr-1.5 h-4 w-4" />Técnicos</Button>}
        <Button variant="outline" size="sm" className="h-9" onClick={() => { setLoading(true); load(); }}><RefreshCw className="mr-1.5 h-4 w-4" />Atualizar</Button>
      </div>
    </div>
  );

  // Links antigos (?visao=aprovador) agora têm tela própria
  if (mode === "gp" && params.get("visao") === "aprovador") return <Navigate to="/implantacao/aprovacao" replace />;

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
    const q = projSearch.trim().toLowerCase();
    // Sem busca: só os meus. Com busca: TODA a base (qualquer status e qualquer GP),
    // para agendar em projeto de outro GP ou visita extra em projeto implementado.
    const list = q
      ? projects.filter(p => `${p.company_name} ${p.project_code ?? ""} ${p.city} ${p.manager?.full_name ?? ""}`.toLowerCase().includes(q))
      : myProjects;
    const count = (s: RequestStatus) => myRequests.filter(r => r.status === s).length;
    const tabs: [GpTab, string, number][] = [["todas", "Todas", myRequests.length], ["pendente", "Pendentes", count("pendente")], ["aprovada", "Aprovadas", count("aprovada")], ["reprovada", "Reprovadas", count("reprovada")]];
    const reqList = myRequests.filter(r => gpTab === "todas" || r.status === gpTab);
    return (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={FolderKanban} label="Meus projetos" value={myProjects.length} caption="que gerencio ou já agendei" tone="bg-violet-500/15 text-violet-600 dark:text-violet-300"
            info="Projetos em que você é o Gerente de Projetos (exceto implementados) e projetos em que você já solicitou agenda — eles continuam aqui para você marcar as próximas visitas. Para outro projeto, use a busca: ela procura em toda a base." />
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
              <p className="flex items-center gap-2 text-sm font-semibold"><FolderKanban className="h-4 w-4 text-primary" />{q ? "Resultado da busca" : "Meus projetos"}</p>
              <div className="relative ml-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={projSearch} onChange={e => setProjSearch(e.target.value)} placeholder="Buscar em toda a base..." className="h-8 w-52 pl-8 text-xs" />
              </div>
            </div>
            <p className="border-b bg-muted/30 px-4 py-1.5 text-[11px] text-muted-foreground">
              {q
                ? <>Buscando em <b className="text-foreground">toda a base</b> (todos os GPs e status, inclusive implementados) · {list.length} resultado{list.length !== 1 ? "s" : ""}</>
                : <>Projetos que você gerencia ou em que já agendou visitas. Para outro projeto ou <b className="text-foreground">visita extra</b>, use a busca.</>}
            </p>
            {!q && myProjects.length === 0 ? (
              <EmptyBlock icon={FolderSearch}
                title={myManagerId ? "Você não tem projetos em andamento" : "Seu usuário não está vinculado a um Gerente de Projetos"}
                text={myManagerId
                  ? "Use a busca para encontrar qualquer projeto da base e solicitar uma visita."
                  : "Para ver seus projetos aqui, cadastre seu e-mail em Administração › Equipe como Gerente de Projetos. Enquanto isso, use a busca para encontrar qualquer projeto."} />
            ) : list.length === 0 ? (
              <EmptyBlock icon={SearchX} title="Nada encontrado" text={`Nenhum projeto da base corresponde a “${projSearch}”.`} action={<Button variant="outline" size="sm" onClick={() => setProjSearch("")}>Limpar busca</Button>} />
            ) : (
              <ul className="max-h-[560px] divide-y overflow-y-auto">
                {list.map(p => {
                  const hot = p.sub_phase === "cronograma_visita";
                  const extra = HIDDEN_BY_DEFAULT_STATUSES.includes(p.status);
                  const phase = p.sub_phase ? subPhasesByStatus[p.status as keyof typeof subPhasesByStatus]?.find(s => s.id === p.sub_phase)?.label : null;
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-semibold">
                          {p.company_name}
                          {extra && <span className="shrink-0 rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300">{statusLabels.encerrado} · visita extra</span>}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {p.project_code && <span className="font-mono">{p.project_code} · </span>}
                          {formatLocation(p.city, p.state, p.country_code)} · <span className={hot ? "font-semibold text-primary" : ""}>{phase ?? statusLabels[p.status as keyof typeof statusLabels]}</span>
                          {q && p.manager?.full_name ? ` · GP: ${p.manager.full_name}` : ""}
                        </p>
                        {(() => {
                          const visits = visitsByProject.get(p.id) ?? [];
                          if (!visits.length) return null;
                          const now = new Date();
                          const next = visits.find(r => periodOf(r).end >= now);
                          const nPend = visits.filter(r => r.status === "pendente").length;
                          return (
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                                <CalendarRange className="h-3 w-3" />{visits.length} visita{visits.length !== 1 ? "s" : ""} na agenda
                              </span>
                              {next && (
                                <span className="text-muted-foreground">
                                  próxima: <b className="font-medium text-foreground/80">{next.visit_purpose}</b> em {formatPeriod(periodOf(next).start, periodOf(next).end).split(" ")[0]}
                                  {next.status === "pendente" ? " (pendente)" : ""}
                                </span>
                              )}
                              {nPend > 0 && <span className="text-amber-600 dark:text-amber-300"><Hourglass className="mr-0.5 inline h-3 w-3" />{nPend} aguardando aprovação</span>}
                            </p>
                          );
                        })()}
                      </div>
                      {canRequest && <Button size="sm" variant={hot ? "default" : "outline"} className="h-8 text-xs" onClick={() => setReqProject(p)}
                        title={(visitsByProject.get(p.id)?.length ?? 0) > 0 ? "Agendar mais uma visita para este projeto" : undefined}>
                        <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />{(visitsByProject.get(p.id)?.length ?? 0) > 0 ? "Nova visita" : "Solicitar agenda"}
                      </Button>}
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
    const oldestPending = requests.filter(r => r.status === "pendente").sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))[0];
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
          <Kpi icon={Inbox} label="Pendentes" value={n("pendente")} caption={oldestPending ? `a mais antiga há ${pendingAge(oldestPending.created_at).text}` : "para avaliar"} tone="bg-amber-500/15 text-amber-600 dark:text-amber-300"
            info="Solicitações aguardando sua aprovação ou reprovação. A legenda mostra há quanto tempo espera a mais antiga; em cada solicitação, o tempo fica âmbar a partir de 3 dias e vermelho a partir de 7." />
          <Kpi icon={CheckCircle2} label="Aprovadas" value={n("aprovada")} caption="no calendário" tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
            info="Agendamentos aprovados e publicados no Calendário. Clique para abrir o Calendário." onClick={() => navigate("/implantacao/calendario")} />
          <Kpi icon={XCircle} label="Reprovadas" value={n("reprovada")} caption="com justificativa" tone="bg-red-500/15 text-red-600 dark:text-red-300"
            info="Solicitações reprovadas. A justificativa é obrigatória." />
          <Kpi icon={UsersRound} label="Técnicos em campo" value={inField} caption={`hoje · de ${technicians.length}`} tone="bg-sky-500/15 text-sky-600 dark:text-sky-300"
            info="Técnicos com visita aprovada que inclui o dia de hoje. Clique para abrir o Calendário." onClick={() => navigate("/implantacao/calendario")} />
        </div>
        {technicians.length === 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            <UserRoundCog className="h-4 w-4" />Nenhum técnico cadastrado: {canManageTechs ? "cadastre os técnicos para poder aprovar solicitações." : "peça a quem gerencia os técnicos da agenda para cadastrá-los."}
            {canManageTechs && <Button size="sm" className="ml-auto h-8" onClick={() => setTechOpen(true)}>Cadastrar técnicos</Button>}
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
                  {rs.map(r => {
                    const showAvail = r.status === "pendente" && !hiddenAvail[r.id];
                    return (
                      <Fragment key={r.id}>
                        <RequestRow request={r} showRequester onOpen={() => setDetail(r)}
                          actions={r.status === "pendente" ? <>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground" title={showAvail ? "Ocultar disponibilidade" : "Ver disponibilidade da semana"}
                              onClick={() => setHiddenAvail(h => ({ ...h, [r.id]: !h[r.id] }))}>
                              <CalendarRange className="mr-1 h-3.5 w-3.5" />{showAvail ? "Ocultar" : "Disponibilidade"}
                            </Button>
                            <Button size="sm" className="h-8 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-500" onClick={() => setApproving(r)}><Check className="mr-1 h-3.5 w-3.5" />Aprovar</Button>
                            <Button size="sm" variant="outline" className="h-8 border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10" onClick={() => setRejecting(r)}><X className="mr-1 h-3.5 w-3.5" />Reprovar</Button>
                          </> : undefined} />
                        {showAvail && (
                          <li className={`border-l-[3px] bg-muted/20 px-4 pb-3 pt-1 ${REQUEST_STATUS.pendente.border}`}>
                            <AvailabilityPreview start={new Date(r.requested_start)} end={new Date(r.requested_end)} format={r.visit_format}
                              technicians={technicians} requests={requests} ignoreId={r.id} compact onManageTechnicians={canManageTechs ? () => setTechOpen(true) : undefined}
                              onPickTechnician={techId => { setApproveInitial([techId]); setApproving(r); }} />
                          </li>
                        )}
                      </Fragment>
                    );
                  })}
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
        existing={requests} onCreated={() => { setGpTab("pendente"); load(); }} />
      <AssignSheet request={approving} technicians={technicians} allRequests={requests} open={!!approving}
        initialSelected={approveInitial.length ? approveInitial : undefined}
        onOpenChange={o => { if (!o) { setApproving(null); setApproveInitial([]); } }} onDone={refreshDetail}
        onReject={r => { setApproving(null); setApproveInitial([]); setRejecting(r); }}
        onManageTechnicians={canManageTechs ? () => setTechOpen(true) : undefined}
        onTechnicianAdded={t => setTechnicians(list => [...list, t].sort((a, b) => a.full_name.localeCompare(b.full_name)))} />
      <RejectDialog request={rejecting} open={!!rejecting} onOpenChange={o => { if (!o) setRejecting(null); }} onDone={refreshDetail} />
      <CancelDialog request={cancelling} open={!!cancelling} onOpenChange={o => { if (!o) setCancelling(null); }} onDone={refreshDetail} />
      <TechniciansDialog open={techOpen} onOpenChange={setTechOpen} onChanged={() => fetchTechnicians().then(setTechnicians).catch(() => undefined)} />
      <RequestDetailSheet request={detail} open={!!detail} onOpenChange={o => { if (!o) setDetail(null); }} mode={mode}
        onApprove={() => { setApproving(detail); setDetail(null); }}
        onReject={() => { setRejecting(detail); setDetail(null); }}
        onCancel={() => { setCancelling(detail); setDetail(null); }}
        onNewRequest={canRequest ? () => { const p = projects.find(x => x.id === detail?.project_id); setDetail(null); if (p) setReqProject(p); } : undefined}
        onGoCalendar={() => { if (detail) navigate(calendarLinkFor(detail)); }}
        onResultChanged={mode === "ap" ? refreshDetail : undefined} />
    </div>
  );
}
