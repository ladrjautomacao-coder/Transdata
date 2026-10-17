import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProjectFilters } from "@/contexts/ProjectFiltersContext";
import { useSettings } from "@/contexts/SettingsContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { EmptyState } from "@/components/EmptyState";
import KanbanFilters from "@/components/kanban/KanbanFilters";
import { ProjectFollowUpCard } from "@/components/comercial/ProjectFollowUpCard";
import { ProjectFollowUpDrawer } from "@/components/comercial/ProjectFollowUpDrawer";
import { ProjectFollowUpSkeleton } from "@/components/comercial/ProjectFollowUpSkeleton";
import {
  effectiveLatestFollowUp,
  followUpLevelStyles,
  followUpSla,
  isLateSla,
  lastFollowUpAt,
  type SlaThresholds,
} from "@/lib/followUpNotes";
import { differenceInDays } from "date-fns";
import { Constants } from "@/integrations/supabase/types";
import { statusLabels } from "@/pages/ProjectManagement";
import { teamRoleLabels } from "@/lib/teamRoleLabels";
import {
  Search, RefreshCw, AlertTriangle, Download, CalendarClock, LayoutGrid, List,
  FileText, Building2, CalendarDays, Wrench, CheckCircle2, MoreHorizontal, Info,
  type LucideIcon,
} from "lucide-react";
import type { DbFollowUpNote, FollowUpProject, ProjectStatus } from "@/components/comercial/types";

// Alto o bastante pra trazer todos os projetos ativos de uma vez: com 24 por
// página e ordenação "mais parado primeiro", projeto recém-cadastrado caía
// nas últimas páginas e parecia não existir.
const PAGE_SIZE = 200;

const SELECT_COLS =
  "id, company_name, project_code, city, state, country_code, status, sub_phase, contract_date, d_zero_date, handover_date, fleet_size, implemented_fleet, observations, is_pilot, created_at, updated_at, manager_id, executive:team_members!projects_executive_id_fkey(full_name), manager:team_members!projects_manager_id_fkey(full_name), project_solutions(solution:solutions(name)), project_integrations(integration:integrations(name))";

type SortKey = "stale" | "recent" | "company" | "status";
type ViewMode = "grid" | "list";

const kpiStyle: Record<ProjectStatus | "total", { icon: LucideIcon; tile: string; card: string; caption: string; info: string }> = {
  total: {
    icon: FileText, tile: "bg-blue-500/15 text-blue-600 dark:text-blue-400", card: "bg-blue-500/[0.03]", caption: "projetos",
    info: "Todos os projetos cadastrados, em qualquer etapa. Clique para listar inclusive os implementados.",
  },
  comercial: {
    icon: Building2, tile: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", card: "bg-emerald-500/[0.03]", caption: "em negociação",
    info: "Projeto cadastrado, em análise dos pré-requisitos para se tornar um Projeto.",
  },
  planejamento: {
    icon: CalendarDays, tile: "bg-violet-500/15 text-violet-600 dark:text-violet-400", card: "bg-violet-500/[0.03]", caption: "em planejamento",
    info: "Projeto com handover ok, início das atividades do Gerente de Projetos.",
  },
  implantacao: {
    icon: Wrench, tile: "bg-sky-500/15 text-sky-600 dark:text-sky-400", card: "bg-sky-500/[0.03]", caption: "em implantação",
    info: "Projeto em execução: instalação dos equipamentos e implantação da frota em andamento.",
  },
  encerrado: {
    icon: CheckCircle2, tile: "bg-teal-500/15 text-teal-600 dark:text-teal-400", card: "bg-teal-500/[0.03]", caption: "em operação",
    info: "Implantação concluída: projeto entregue ao cliente e em operação.",
  },
  suspenso: {
    icon: MoreHorizontal, tile: "bg-slate-500/15 text-slate-600 dark:text-slate-300", card: "bg-slate-500/[0.03]", caption: "em andamento",
    info: "Projetos suspensos ou fora do fluxo padrão de implantação.",
  },
};

