import { Fragment, useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProjectFilters } from "@/contexts/ProjectFiltersContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Filter, X, Signal, Building2, MapPin, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { Constants } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import KanbanFilters from "@/components/kanban/KanbanFilters";
import KanbanColumn from "@/components/kanban/KanbanColumn";
import KanbanLegend from "@/components/kanban/KanbanLegend";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { statusLabels } from "@/lib/statusLabels";
import PendencyColumn from "@/components/kanban/PendencyColumn";
import PendencyDialog, { type PendencyDialogMode } from "@/components/kanban/PendencyDialog";
import type { PendencyAction } from "@/components/kanban/PendencyCard";
import { RequestDialog } from "@/components/agendamento/AgendaDialogs";
import { countByProject, fetchOpenPendencies, pendenciesOfProjects, type ProjectPendency } from "@/lib/projectPendencies";
import { fetchProjectRequests, type EligibleProject, type ImplantationRequest } from "@/lib/implantationScheduling";

export { statusLabels };

type ProjectStatus = Database["public"]["Enums"]["project_status"];

export const statusColors: Record<ProjectStatus, { bg: string; border: string; text: string; accent: string }> = {
  comercial: { bg: "bg-blue-500/5", border: "border-blue-500/20", text: "text-blue-600", accent: "bg-blue-500" },
  planejamento: { bg: "bg-primary/5", border: "border-primary/20", text: "text-primary", accent: "bg-primary" },
  implantacao: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-600", accent: "bg-amber-500" },
  encerrado: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-600", accent: "bg-emerald-500" },
  suspenso: { bg: "bg-red-500/5", border: "border-red-500/20", text: "text-red-600", accent: "bg-red-500" },
};

export const statusDescriptions: Partial<Record<ProjectStatus, string>> = {
  comercial: "Projeto cadastrado, em análise dos pré-requisitos para se tornar um Projeto.",
};

export interface SubPhaseConfig {
  id: string;
  label: string;
  description?: string;
}

export const subPhasesByStatus: Partial<Record<ProjectStatus, SubPhaseConfig[]>> = {
  comercial: [
    { id: "aguardando_contrato", label: "Aguardando contrato", description: "Aguardando assinatura do contrato pelo cliente." },
    { id: "contrato_assinado", label: "Contrato Transdata assinado", description: "Contrato firmado entre as partes para início do projeto." },
    { id: "cobranca_dzero", label: "Cobrança D-zero emitida", description: "Emissão da cobrança referente ao D-zero do projeto." },
    { id: "pagamento_dzero", label: "Pagamento D-zero efetuado", description: "Confirmação do pagamento do D-zero pelo cliente." },
    { id: "sem_pendencias", label: "Cliente sem pendências financeiras", description: "Verificação de que o cliente não possui pendências financeiras." },
  ],
  planejamento: [
    { id: "reuniao_handover", label: "Reunião de Handover", description: "Marca o início do projeto e a transição das responsabilidades do time comercial para o time de projetos." },
    { id: "reuniao_kickoff", label: "Reunião de Kick-off", description: "Primeiro contato da equipe de projetos com o cliente, incluindo a apresentação do Gerente de Projetos responsável." },
    { id: "reuniao_proj_executivo", label: "Reunião Projeto Executivo", description: "Etapa em que são apresentadas as fases do projeto e coletadas as informações necessárias para a elaboração do Projeto Executivo." },
    { id: "levantamento_materiais", label: "Levantamento de Materiais", description: "Fase de coleta dos dados do veículo para definição dos materiais necessários." },
    { id: "aquisicao_materiais", label: "Aquisição de Materiais", description: "Envio da lista de materiais ao cliente para que a compra seja realizada junto aos fornecedores homologados." },
    { id: "cronograma_visita", label: "Cronograma de Visita Técnica", description: "Organização das visitas entre o cliente, o Gerente de Projetos e a equipe responsável pela implantação." },
  ],
  suspenso: [
    { id: "suspenso", label: "Suspenso", description: "Projeto temporariamente suspenso." },
    { id: "cancelado", label: "Cancelado", description: "Projeto cancelado." },
    { id: "piloto_reprovado", label: "Piloto reprovado", description: "Projeto de piloto reprovado pelo cliente." },
  ],
};

export interface ProjectRow {
  id: string;
  company_name: string;
  project_code: string | null;
  city: string;
  state: string | null;
  country_code: string | null;
  contract_date: string;
  d_zero_date: string | null;
  handover_date: string | null;
  status: ProjectStatus;
  sub_phase: string | null;
  is_pilot: boolean;
  complementary_sale: boolean;
  complementary_fleet: number;
  implemented_fleet: number;
  observations: string | null;
  reached_implemented: boolean;
  reached_implemented_at: string | null;
  updated_at: string;
  /** Data do último registro salvo em "Acompanhamento do Projeto" (tabela project_notes) */
  last_note_at?: string | null;
  executive: { full_name: string } | null;
  manager: { full_name: string } | null;
  manager_id: string | null;
  project_solutions: { solution: { id: string; name: string } | null }[];
  project_integrations: { integration: { name: string } | null }[];
}

export default function ProjectManagement() {
  const navigate = useNavigate();
  const { filters, setFilter, clearFilters } = useProjectFilters();
  const { user, isAdmin } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [currentManagerId, setCurrentManagerId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("team_members").select("id, full_name").eq("role", "gerente_projetos").eq("active", true)
      .then(({ data }) => setManagers(data || []));
  }, []);

  useEffect(() => {
    if (!user?.email) { setCurrentManagerId(null); return; }
    supabase.rpc("get_my_manager_id")
      .then(({ data }) => setCurrentManagerId((data as string | null) || null));
  }, [user?.email]);

  // cards filhos (Implantação pendente); falha na leitura não derruba o quadro
  const [pendencies, setPendencies] = useState<ProjectPendency[]>([]);
  const loadPendencies = useCallback(() => fetchOpenPendencies().then(setPendencies).catch(() => setPendencies([])), []);
  const [pendDialog, setPendDialog] = useState<PendencyDialogMode | null>(null);
  const [agendaFor, setAgendaFor] = useState<{ project: EligibleProject; existing: ImplantationRequest[] } | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    void loadPendencies();
    const { data } = await supabase
      .from("projects")
      .select("id, company_name, project_code, city, state, country_code, contract_date, d_zero_date, handover_date, status, sub_phase, is_pilot, complementary_sale, complementary_fleet, implemented_fleet, observations, reached_implemented, reached_implemented_at, updated_at, manager_id, executive:team_members!projects_executive_id_fkey(full_name), manager:team_members!projects_manager_id_fkey(full_name), project_solutions(solution:solutions(id, name)), project_integrations(integration:integrations(name))")
      .order("company_name");

    // Considerar também os acompanhamentos já registrados em project_notes
    const { data: notes } = await supabase
      .from("project_notes")
      .select("project_id, created_at")
      .order("created_at", { ascending: false });
    const lastNoteMap = new Map<string, string>();
    (notes || []).forEach(n => {
      if (!lastNoteMap.has(n.project_id)) lastNoteMap.set(n.project_id, n.created_at);
    });

    const rows = ((data as unknown as ProjectRow[]) || []).map(p => ({
      ...p,
      last_note_at: lastNoteMap.get(p.id) ?? null,
    }));
    setProjects(rows);
    setLoading(false);
  }, [loadPendencies]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const canEditProject = useCallback(
    (p: { manager_id: string | null }) => isAdmin || (!!currentManagerId && p.manager_id === currentManagerId),
    [isAdmin, currentManagerId]
  );

  const countryOptions = useMemo(
    () => Array.from(new Set(projects.map(p => p.country_code || "BR").filter(c => c !== "BR"))).sort(),
    [projects]
  );

  const cities = useMemo(() => {
    const set = new Set(projects.map(p => p.city));
    return Array.from(set).sort();
  }, [projects]);

  // filtros do quadro sem o de status: o card filho segue o projeto pai (que costuma estar em Implementado)
  const filteredAnyStatus = useMemo(() => {
    let list = projects;
    if (filters.managerId) {
      const mgr = managers.find(m => m.id === filters.managerId);
      if (mgr) list = list.filter(p => p.manager?.full_name === mgr.full_name);
    }
    if (filters.companyName) {
      const q = filters.companyName.toLowerCase();
      list = list.filter(p => p.company_name.toLowerCase().includes(q));
    }
    if (filters.state) list = filters.state.startsWith("c:")
      ? list.filter(p => (p.country_code || "BR") === filters.state.slice(2))
      : list.filter(p => p.state === filters.state && (p.country_code || "BR") === "BR");
    if (filters.city) list = list.filter(p => p.city === filters.city);
    return list;
  }, [projects, filters, managers]);
  const filtered = useMemo(
    () => (filters.status ? filteredAnyStatus.filter(p => p.status === filters.status) : filteredAnyStatus),
    [filteredAnyStatus, filters.status],
  );
  const projectById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const visiblePendencies = useMemo(
    () => pendenciesOfProjects(pendencies, new Set(filteredAnyStatus.map(p => p.id))),
    [pendencies, filteredAnyStatus],
  );
  const pendencyCount = useMemo(() => countByProject(pendencies), [pendencies]);

  const openCreateChild = useCallback((p: ProjectRow) => setPendDialog({
    kind: "criar",
    project: {
      id: p.id, company_name: p.company_name, status: p.status,
      solutions: p.project_solutions.flatMap(ps => (ps.solution ? [ps.solution] : [])),
    },
    openTitles: pendencies.filter(x => x.project_id === p.id).map(x => x.title),
  }), [pendencies]);

  const onPendencyAction = useCallback(async (kind: PendencyAction, x: ProjectPendency) => {
    const p = projectById.get(x.project_id);
    if (!p) return;
    if (kind === "agenda") {
      // solicitação de agenda no projeto pai (visita extra é aceita em projeto implementado)
      const existing = await fetchProjectRequests(p.id).catch(() => [] as ImplantationRequest[]);
      setAgendaFor({
        project: { id: p.id, company_name: p.company_name, project_code: p.project_code, city: p.city, state: p.state, country_code: p.country_code,
          status: p.status, sub_phase: p.sub_phase, manager_id: p.manager_id, manager: p.manager },
        existing,
      });
    } else {
      setPendDialog({ kind, pendency: x, projectName: p.company_name });
    }
  }, [projectById]);

  const columns = Constants.public.Enums.project_status;

  const grouped = useMemo(() => {
    const map: Record<ProjectStatus, ProjectRow[]> = {
      comercial: [], planejamento: [], implantacao: [], encerrado: [], suspenso: [],
    };
    filtered.forEach(p => map[p.status]?.push(p));
    return map;
  }, [filtered]);

  const activeFilterCount = Object.values(filters).filter(v => v !== "").length;
  const hasActiveFilters = activeFilterCount > 0;

  /** Move o projeto de coluna (arrastar e soltar ou "Mover para Implementado" do card filho). */
  const moveProject = useCallback(async (draggableId: string, newStatus: ProjectStatus, newSubPhase: string | null): Promise<boolean> => {
    const project = projects.find(p => p.id === draggableId);
    if (!project) return false;
    if (!canEditProject(project)) {
      toast.error("Você só pode mover projetos vinculados a você.");
      return false;
    }
    if (project.status === newStatus && project.sub_phase === newSubPhase) return true;

    // Optimistic update
    const willMarkReached = newStatus === "encerrado" && !project.reached_implemented;
    const nowIso = new Date().toISOString();
    setProjects(prev => prev.map(p => p.id === draggableId ? {
      ...p,
      status: newStatus,
      sub_phase: newSubPhase,
      ...(willMarkReached ? { reached_implemented: true, reached_implemented_at: nowIso } : {}),
    } : p));

    const updateData: Record<string, unknown> = { status: newStatus, sub_phase: newSubPhase };
    if (willMarkReached) {
      updateData.reached_implemented = true;
      updateData.reached_implemented_at = nowIso;
    }
    const { error } = await supabase.from("projects").update(updateData).eq("id", draggableId);
    if (error) {
      toast.error("Erro ao atualizar status do projeto");
      setProjects(prev => prev.map(p => p.id === draggableId ? { ...p, status: project.status, sub_phase: project.sub_phase, reached_implemented: project.reached_implemented, reached_implemented_at: project.reached_implemented_at } : p));
      return false;
    }
    const label = newSubPhase
      ? subPhasesByStatus[newStatus]?.find(sp => sp.id === newSubPhase)?.label || statusLabels[newStatus]
      : statusLabels[newStatus];
    toast.success(`Projeto movido para ${label}`);
    // Mudança de status registrada automaticamente por trigger no banco
    return true;
  }, [projects, canEditProject]);

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    // Parse composite droppable ID: "status::sub_phase" or just "status"
    const parts = destination.droppableId.split("::");
    await moveProject(draggableId, parts[0] as ProjectStatus, parts[1] || null);
  }, [moveProject]);


  const onUpdateObservations = useCallback(async (projectId: string, newText: string) => {
    const project = projects.find(p => p.id === projectId);
    const timestamp = format(new Date(), "dd/MM/yyyy HH:mm");
    // Buscar nome do autor
    let authorName = user?.email || "Usuário";
    if (user?.id) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      if (prof?.full_name) authorName = prof.full_name;
    }
    const entry = `[${timestamp} • ${authorName}] ${newText}`;
    const updated = project?.observations ? `${entry}\n${project.observations}` : entry;

    const { error } = await supabase.from("projects").update({ observations: updated }).eq("id", projectId);
    if (error) {
      toast.error("Erro ao salvar acompanhamento");
    } else {
      toast.success("Acompanhamento registrado");
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, observations: updated } : p));
    }
  }, [projects, user]);

  const countLabel = `${filtered.length} projeto${filtered.length !== 1 ? "s" : ""}`;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projetos")} aria-label="Voltar para Projetos" title="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Signal className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Gestão de Projetos</span>
          </div>
          <h1 className="text-2xl font-bold">Kanban</h1>
        </div>
        <div className="ml-auto hidden flex-wrap items-center justify-end gap-3 lg:flex">
          <KanbanLegend />
          <span className="text-sm text-muted-foreground">{countLabel}</span>
        </div>
      </div>

      {/* Celular/tablet: filtros e legenda viram botões para o quadro usar a largura toda */}
      <div className="mb-3 flex items-center gap-2 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="mr-1.5 h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{activeFilterCount}</span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-3 pb-5 pt-8">
            <SheetTitle className="sr-only">Filtros</SheetTitle>
            <KanbanFilters
              filters={filters}
              setFilter={setFilter}
              clearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              managers={managers}
              countries={countryOptions}
              cities={cities}
              columns={columns}
              className="w-full border-0 shadow-none"
            />
            <SheetClose asChild>
              <Button className="mt-2 w-full">Ver {countLabel}</Button>
            </SheetClose>
          </SheetContent>
        </Sheet>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <span className="mr-1.5 flex gap-0.5" aria-hidden>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <span className="h-2 w-2 rounded-full bg-red-500" />
              </span>
              Legenda
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto max-w-[min(340px,calc(100vw-24px))] p-1">
            <KanbanLegend className="border-0 bg-transparent" />
          </PopoverContent>
        </Popover>
        <span className="ml-auto text-sm text-muted-foreground">{countLabel}</span>
      </div>

      {/* Body: Filters + Board */}
      <div className="flex flex-1 gap-4 min-h-0">
        <KanbanFilters
          filters={filters}
          setFilter={setFilter}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          managers={managers}
          countries={countryOptions}
          cities={cities}
          columns={columns}
          className="hidden lg:flex"
        />

        {/* Kanban Board */}
        <div className="flex-1 flex gap-3 min-h-0 overflow-x-auto">
          <DragDropContext onDragEnd={onDragEnd}>
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              columns.map(status => (
                <Fragment key={status}>
                  <KanbanColumn
                    status={status}
                    items={grouped[status]}
                    subPhases={subPhasesByStatus[status] || null}
                    onUpdateObservations={onUpdateObservations}
                    canEditProject={canEditProject}
                    pendencyCount={pendencyCount}
                    onCreateChild={openCreateChild}
                    onMoveToImplemented={p => void moveProject(p.id, "encerrado", null)}
                  />
                  {/* cards filhos logo depois de Implementado */}
                  {status === "encerrado" && (
                    <PendencyColumn items={visiblePendencies} projects={projectById} canEditProject={canEditProject} onAction={onPendencyAction} />
                  )}
                </Fragment>
              ))
            )}
          </DragDropContext>
        </div>
        <PendencyDialog mode={pendDialog} onOpenChange={o => { if (!o) setPendDialog(null); }} onDone={() => void loadPendencies()}
          onMoveParent={id => moveProject(id, "encerrado", null)} />
        <RequestDialog project={agendaFor?.project ?? null} open={!!agendaFor} existing={agendaFor?.existing ?? []}
          onOpenChange={o => { if (!o) setAgendaFor(null); }} onCreated={() => toast.info("A solicitação está na Aprovação de agenda.")} />
      </div>
    </div>
  );
}