function KpiInfo({ title, text }: { title: string; text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`O que significa ${title}`}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-64 text-sm">
        <p className="mb-1 font-semibold">{title}</p>
        <p className="text-muted-foreground">{text}</p>
      </PopoverContent>
    </Popover>
  );
}

const prefsKey = (userId: string) => `transdata:comercial-prefs:${userId}`;

export default function VisaoComercial() {
  const navigate = useNavigate();
  const { filters, setFilter, clearFilters } = useProjectFilters();
  const { settings } = useSettings();
  const { user } = useAuth();
  const { can, loading: permsLoading } = usePermissions();

  const [projects, setProjects] = useState<FollowUpProject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("stale");
  const [view, setView] = useState<ViewMode>("grid");
  const [managers, setManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selected, setSelected] = useState<FollowUpProject | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [liveAt, setLiveAt] = useState<Date | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [staleCount, setStaleCount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [staleOnly, setStaleOnly] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Mesmos SLAs do Kanban (Configurações > SLA): "Atrasados" = laranja + vermelho.
  const slaT = useMemo<SlaThresholds>(() => ({
    green: settings.slaGreenMaxDays,
    yellow: settings.slaYellowMaxDays,
    orange: settings.slaOrangeMaxDays,
  }), [settings.slaGreenMaxDays, settings.slaYellowMaxDays, settings.slaOrangeMaxDays]);
  const allowed = permsLoading || can("visao_comercial", "view");
  const mounted = useRef(true);

  useEffect(() => {
    if (!permsLoading && !can("visao_comercial", "view")) navigate("/", { replace: true });
  }, [permsLoading, can, navigate]);

  // Preferências (busca / ordenação) por usuário
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(prefsKey(user.id));
      if (raw) {
        const p = JSON.parse(raw) as { search?: string; sort?: SortKey; view?: ViewMode };
        if (p.search) { setSearch(p.search); setDebouncedSearch(p.search); }
        if (p.sort) setSort(p.sort);
        if (p.view) setView(p.view);
      }
    } catch { /* ignora */ }
    setPrefsLoaded(true);
  }, [user]);

  useEffect(() => {
    if (!user || !prefsLoaded) return;
    try {
      localStorage.setItem(prefsKey(user.id), JSON.stringify({ search, sort, view }));
    } catch { /* ignora */ }
  }, [user, prefsLoaded, search, sort, view]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    supabase.from("team_members").select("id, full_name").eq("role", "gerente_projetos").eq("active", true)
      .then(({ data }) => setManagers(data || []));
    supabase.from("projects").select("city").order("city")
      .then(({ data }) => setCities(Array.from(new Set((data || []).map(p => p.city))).sort()));
  }, []);

  // Notas de acompanhamento (project_notes) dos projetos carregados
  const loadNotes = useCallback(async (ids: string[]): Promise<Record<string, DbFollowUpNote[]>> => {
    if (ids.length === 0) return {};
    const { data } = await supabase
      .from("project_notes")
      .select("id, project_id, content, created_at, created_by")
      .in("project_id", ids)
      .order("created_at", { ascending: false });
    const rows = data || [];
    const authorIds = Array.from(new Set(rows.map(r => r.created_by).filter(Boolean))) as string[];
    const authorMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", authorIds);
      (profs || []).forEach(p => { if (p.full_name) authorMap[p.user_id] = p.full_name; });
    }
    const map: Record<string, DbFollowUpNote[]> = {};
    rows.forEach(r => {
      const list = map[r.project_id] ?? (map[r.project_id] = []);
      list.push({
        id: r.id,
        content: r.content,
        created_at: r.created_at,
        author: r.created_by ? authorMap[r.created_by] ?? null : null,
      });
    });
    return map;
  }, []);

  const applyFilters = useCallback(<T,>(q: T): T => {
    let query = q as unknown as ReturnType<typeof supabase.from>["select"] extends never ? never : any;
    if (filters.managerId) query = query.eq("manager_id", filters.managerId);
    if (filters.companyName) query = query.ilike("company_name", `%${filters.companyName}%`);
    if (filters.state) {
      if (filters.state.startsWith("c:")) query = query.eq("country_code", filters.state.slice(2));
      else query = query.eq("state", filters.state);
    }
    if (filters.city) query = query.eq("city", filters.city);
    if (filters.status) query = query.eq("status", filters.status);
    else if (!showAll) query = query.neq("status", "encerrado");
    if (debouncedSearch) query = query.or(`company_name.ilike.%${debouncedSearch}%,project_code.ilike.%${debouncedSearch}%`);
    return query as T;
  }, [filters, debouncedSearch, showAll]);


  const applySort = useCallback((query: any) => {
    switch (sort) {
      case "recent": return query.order("updated_at", { ascending: false });
      case "company": return query.order("company_name", { ascending: true });
      case "status": return query.order("status", { ascending: true }).order("company_name", { ascending: true });
      case "stale":
      default: return query.order("updated_at", { ascending: true });
    }
  }, [sort]);

  const fetchPage = useCallback(async (targetPage: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    let query = supabase.from("projects").select(SELECT_COLS, { count: "exact" });
    query = applyFilters(query);
    query = applySort(query);
    const from = targetPage * PAGE_SIZE;
    const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
    const rows = (data as unknown as FollowUpProject[]) || [];
    const notesMap = await loadNotes(rows.map(r => r.id));
    if (!mounted.current) return;
    const withNotes = rows.map(r => ({ ...r, notes: notesMap[r.id] ?? [] }));
    setProjects(prev => (append ? [...prev, ...withNotes] : withNotes));
    setTotal(count ?? rows.length);
    setPage(targetPage);
    setLiveAt(new Date());
    setLoading(false);
    setLoadingMore(false);
  }, [applyFilters, applySort, loadNotes]);

  const loadSummary = useCallback(async () => {
    const [{ data: projData }, { data: noteData }] = await Promise.all([
      supabase.from("projects").select("id, status, updated_at, observations"),
      supabase.from("project_notes").select("project_id, created_at").order("created_at", { ascending: false }),
    ]);
    const rows = (projData as { id: string; status: string; updated_at: string; observations: string | null }[]) || [];
    const latestNote: Record<string, string> = {};
    (noteData || []).forEach(n => {
      if (!latestNote[n.project_id]) latestNote[n.project_id] = n.created_at;
    });
    const counts: Record<string, number> = {};
    let stale = 0;
    rows.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1;
      if (isLateSla(followUpSla(r.status, lastFollowUpAt(r.observations, latestNote[r.id]), slaT))) stale += 1;
    });
    if (!mounted.current) return;
    setStatusCounts(counts);
    setStaleCount(stale);
    setGrandTotal(rows.length);
  }, [slaT]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { if (user) fetchPage(0, false); }, [user, fetchPage]);
  useEffect(() => { if (user) loadSummary(); }, [user, loadSummary]);

  // Link direto (?projeto=<id>, usado nos e-mails de alerta): abre o acompanhamento do projeto
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedId = searchParams.get("projeto");
  const clearLinked = useCallback(() => {
    setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete("projeto"); return next; }, { replace: true });
  }, [setSearchParams]);
  useEffect(() => {
    if (!user || !linkedId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("projects").select(SELECT_COLS).eq("id", linkedId).maybeSingle();
      if (cancelled) return;
      if (!data) {
        toast.error("Projeto não encontrado", { description: "Ele pode ter sido removido ou você não tem acesso a ele." });
        clearLinked();
        return;
      }
      const notesMap = await loadNotes([linkedId]);
      if (cancelled) return;
      setSelected({ ...(data as unknown as FollowUpProject), notes: notesMap[linkedId] ?? [] });
      setDrawerOpen(true);
    })();
    return () => { cancelled = true; };
  }, [user, linkedId, loadNotes, clearLinked]);

  const flag = useCallback((id: string) => {
    setLiveAt(new Date());
    setRecentIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    setTimeout(() => {
      if (!mounted.current) return;
      setRecentIds(prev => prev.filter(x => x !== id));
    }, 10000);
  }, []);

  // Atualiza um único projeto já carregado na lista
  const refreshOne = useCallback(async (id: string) => {
    const { data } = await supabase.from("projects").select(SELECT_COLS).eq("id", id).maybeSingle();
    if (!data) return false;
    const notesMap = await loadNotes([id]);
    if (!mounted.current) return true;
    const row = { ...(data as unknown as FollowUpProject), notes: notesMap[id] ?? [] };
    let found = false;
    setProjects(prev => {
      found = prev.some(p => p.id === id);
      return found ? prev.map(p => (p.id === id ? row : p)) : prev;
    });
    setSelected(prev => (prev && prev.id === id ? row : prev));
    return found;
  }, [loadNotes]);

  // Realtime: mudanças em projetos e novos acompanhamentos
  useEffect(() => {
    if (!user) return;
    let summaryTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleSummary = () => {
      if (summaryTimer) clearTimeout(summaryTimer);
      summaryTimer = setTimeout(() => loadSummary(), 600);
    };

    const channel = supabase
      .channel("visao-comercial-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "projects" }, async payload => {
        const id = (payload.new as { id?: string })?.id;
        if (!id) return;
        flag(id);
        const inList = await refreshOne(id);
        if (!inList) fetchPage(0, false);
        scheduleSummary();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "projects" }, () => {
        setLiveAt(new Date());
        fetchPage(0, false);
        scheduleSummary();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "projects" }, () => {
        setLiveAt(new Date());
        fetchPage(0, false);
        scheduleSummary();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_notes" }, async payload => {
        const rec = (payload.new ?? payload.old) as { project_id?: string } | null;
        const id = rec?.project_id;
        if (!id) return;
        flag(id);
        await refreshOne(id);
        scheduleSummary();
      })
      .subscribe();

    return () => {
      if (summaryTimer) clearTimeout(summaryTimer);
      supabase.removeChannel(channel);
    };
  }, [user, fetchPage, loadSummary, refreshOne, flag]);

  const hasActiveFilters = Object.values(filters).some(v => v !== "") || search !== "" || staleOnly || showAll;
  const hasMore = projects.length < total;

  const openProject = (p: FollowUpProject) => { setSelected(p); setDrawerOpen(true); };

  const kpis = useMemo(() => Constants.public.Enums.project_status.map(s => ({
    key: s as ProjectStatus,
    label: statusLabels[s as ProjectStatus],
    value: statusCounts[s] || 0,
  })), [statusCounts]);

  const lastAtFor = useCallback((p: FollowUpProject) => lastFollowUpAt(p.observations, p.notes?.[0]?.created_at), []);
  // null = nenhum acompanhamento registrado (ordena como o mais antigo)
  const daysFor = useCallback((p: FollowUpProject) => {
    const at = lastAtFor(p);
    return at ? Math.max(0, differenceInDays(new Date(), at)) : null;
  }, [lastAtFor]);
  const slaFor = useCallback((p: FollowUpProject) => followUpSla(p.status, lastAtFor(p), slaT), [lastAtFor, slaT]);
  const isStale = useCallback((p: FollowUpProject) => isLateSla(slaFor(p)), [slaFor]);

  const visibleProjects = useMemo(() => {
    const list = staleOnly ? projects.filter(isStale) : projects;
    const d = (p: FollowUpProject) => daysFor(p) ?? Number.MAX_SAFE_INTEGER;
    if (sort === "stale") return [...list].sort((a, b) => d(b) - d(a));
    if (sort === "recent") return [...list].sort((a, b) => d(a) - d(b));
    return list;
  }, [projects, staleOnly, isStale, sort, daysFor]);

  // Recém-cadastrados: ainda sem nenhum acompanhamento. Ficam num bloco no
  // topo até o GP registrar o primeiro acompanhamento.
  const newProjects = useMemo(() => visibleProjects.filter(p => !effectiveLatestFollowUp(p)), [visibleProjects]);
  const otherProjects = useMemo(() => visibleProjects.filter(p => !!effectiveLatestFollowUp(p)), [visibleProjects]);

  const managerSummary = useMemo(() => {
    const map = new Map<string, { name: string; total: number; stale: number }>();
    projects.forEach(p => {
      const name = p.manager?.full_name ?? "Sem gerente";
      const entry = map.get(name) ?? { name, total: 0, stale: 0 };
      entry.total += 1;
      if (isStale(p)) entry.stale += 1;
      map.set(name, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.stale - a.stale || b.total - a.total);
  }, [projects, isStale]);

  const exportCsv = () => {
    const head = ["Código", "Empresa", "Cidade", "UF/País", teamRoleLabels.manager ?? "Gerente", teamRoleLabels.executive ?? "Executivo", "Status", "Frota", "Implantada", "Dias sem atualização", "Última atualização", "Autor"];
    const lines = visibleProjects.map(p => {
      const note = effectiveLatestFollowUp(p);
      return [
        p.project_code ?? "",
        p.company_name,
        p.city,
        p.state ?? p.country_code ?? "",
        p.manager?.full_name ?? "",
        p.executive?.full_name ?? "",
        statusLabels[p.status],
        String(p.fleet_size ?? 0),
        String(p.implemented_fleet ?? 0),
        String(daysFor(p) ?? ""),
        (note?.text ?? "").replace(/\s+/g, " ").slice(0, 300),
        note?.author ?? "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";");
    });
    const csv = "\uFEFF" + [head.join(";"), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `visao-comercial-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectStatus = (status: string) => {
    setShowAll(false);
    setStaleOnly(false);
    setFilter("status", filters.status === status ? "" : status);
  };

  const selectTotal = () => {
    setStaleOnly(false);
    setFilter("status", "");
    setShowAll(true);
  };

  const toggleStale = () => {
    setShowAll(false);
    setStaleOnly(v => !v);
  };

  const kpiCardClass = (active: boolean, tint: string) =>
    `flex items-center gap-4 rounded-xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${tint} ${active ? "border-primary ring-2 ring-primary/30" : "border-border/60"}`;

  const renderKpi = (key: ProjectStatus | "total", label: string, value: number, active: boolean, onClick: () => void) => {
    const st = kpiStyle[key];
    const Icon = st.icon;
    return (
      <div key={key} className="relative">
        <button type="button" aria-pressed={active} onClick={onClick} className={`h-full w-full pr-8 ${kpiCardClass(active, st.card)}`}>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${st.tile}`}>
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="block text-2xl font-bold leading-tight">{value}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{st.caption}</span>
          </span>
        </button>
        <KpiInfo title={label} text={st.info} />
      </div>
    );
  };

  const gridClass = view === "grid" ? "grid gap-4 xl:grid-cols-2" : "grid gap-3";

  if (!allowed) return null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Visão Comercial</span>
          <h1 className="text-2xl font-bold tracking-tight">Acompanhamento de Projetos</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe em tempo real o status dos projetos, desde a implantação até a entrega final.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {liveAt && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="h-5 w-5" />
              <div className="leading-tight">
                <p className="text-[10px]">Última atualização</p>
                <p className="text-xs font-semibold text-foreground">
                  {liveAt.toLocaleDateString("pt-BR")} {liveAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          )}
          <Button variant="outline" className="h-10 bg-card shadow-sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4 text-primary" /> Exportar CSV
          </Button>
          <Button variant="outline" className="h-10 bg-card shadow-sm" onClick={() => { fetchPage(0, false); loadSummary(); }}>
            <RefreshCw className="mr-2 h-4 w-4 text-primary" /> Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        {renderKpi("total", "Total", grandTotal, showAll, selectTotal)}
        {kpis.map(k => renderKpi(k.key, k.label, k.value, filters.status === k.key, () => selectStatus(k.key)))}
        <div className="relative">
        <button
          type="button"
          aria-pressed={staleOnly}
          onClick={toggleStale}
          className={`flex h-full w-full items-center gap-4 rounded-xl border bg-destructive/5 p-4 pr-8 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${staleOnly ? "border-destructive ring-2 ring-destructive/30" : "border-destructive/30"}`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-destructive">Atrasados</span>
            <span className="block text-2xl font-bold leading-tight text-destructive">{staleCount}</span>
            <span className="block truncate text-[11px] text-muted-foreground">+{slaT.yellow} dias sem acompanhamento</span>
          </span>
        </button>
        <KpiInfo
          title="Atrasados"
          text={`Mesma regra do Kanban: projetos em Comercial, Planejamento ou Implantação sem acompanhamento registrado pelo gerente há mais de ${slaT.yellow} dias (faixas laranja e vermelha), ou que ainda não têm nenhum acompanhamento. Os prazos são os SLAs definidos em Configurações.`}
        />
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="hidden space-y-4 lg:block">
          <KanbanFilters
            filters={filters}
            setFilter={setFilter}
            clearFilters={() => { clearFilters(); setSearch(""); setShowAll(false); setStaleOnly(false); }}
            hasActiveFilters={hasActiveFilters}
            managers={managers}
            cities={cities}
            columns={Constants.public.Enums.project_status}
          />

          {managerSummary.length > 0 && (
            <div className="w-[260px] rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Por gerente (nesta lista)
              </p>
              <ul className="space-y-2">
                {managerSummary.map(m => (
                  <li key={m.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{m.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="font-medium">{m.total}</span>
                      {m.stale > 0 && (
                        <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                          {m.stale} atrasado{m.stale !== 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por empresa ou código do projeto..."
                className="h-10 pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-border/60 p-0.5" role="group" aria-label="Modo de visualização">
                {([["grid", LayoutGrid, "Grade"], ["list", List, "Lista"]] as const).map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={view === mode}
                    title={label}
                    onClick={() => setView(mode)}
                    className={`flex h-8 w-9 items-center justify-center rounded-md transition-colors ${view === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
                <SelectTrigger className="h-10 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stale">Mais tempo sem atualização</SelectItem>
                  <SelectItem value="recent">Última atualização</SelectItem>
                  <SelectItem value="company">Nome da empresa</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                {(["ok", "warn", "late", "critical"] as const).map(l => (
                  <span key={l} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${followUpLevelStyles[l].dot}`} />
                    {followUpLevelStyles[l].label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {staleOnly ? visibleProjects.length : total} projeto{(staleOnly ? visibleProjects.length : total) !== 1 ? "s" : ""}
            </span>
            {hasActiveFilters && <span> · filtros ativos</span>}
            {!filters.status && !showAll && <span> · Implementados ocultos</span>}
          </p>

          {loading ? (
            <div className={gridClass}>
              {Array.from({ length: 4 }).map((_, i) => <ProjectFollowUpSkeleton key={i} />)}
            </div>
          ) : visibleProjects.length === 0 ? (
            <EmptyState
              type="search"
              title="Nenhum projeto encontrado"
              description="Ajuste ou limpe os filtros e a busca para ver os projetos em andamento."
            />
          ) : (
            <>
              {newProjects.length > 0 && (
                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Recém-cadastrados · sem acompanhamento ({newProjects.length})
                  </p>
                  <div className={gridClass}>
                    {newProjects.map(p => (
                      <ProjectFollowUpCard
                        key={p.id}
                        project={p}
                        sla={slaFor(p)}
                        onOpen={openProject}
                        justUpdated={recentIds.includes(p.id)}
                        isNew
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className={gridClass}>
                {otherProjects.map(p => (
                  <ProjectFollowUpCard
                    key={p.id}
                    project={p}
                    sla={slaFor(p)}
                    onOpen={openProject}
                    justUpdated={recentIds.includes(p.id)}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={() => fetchPage(page + 1, true)} disabled={loadingMore}>
                    {loadingMore ? "Carregando..." : "Carregar mais"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ProjectFollowUpDrawer project={selected} open={drawerOpen}
        onOpenChange={o => { setDrawerOpen(o); if (!o && linkedId) clearLinked(); }} />
    </div>
  );
}
