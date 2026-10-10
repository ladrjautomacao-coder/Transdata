import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Package, TrendingUp, Users, MapPin, CalendarDays, Layers, Zap, Signal, Filter, X, Calendar as CalendarIcon, BarChart3, CheckCircle2, PauseCircle, PlayCircle, FileText, GripVertical, RotateCcw, CalendarClock, Truck, Briefcase } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell,
  AreaChart, Area,
  ResponsiveContainer,
} from "recharts";
import { format, differenceInDays, parseISO } from "date-fns";
import { Constants } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";
import { motion, AnimatePresence } from "framer-motion";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { teamRoleLabels } from "@/lib/teamRoleLabels";

type ProjectStatus = Database["public"]["Enums"]["project_status"];

const statusLabels: Record<ProjectStatus, string> = {
  comercial: "Comercial",
  planejamento: "Planejamento",
  implantacao: "Implantação",
  encerrado: "Implementado",
  suspenso: "Outros",
};

const STATUS_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(38 92% 50%)",
  "hsl(28 90% 52%)",
  "hsl(142 72% 42%)",
  "hsl(0 62% 50%)",
];

const STATUS_ICONS: Record<string, any> = {
  comercial: Briefcase,
  planejamento: FileText,
  implantacao: PlayCircle,
  encerrado: CheckCircle2,
  suspenso: PauseCircle,
};

const PRODUCT_COLORS = [
  "hsl(28 90% 52%)",
  "hsl(190 80% 50%)",
  "hsl(280 65% 55%)",
  "hsl(142 72% 42%)",
  "hsl(38 92% 50%)",
  "hsl(340 65% 50%)",
  "hsl(220 70% 55%)",
  "hsl(60 70% 45%)",
];

interface ProjectRow {
  id: string;
  company_name: string;
  city: string;
  state: string;
  contract_date: string;
  d_zero_date: string | null;
  handover_date: string | null;
  status: ProjectStatus;
  fleet_size: number | null;
  contractual_deadline_days: number | null;
  implementation_deadline_days: number | null;
  is_pilot: boolean;
  complementary_sale: boolean;
  complementary_fleet: number;
  implemented_fleet: number;
  reached_implemented: boolean;
  reached_implemented_at: string | null;
  executive: { full_name: string } | null;
  manager: { full_name: string } | null;
  project_products: { product: { name: string } | null }[];
  project_solutions: { solution: { name: string } | null }[];
}

const getProjectFleet = (p: ProjectRow): number => {
  const base = p.fleet_size || 0;
  const complement = p.complementary_sale ? (p.complementary_fleet || 0) : 0;
  return base + complement;
};

// Status efetivo para contabilização: projetos que já atingiram Implementado
// permanecem contados como "encerrado" mesmo se forem movidos para outras colunas.
const effectiveStatus = (p: ProjectRow): ProjectStatus =>
  p.reached_implemented ? "encerrado" : p.status;

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value, duration]);

  return <>{display}</>;
}

function GlowCard({ children, className = "", glow = false, delay = 0 }: { children: React.ReactNode; className?: string; glow?: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative rounded-2xl border border-border/40 bg-card/90 backdrop-blur-md overflow-hidden ${glow ? "glow-orange" : ""} ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

function KpiCard({ icon: Icon, label, value, accent = "primary", index = 0, active = false, onClick }: { icon: any; label: string; value: number; accent?: string; index?: number; active?: boolean; onClick?: () => void }) {
  const accentMap: Record<string, { bg: string; icon: string; border: string; glow: string }> = {
    primary: { bg: "from-primary/15 to-primary/5", icon: "text-primary", border: "border-primary/20", glow: "shadow-primary/10" },
    amber: { bg: "from-amber-500/15 to-amber-500/5", icon: "text-amber-500", border: "border-amber-500/20", glow: "shadow-amber-500/10" },
    emerald: { bg: "from-emerald-500/15 to-emerald-500/5", icon: "text-emerald-500", border: "border-emerald-500/20", glow: "shadow-emerald-500/10" },
    cyan: { bg: "from-cyan-500/15 to-cyan-500/5", icon: "text-cyan-500", border: "border-cyan-500/20", glow: "shadow-cyan-500/10" },
    red: { bg: "from-red-500/15 to-red-500/5", icon: "text-red-500", border: "border-red-500/20", glow: "shadow-red-500/10" },
  };
  const colors = accentMap[accent] || accentMap.primary;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onClick}
      className={`relative rounded-2xl border ${colors.border} bg-card/90 backdrop-blur-md overflow-hidden shadow-lg ${colors.glow} cursor-pointer transition-all hover:shadow-xl ${active ? "ring-2 ring-primary/50 ring-offset-1" : ""}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg} pointer-events-none`} />
      <div className="relative p-5 flex items-center gap-4">
        <div className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors.bg} border ${colors.border}`}>
          <Icon className={`h-6 w-6 ${colors.icon}`} />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">{label}</p>
          <p className="text-3xl font-bold tracking-tight mt-0.5" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            <AnimatedNumber value={value} />
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function StatusKpiCard({ status, count, color, icon: Icon, index, active, onClick }: { status: string; count: number; color: string; icon: any; index: number; active?: boolean; onClick?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border bg-card/70 backdrop-blur-sm px-4 py-3 min-w-0 cursor-pointer transition-all hover:shadow-md ${active ? "border-2 ring-1 ring-offset-1" : "border-border/40"}`}
      style={active ? { borderColor: color, boxShadow: `0 0 16px ${color}25`, ringColor: color } as any : undefined}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-medium truncate">{status}</p>
        <p className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Rajdhani', sans-serif", color }}>
          <AnimatedNumber value={count} duration={800} />
        </p>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterCity, setFilterCity] = useState<string>("all");
  const [filterSolution, setFilterSolution] = useState<string>("all");
  const [filterManager, setFilterManager] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [selectedBarState, setSelectedBarState] = useState<string | null>(null);
  const [selectedBarManager, setSelectedBarManager] = useState<string | null>(null);
  const [selectedFleetStatus, setSelectedFleetStatus] = useState<ProjectStatus | null>(null);

  const DEFAULT_CHART_ORDER = ["status", "solucoes", "frota", "solucao-timeline", "estado", "gerente"];
  const [chartOrder, setChartOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("analytics-chart-order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_CHART_ORDER.length) return parsed;
      }
    } catch {}
    return DEFAULT_CHART_ORDER;
  });
  const [draggedChart, setDraggedChart] = useState<string | null>(null);
  const [dragOverChart, setDragOverChart] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, chartId: string) => {
    setDraggedChart(chartId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", chartId);
  };
  const handleDragOver = (e: React.DragEvent, chartId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (chartId !== draggedChart) setDragOverChart(chartId);
  };
  const handleDragLeave = () => setDragOverChart(null);
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverChart(null);
    if (!draggedChart || draggedChart === targetId) return;
    const newOrder = [...chartOrder];
    const fromIdx = newOrder.indexOf(draggedChart);
    const toIdx = newOrder.indexOf(targetId);
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedChart);
    setChartOrder(newOrder);
    localStorage.setItem("analytics-chart-order", JSON.stringify(newOrder));
    setDraggedChart(null);
  };
  const handleDragEnd = () => { setDraggedChart(null); setDragOverChart(null); };
  const resetChartOrder = () => {
    setChartOrder(DEFAULT_CHART_ORDER);
    localStorage.removeItem("analytics-chart-order");
  };
  const isCustomOrder = JSON.stringify(chartOrder) !== JSON.stringify(DEFAULT_CHART_ORDER);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select(`
          id, company_name, city, state, contract_date, d_zero_date, handover_date,
          status, fleet_size, contractual_deadline_days, implementation_deadline_days, is_pilot, complementary_sale, complementary_fleet, implemented_fleet,
          reached_implemented, reached_implemented_at,
          executive:team_members!projects_executive_id_fkey(full_name),
          manager:team_members!projects_manager_id_fkey(full_name),
          project_products(product:products(name)),
          project_solutions(solution:solutions(name))
        `)
        .order("company_name");

      if (!isMounted) return;

      if (error) {
        setProjects([]);
      } else {
        setProjects((data as unknown as ProjectRow[]) || []);
      }

      setLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [authLoading, user?.id]);

  const hasActiveFilters = filterStatus !== "all" || filterProject !== "all" || filterState !== "all" || filterCity !== "all" || filterSolution !== "all" || filterManager !== "all" || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterProject("all");
    setFilterState("all");
    setFilterCity("all");
    setFilterSolution("all");
    setFilterManager("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const stateOptions = useMemo(() => [...new Set(projects.map(p => p.state))].sort(), [projects]);
  const cityOptions = useMemo(() => {
    const filtered = filterState !== "all" ? projects.filter(p => p.state === filterState) : projects;
    return [...new Set(filtered.map(p => p.city))].sort();
  }, [projects, filterState]);
  const solutionOptions = useMemo(() => {
    const names = new Set<string>();
    projects.forEach(p => p.project_solutions?.forEach(ps => { if (ps.solution?.name) names.add(ps.solution.name); }));
    return [...names].sort();
  }, [projects]);
  const managerOptions = useMemo(() => {
    const names = new Set<string>();
    let hasNone = false;
    projects.forEach(p => { if (p.manager?.full_name) names.add(p.manager.full_name); else hasNone = true; });
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return hasNone ? [...sorted, "Sem gerente"] : sorted;
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filterStatus !== "all" && effectiveStatus(p) !== filterStatus) return false;
      if (filterProject !== "all" && p.id !== filterProject) return false;
      if (filterState !== "all" && p.state !== filterState) return false;
      if (filterCity !== "all" && p.city !== filterCity) return false;
      if (filterSolution !== "all") {
        const hasSolution = p.project_solutions?.some(ps => ps.solution?.name === filterSolution);
        if (!hasSolution) return false;
      }
      if (filterManager !== "all" && (p.manager?.full_name || "Sem gerente") !== filterManager) return false;
      if (dateFrom) {
        const contractDate = parseISO(p.contract_date);
        if (contractDate < dateFrom) return false;
      }
      if (dateTo) {
        const contractDate = parseISO(p.contract_date);
        if (contractDate > dateTo) return false;
      }
      return true;
    });
  }, [projects, filterStatus, filterProject, filterState, filterCity, filterSolution, filterManager, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    const counts: Record<ProjectStatus, number> = {
      comercial: 0, planejamento: 0, implantacao: 0, encerrado: 0, suspenso: 0,
    };
    filteredProjects.forEach(p => { const s = effectiveStatus(p); counts[s] = (counts[s] || 0) + 1; });
    return counts;
  }, [filteredProjects]);

  const statusData = useMemo(() => {
    return Constants.public.Enums.project_status.map((s, i) => ({
      name: statusLabels[s],
      value: statusCounts[s],
      fill: STATUS_COLORS[i],
    }));
  }, [statusCounts]);

  const stateData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProjects.forEach(p => { counts[p.state] = (counts[p.state] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([state, count]) => ({ state, count }));
  }, [filteredProjects]);

  const solutionData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProjects.forEach(p => {
      p.project_solutions?.forEach(ps => {
        const name = ps.solution?.name || "Sem solução";
        counts[name] = (counts[name] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({
      name, value, fill: PRODUCT_COLORS[i % PRODUCT_COLORS.length],
    }));
  }, [filteredProjects]);

  const fleetTimelineData = useMemo(() => {
    const sorted = [...filteredProjects]
      .filter(p => getProjectFleet(p) > 0)
      .sort((a, b) => a.contract_date.localeCompare(b.contract_date));
    const months: Record<string, number> = {};
    sorted.forEach(p => {
      const m = format(parseISO(p.contract_date), "MMM/yy");
      months[m] = (months[m] || 0) + getProjectFleet(p);
    });
    let cumulative = 0;
    return Object.entries(months).map(([month, fleet]) => {
      cumulative += fleet;
      return { month, frota: cumulative };
    });
  }, [filteredProjects]);

  const solutionTimelineData = useMemo(() => {
    const solutionNames = new Set<string>();
    filteredProjects.forEach(p => p.project_solutions?.forEach(ps => {
      if (ps.solution?.name) solutionNames.add(ps.solution.name);
    }));
    const names = [...solutionNames].sort();
    const sorted = [...filteredProjects]
      .filter(p => getProjectFleet(p) > 0)
      .sort((a, b) => a.contract_date.localeCompare(b.contract_date));
    const months: Record<string, Record<string, number>> = {};
    sorted.forEach(p => {
      const m = format(parseISO(p.contract_date), "MMM/yy");
      if (!months[m]) months[m] = {};
      p.project_solutions?.forEach(ps => {
        if (ps.solution?.name) {
          months[m][ps.solution.name] = (months[m][ps.solution.name] || 0) + getProjectFleet(p);
        }
      });
    });
    const cumulative: Record<string, number> = {};
    names.forEach(n => cumulative[n] = 0);
    return Object.entries(months).map(([month, sols]) => {
      names.forEach(n => { cumulative[n] += (sols[n] || 0); });
      return { month, ...Object.fromEntries(names.map(n => [n, cumulative[n]])) };
    });
  }, [filteredProjects]);

  const solutionNamesForChart = useMemo(() => {
    const names = new Set<string>();
    filteredProjects.forEach(p => p.project_solutions?.forEach(ps => {
      if (ps.solution?.name) names.add(ps.solution.name);
    }));
    return [...names].sort();
  }, [filteredProjects]);

  const managerData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProjects.forEach(p => {
      const name = p.manager?.full_name || "Sem gerente";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredProjects]);

  const totalProjects = filteredProjects.length;
  const avgFleet = filteredProjects.filter(p => getProjectFleet(p) > 0).reduce((a, p) => a + getProjectFleet(p), 0) / (filteredProjects.filter(p => getProjectFleet(p) > 0).length || 1);
  const totalFleet = filteredProjects.reduce((a, p) => a + getProjectFleet(p), 0);
  const totalStates = new Set(filteredProjects.map(p => p.state)).size;

  const fleetByStatus = useMemo(() => {
    const map: Record<ProjectStatus, number> = {
      comercial: 0, planejamento: 0, implantacao: 0, encerrado: 0, suspenso: 0,
    };
    filteredProjects.forEach(p => {
      const totalFleet = getProjectFleet(p);
      const impl = p.implemented_fleet || 0;
      const effStatus = effectiveStatus(p);
      if (impl > 0) {
        const implClamped = Math.min(impl, totalFleet);
        map["encerrado"] += implClamped;
        if (effStatus !== "encerrado") {
          map[effStatus] += totalFleet - implClamped;
        }
      } else {
        map[effStatus] += totalFleet;
      }
    });
    return map;
  }, [filteredProjects]);

  const fleetConfig: ChartConfig = {
    frota: { label: "Frota Acumulada", color: "hsl(28 90% 52%)" },
  };
  const solutionTimelineConfig: ChartConfig = Object.fromEntries(
    solutionNamesForChart.map((name, i) => [name, { label: name, color: PRODUCT_COLORS[i % PRODUCT_COLORS.length] }])
  );
  const genericConfig: ChartConfig = { value: { label: "Projetos" }, count: { label: "Projetos" } };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  function ExpandableProjectTable({ sectionKey, title, projectList }: { sectionKey: string; title: string; projectList: ProjectRow[] }) {
    return (
      <AnimatePresence>
        {expandedSection === sectionKey && (
          <motion.div
            key={sectionKey}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <GlowCard delay={0}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
                    <Badge variant="secondary" className="text-xs ml-1">{projectList.length}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setExpandedSection(null)} className="h-7 text-xs gap-1">
                    <X className="h-3 w-3" /> Fechar
                  </Button>
                </div>
                {projectList.length === 0 ? (
                  <EmptyState type="projects" title="Nenhum projeto encontrado" description="Ajuste os filtros para ver resultados." />
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Empresa</th>
                          <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Localização</th>
                          <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Status</th>
                          <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">{teamRoleLabels.manager ?? "Gerente"}</th>
                          <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Frota</th>
                          <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Soluções</th>
                          <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Cronograma</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectList.map((p, i) => (
                          <motion.tr
                            key={p.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => navigate(`/projetos/${p.id}`)}
                          >
                            <td className="py-2.5 px-3 font-medium text-foreground">{p.company_name}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{p.city}/{p.state}</td>
                            <td className="py-2.5 px-3">
                              <Badge variant="secondary" className="text-[10px]">{statusLabels[p.status]}</Badge>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                {p.manager?.full_name || <span className="text-muted-foreground italic">Sem gerente</span>}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold tabular-nums" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{getProjectFleet(p) || "—"}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap gap-1">
                                {p.project_solutions?.map((ps, j) => (
                                  <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0">{ps.solution?.name}</Badge>
                                ))}
                                {(!p.project_solutions || p.project_solutions.length === 0) && <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                            </td>
                            <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px]">
                                    <CalendarClock className="h-3 w-3" />
                                    Cronograma
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-4" align="end">
                                  <ProjectTimeline status={p.status} companyName={p.company_name} />
                                </PopoverContent>
                              </Popover>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </GlowCard>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            <Zap className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground font-medium tracking-wide uppercase text-xs">Processando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <div className="flex items-center gap-1.5 text-[10px] text-primary uppercase tracking-widest font-medium">
              <Signal className="h-3 w-3 animate-pulse" />
              Live
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Painel de inteligência dos projetos</p>
        </div>

        {/* Checklist de primeiros passos — só aparece pra quem ainda não tem nenhum projeto (cliente novo em trial) */}
        {projects.length === 0 && (
          <div className="rounded-lg border border-l-4 border-l-accent bg-card p-5">
            <h2 className="font-semibold mb-1">Bem-vindo! Vamos configurar seu primeiro projeto</h2>
            <p className="text-sm text-muted-foreground mb-4">Dois passos rápidos pra começar a usar o sistema de verdade.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Layers className="h-5 w-5 text-accent-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">1. Cadastre seu primeiro projeto</p>
                  <p className="text-xs text-muted-foreground mb-2">Nome da empresa cliente, cidade, datas e equipe.</p>
                  <Button size="sm" onClick={() => navigate("/projetos/novo")}>Cadastrar projeto</Button>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Users className="h-5 w-5 text-accent-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">2. Adicione sua equipe</p>
                  <p className="text-xs text-muted-foreground mb-2">Gerentes e executivos que vão trabalhar nos projetos.</p>
                  <Button size="sm" variant="outline" onClick={() => navigate("/admin/equipe")}>Ver equipe</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <GlowCard delay={0.1}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros</span>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-7 text-xs gap-1">
                  <X className="h-3 w-3" /> Limpar
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-background border-border/50 h-9 text-xs justify-start font-normal">
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-background border-border/50 h-9 text-xs justify-start font-normal">
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-background border-border/50 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Status</SelectItem>
                  {Constants.public.Enums.project_status.map(s => (
                    <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="bg-background border-border/50 h-9 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Projetos</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterState} onValueChange={v => { setFilterState(v); setFilterCity("all"); }}>
                <SelectTrigger className="bg-background border-border/50 h-9 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Estados</SelectItem>
                  {stateOptions.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterCity} onValueChange={setFilterCity}>
                <SelectTrigger className="bg-background border-border/50 h-9 text-xs"><SelectValue placeholder="Cidade" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Cidades</SelectItem>
                  {cityOptions.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSolution} onValueChange={setFilterSolution}>
                <SelectTrigger className="bg-background border-border/50 h-9 text-xs"><SelectValue placeholder="Solução" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Soluções</SelectItem>
                  {solutionOptions.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterManager} onValueChange={setFilterManager}>
                <SelectTrigger className="bg-background border-border/50 h-9 text-xs"><SelectValue placeholder={teamRoleLabels.manager ?? "Gerente"} /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Gerentes</SelectItem>
                  {managerOptions.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </GlowCard>
      </motion.div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={Layers} label="Total Projetos" value={totalProjects} accent="primary" index={0} active={expandedSection === "total"} onClick={() => toggleSection("total")} />
        <KpiCard icon={MapPin} label="Estados" value={totalStates} accent="emerald" index={1} active={expandedSection === "estados-kpi"} onClick={() => toggleSection("estados-kpi")} />
        <KpiCard icon={TrendingUp} label="Frota Média" value={Math.round(avgFleet)} accent="cyan" index={2} active={expandedSection === "frota-kpi"} onClick={() => toggleSection("frota-kpi")} />
        <KpiCard icon={Truck} label="Frota Total" value={totalFleet} accent="amber" index={3} active={expandedSection === "frota-total"} onClick={() => toggleSection("frota-total")} />
        <KpiCard icon={Truck} label="Frota por Status" value={totalFleet} accent="red" index={4} active={expandedSection === "frota-status"} onClick={() => toggleSection("frota-status")} />
      </div>

      <ExpandableProjectTable sectionKey="total" title="Todos os Projetos" projectList={filteredProjects} />
      <ExpandableProjectTable sectionKey="estados-kpi" title="Projetos por Estado" projectList={filteredProjects} />
      <ExpandableProjectTable sectionKey="frota-kpi" title="Projetos com Frota" projectList={filteredProjects.filter(p => getProjectFleet(p) > 0)} />
      <ExpandableProjectTable sectionKey="frota-total" title="Frota Total por Projeto" projectList={filteredProjects.filter(p => getProjectFleet(p) > 0)} />

      {/* Frota por Status expandable */}
      <AnimatePresence>
        {expandedSection === "frota-status" && (
          <motion.div
            key="frota-status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <GlowCard delay={0}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Frota por Status</h3>
                    <Badge variant="secondary" className="text-xs ml-1">{totalFleet} veículos</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setExpandedSection(null)} className="h-7 text-xs gap-1">
                    <X className="h-3 w-3" /> Fechar
                  </Button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {Constants.public.Enums.project_status.map((s, i) => {
                    const Icon = STATUS_ICONS[s];
                    const isActive = selectedFleetStatus === s;
                    return (
                      <div
                        key={s}
                        onClick={() => setSelectedFleetStatus(prev => prev === s ? null : s)}
                        className={`flex items-center gap-3 rounded-xl border bg-card/70 backdrop-blur-sm px-4 py-4 cursor-pointer transition-all hover:shadow-md ${isActive ? "border-2 ring-1 ring-offset-1" : "border-border/40"}`}
                        style={isActive ? { borderColor: STATUS_COLORS[i], boxShadow: `0 0 16px ${STATUS_COLORS[i]}25` } as any : undefined}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${STATUS_COLORS[i]}15` }}>
                          <Icon className="h-5 w-5" style={{ color: STATUS_COLORS[i] }} />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">{statusLabels[s]}</p>
                          <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Rajdhani', sans-serif", color: STATUS_COLORS[i] }}>
                            <AnimatedNumber value={fleetByStatus[s]} duration={800} />
                          </p>
                          <p className="text-[10px] text-muted-foreground">veículos</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Project list for selected fleet status */}
                <AnimatePresence>
                  {selectedFleetStatus && (() => {
                    const getFleetForStatus = (p: any, status: string) => {
                      const total = getProjectFleet(p);
                      const impl = p.implemented_fleet || 0;
                      if (status === "encerrado") return impl;
                      if (impl > 0) return Math.max(0, total - impl);
                      return total;
                    };
                    const statusProjects = selectedFleetStatus === "encerrado"
                      ? filteredProjects.filter(p => {
                          if (effectiveStatus(p) === "encerrado") return getProjectFleet(p) > 0;
                          return (p.implemented_fleet || 0) > 0;
                        })
                      : filteredProjects.filter(p => effectiveStatus(p) === selectedFleetStatus && getFleetForStatus(p, selectedFleetStatus) > 0);
                    const statusIndex = Constants.public.Enums.project_status.indexOf(selectedFleetStatus);
                    const statusColor = STATUS_COLORS[statusIndex];
                    return (
                      <motion.div
                        key={selectedFleetStatus}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden mt-4"
                      >
                        <div className="rounded-xl border border-border/40 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Projetos em {statusLabels[selectedFleetStatus]}
                              </h4>
                              <Badge variant="secondary" className="text-[10px]">{statusProjects.length}</Badge>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedFleetStatus(null)} className="h-6 text-[10px] gap-1">
                              <X className="h-3 w-3" /> Fechar
                            </Button>
                          </div>
                          {statusProjects.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Nenhum projeto com frota neste status.</p>
                          ) : (
                            <div className="overflow-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border/50">
                                    <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Empresa</th>
                                    <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Localização</th>
                                    <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">{teamRoleLabels.manager ?? "Gerente"}</th>
                                    <th className="text-right text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Frota</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {statusProjects.map((p, idx) => (
                                    <motion.tr
                                      key={p.id}
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: idx * 0.03 }}
                                      className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer"
                                      onClick={() => navigate(`/projetos/${p.id}`)}
                                    >
                                      <td className="py-2 px-3 font-medium text-foreground">{p.company_name}</td>
                                      <td className="py-2 px-3 text-muted-foreground">{p.city}/{p.state}</td>
                                      <td className="py-2 px-3 text-muted-foreground">{p.manager?.full_name || "—"}</td>
                                      <td className="py-2 px-3 text-right font-semibold tabular-nums" style={{ fontFamily: "'Rajdhani', sans-serif", color: statusColor }}>{getFleetForStatus(p, selectedFleetStatus!)}</td>
                                    </motion.tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>
            </GlowCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section label */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Resumo Projetos</span>
        <div className="flex-1 h-px bg-border/50" />
      </div>

      {/* Status breakdown strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Constants.public.Enums.project_status.map((s, i) => (
          <StatusKpiCard
            key={s}
            status={statusLabels[s]}
            count={statusCounts[s]}
            color={STATUS_COLORS[i]}
            icon={STATUS_ICONS[s]}
            index={i}
            active={selectedStatus === s}
            onClick={() => setSelectedStatus(prev => prev === s ? null : s)}
          />
        ))}
      </div>

      {/* Expandable project list for selected status */}
      <AnimatePresence>
        {selectedStatus && (() => {
          const statusProjects = filteredProjects.filter(p => effectiveStatus(p) === selectedStatus);
          const statusIndex = Constants.public.Enums.project_status.indexOf(selectedStatus);
          const statusColor = STATUS_COLORS[statusIndex] || STATUS_COLORS[0];
          return (
            <motion.div
              key={selectedStatus}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <GlowCard delay={0}>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Projetos em {statusLabels[selectedStatus]}
                      </h3>
                      <Badge variant="secondary" className="text-xs ml-1">{statusProjects.length}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedStatus(null)} className="h-7 text-xs gap-1">
                      <X className="h-3 w-3" /> Fechar
                    </Button>
                  </div>

                  {statusProjects.length === 0 ? (
                    <p className="text-center text-muted-foreground text-xs py-6">Nenhum projeto neste status</p>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Empresa</th>
                            <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Localização</th>
                            <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">{teamRoleLabels.manager ?? "Gerente de Projetos"}</th>
                            <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Frota</th>
                            <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Contrato</th>
                            <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Soluções</th>
                            <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider font-semibold py-2 px-3">Cronograma</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statusProjects.map((p, i) => (
                            <motion.tr
                              key={p.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => navigate(`/projetos/${p.id}`)}
                            >
                              <td className="py-2.5 px-3 font-medium text-foreground">{p.company_name}</td>
                              <td className="py-2.5 px-3 text-muted-foreground">{p.city}/{p.state}</td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex items-center gap-1.5">
                                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                  {p.manager?.full_name || <span className="text-muted-foreground italic">Sem gerente</span>}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-semibold tabular-nums" style={{ fontFamily: "'Rajdhani', sans-serif" }}>{getProjectFleet(p) || "—"}</td>
                              <td className="py-2.5 px-3 text-muted-foreground">{format(parseISO(p.contract_date), "dd/MM/yyyy")}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-wrap gap-1">
                                  {p.project_solutions?.map((ps, j) => (
                                    <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0">{ps.solution?.name}</Badge>
                                  ))}
                                  {(!p.project_solutions || p.project_solutions.length === 0) && <span className="text-xs text-muted-foreground">—</span>}
                                </div>
                              </td>
                              <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px]">
                                      <CalendarClock className="h-3 w-3" />
                                      Cronograma
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-4" align="end">
                                    <ProjectTimeline status={p.status} companyName={p.company_name} />
                                  </PopoverContent>
                                </Popover>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </GlowCard>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Chart Panels - Drag and Drop reorderable */}
      {isCustomOrder && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetChartOrder} className="h-7 text-xs gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3 w-3" /> Resetar ordem
          </Button>
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-6">
        {chartOrder.map((chartId) => {
          const isDragging = draggedChart === chartId;
          const isDragOver = dragOverChart === chartId;
          const dragProps = {
            draggable: true,
            onDragStart: (e: React.DragEvent) => handleDragStart(e, chartId),
            onDragOver: (e: React.DragEvent) => handleDragOver(e, chartId),
            onDragLeave: handleDragLeave,
            onDrop: (e: React.DragEvent) => handleDrop(e, chartId),
            onDragEnd: handleDragEnd,
          };
          const dragStyle = `${isDragging ? "opacity-40 scale-95" : ""} ${isDragOver ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background" : ""}`;

          const gripHandle = (
            <div className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors" onMouseDown={(e) => e.stopPropagation()}>
              <GripVertical className="h-4 w-4" />
            </div>
          );

          if (chartId === "status") return (
            <div key={chartId} {...dragProps} className={`transition-all duration-200 h-[420px] ${dragStyle}`}>
              <GlowCard delay={0.15} className={`cursor-pointer transition-all h-full ${expandedSection === "status-chart" ? "ring-2 ring-primary/50" : ""}`}>
                <div className="p-6 h-full flex flex-col" onClick={() => toggleSection("status-chart")}>
                  <div className="flex items-center gap-2 mb-5">
                    {gripHandle}
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Status dos Projetos</h3>
                  </div>
                  <div className="flex items-center gap-8 flex-1 min-h-0 min-w-0">
                    <ChartContainer config={genericConfig} className="h-full min-h-[280px] w-full flex-1 min-w-0 !aspect-auto">
                      <PieChart>
                        <Pie data={statusData.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={5} dataKey="value" nameKey="name" strokeWidth={0} animationBegin={200} animationDuration={1000}>
                          {statusData.filter(d => d.value > 0).map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                    <div className="flex flex-col gap-3 min-w-[140px] shrink-0">
                      {statusData.filter(d => d.value > 0).map((d, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1 }} className="flex items-center gap-2.5">
                          <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: d.fill }} />
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground leading-none">{d.name}</p>
                            <p className="text-sm font-bold mt-0.5">{d.value}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </GlowCard>
            </div>
          );

          if (chartId === "solucoes") return (
            <div key={chartId} {...dragProps} className={`transition-all duration-200 h-[420px] ${dragStyle}`}>
              <GlowCard delay={0.2} className={`cursor-pointer transition-all h-full ${expandedSection === "solucoes-chart" ? "ring-2 ring-primary/50" : ""}`}>
                <div className="p-6 h-full flex flex-col" onClick={() => toggleSection("solucoes-chart")}>
                  <div className="flex items-center gap-2 mb-5">
                    {gripHandle}
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Soluções</h3>
                  </div>
                  <div className="flex items-center gap-8 flex-1 min-h-0 min-w-0">
                    <ChartContainer config={genericConfig} className="h-full min-h-[280px] w-full flex-1 min-w-0 !aspect-auto">
                      <PieChart>
                        <Pie data={solutionData} cx="50%" cy="50%" innerRadius={45} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name" strokeWidth={0} animationBegin={400} animationDuration={1000}>
                          {solutionData.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                    <div className="flex flex-col gap-2.5 min-w-[120px] max-h-full shrink-0 overflow-auto">
                      {solutionData.map((d, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.1 }} className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                          <span className="text-xs text-muted-foreground truncate">{d.name}</span>
                          <span className="text-xs font-bold ml-auto">{d.value}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </GlowCard>
            </div>
          );

          if (chartId === "frota") return (
            <div key={chartId} {...dragProps} className={`transition-all duration-200 h-[420px] ${dragStyle}`}>
              <GlowCard glow delay={0.25} className={`cursor-pointer transition-all h-full ${expandedSection === "frota-chart" ? "ring-2 ring-primary/50" : ""}`}>
                <div className="p-6 h-full flex flex-col" onClick={() => toggleSection("frota-chart")}>
                  <div className="flex items-center gap-2 mb-5">
                    {gripHandle}
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Evolução da Frota</h3>
                  </div>
                  <ChartContainer config={fleetConfig} className="flex-1 min-h-[280px] w-full min-w-0 !aspect-auto">
                    <AreaChart data={fleetTimelineData}>
                      <defs>
                        <linearGradient id="gFleet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(28 90% 52%)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(28 90% 52%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area type="monotone" dataKey="frota" stroke="hsl(28 90% 52%)" fill="url(#gFleet)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(28 90% 52%)", strokeWidth: 0 }} animationDuration={1500} />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </GlowCard>
            </div>
          );

          if (chartId === "solucao-timeline") return (
            <div key={chartId} {...dragProps} className={`transition-all duration-200 h-[420px] ${dragStyle}`}>
              <GlowCard glow delay={0.3} className={`cursor-pointer transition-all h-full ${expandedSection === "solucao-timeline" ? "ring-2 ring-primary/50" : ""}`}>
                <div className="p-6 h-full flex flex-col" onClick={() => toggleSection("solucao-timeline")}>
                  <div className="flex items-center gap-2 mb-5">
                    {gripHandle}
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Evolução por Solução</h3>
                    <div className="flex gap-3 ml-auto flex-wrap justify-end">
                      {solutionNamesForChart.map((name, i) => (
                        <div key={name} className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PRODUCT_COLORS[i % PRODUCT_COLORS.length] }} />
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ChartContainer config={solutionTimelineConfig} className="flex-1 min-h-[280px] w-full min-w-0 !aspect-auto">
                    <AreaChart data={solutionTimelineData}>
                      <defs>
                        {solutionNamesForChart.map((name, i) => (
                          <linearGradient key={name} id={`gSol${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={PRODUCT_COLORS[i % PRODUCT_COLORS.length]} stopOpacity={0.25} />
                            <stop offset="100%" stopColor={PRODUCT_COLORS[i % PRODUCT_COLORS.length]} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {solutionNamesForChart.map((name, i) => (
                        <Area key={name} type="monotone" dataKey={name} stroke={PRODUCT_COLORS[i % PRODUCT_COLORS.length]} fill={`url(#gSol${i})`} strokeWidth={2} dot={{ r: 3, fill: PRODUCT_COLORS[i % PRODUCT_COLORS.length], strokeWidth: 0 }} animationDuration={1500} animationBegin={300 + i * 200} />
                      ))}
                    </AreaChart>
                  </ChartContainer>
                </div>
              </GlowCard>
            </div>
          );

          if (chartId === "estado") return (
            <div key={chartId} {...dragProps} className={`transition-all duration-200 h-[420px] ${dragStyle}`}>
              <GlowCard delay={0.35} className={`cursor-pointer transition-all h-full ${expandedSection === "estado-chart" ? "ring-2 ring-primary/50" : ""}`}>
                <div className="p-6 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-5">
                    {gripHandle}
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Projetos por Estado</h3>
                    {selectedBarState && <Badge variant="secondary" className="text-xs ml-2">{selectedBarState}</Badge>}
                  </div>
                  <ChartContainer config={genericConfig} className="flex-1 min-h-[280px] w-full min-w-0 !aspect-auto">
                    <BarChart data={stateData} barCategoryGap="25%" onClick={(data) => {
                      if (data?.activePayload?.[0]?.payload?.state) {
                        const clickedState = data.activePayload[0].payload.state;
                        const newState = selectedBarState === clickedState ? null : clickedState;
                        setSelectedBarState(newState);
                        setExpandedSection(newState ? "estado-chart" : null);
                      }
                    }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                      <XAxis dataKey="state" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(28 90% 52%)" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(28 90% 52%)" stopOpacity={0.5} />
                        </linearGradient>
                        <linearGradient id="barGradMuted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(28 90% 52%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(28 90% 52%)" stopOpacity={0.15} />
                        </linearGradient>
                      </defs>
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={1200} cursor="pointer">
                        {stateData.map((entry, i) => (
                          <Cell key={i} fill={!selectedBarState || selectedBarState === entry.state ? "url(#barGrad)" : "url(#barGradMuted)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              </GlowCard>
            </div>
          );

          if (chartId === "gerente") return (
            <div key={chartId} {...dragProps} className={`transition-all duration-200 h-[420px] ${dragStyle}`}>
              <GlowCard delay={0.4} className={`cursor-pointer transition-all h-full ${expandedSection === "gerente-chart" ? "ring-2 ring-primary/50" : ""}`}>
                <div className="p-6 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-5">
                    {gripHandle}
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Projetos por Gerente</h3>
                    {selectedBarManager && <Badge variant="secondary" className="text-xs ml-2">{selectedBarManager}</Badge>}
                  </div>
                  <ChartContainer config={genericConfig} className="flex-1 min-h-[280px] w-full min-w-0 !aspect-auto">
                    <BarChart data={managerData} barCategoryGap="30%" onClick={(data) => {
                      if (data?.activePayload?.[0]?.payload?.name) {
                        const clickedManager = data.activePayload[0].payload.name;
                        const newManager = selectedBarManager === clickedManager ? null : clickedManager;
                        setSelectedBarManager(newManager);
                        setExpandedSection(newManager ? "gerente-chart" : null);
                      }
                    }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={80}
                        tickMargin={8}
                        tickFormatter={(v: string) => {
                          const parts = String(v).split(" ").filter(Boolean);
                          const short = parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : String(v);
                          return short.length > 18 ? `${short.slice(0, 17)}…` : short;
                        }}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={1200} cursor="pointer">
                        {managerData.map((entry, i) => (
                          <Cell key={i} fill={!selectedBarManager || selectedBarManager === entry.name ? PRODUCT_COLORS[i % PRODUCT_COLORS.length] : `${PRODUCT_COLORS[i % PRODUCT_COLORS.length]}40`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              </GlowCard>
            </div>
          );

          return null;
        })}
      </div>

      {/* Expandable tables for charts */}
      <ExpandableProjectTable sectionKey="status-chart" title="Projetos por Status" projectList={filteredProjects} />
      <ExpandableProjectTable sectionKey="solucoes-chart" title="Projetos por Solução" projectList={filteredProjects} />
      <ExpandableProjectTable sectionKey="frota-chart" title="Projetos com Frota" projectList={filteredProjects.filter(p => getProjectFleet(p) > 0)} />
      <ExpandableProjectTable sectionKey="solucao-timeline" title="Projetos por Solução" projectList={filteredProjects.filter(p => p.project_solutions && p.project_solutions.length > 0)} />
      <ExpandableProjectTable
        sectionKey="estado-chart"
        title={selectedBarState ? `Projetos em ${selectedBarState}` : "Projetos por Estado"}
        projectList={selectedBarState ? filteredProjects.filter(p => p.state === selectedBarState) : filteredProjects}
      />
      <ExpandableProjectTable
        sectionKey="gerente-chart"
        title={selectedBarManager ? `Projetos de ${selectedBarManager}` : "Projetos por Gerente"}
        projectList={selectedBarManager ? filteredProjects.filter(p => (p.manager?.full_name || "Sem gerente") === selectedBarManager) : filteredProjects}
      />

      {/* Detail card for single project */}
      <AnimatePresence>
        {filterProject !== "all" && filteredProjects.length === 1 && (() => {
          const p = filteredProjects[0];
          const fmtDate = (d: string | null) => d ? format(parseISO(d), "dd/MM/yyyy") : "—";
          return (
            <GlowCard glow delay={0.1}>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Ficha do Projeto</h3>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                  {[
                    { l: "Empresa", v: p.company_name },
                    { l: "Localização", v: `${p.city}/${p.state}` },
                    { l: "Status", v: statusLabels[p.status] },
                    { l: "Contrato", v: fmtDate(p.contract_date) },
                    { l: "D-Zero", v: fmtDate(p.d_zero_date) },
                    { l: "Handover", v: fmtDate(p.handover_date) },
                    { l: teamRoleLabels.manager ?? "Gerente", v: p.manager?.full_name || "—" },
                    { l: teamRoleLabels.executive ?? "Executivo", v: p.executive?.full_name || "—" },
                    { l: "Frota", v: String(getProjectFleet(p) || "—") },
                    { l: "Piloto", v: p.is_pilot ? "Sim" : "Não" },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">{item.l}</p>
                      <p className="text-sm font-semibold mt-0.5">{item.v}</p>
                    </motion.div>
                  ))}
                  <div className="sm:col-span-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-1">Soluções</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.project_solutions?.map((ps, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{ps.solution?.name}</Badge>
                      ))}
                      {(!p.project_solutions || p.project_solutions.length === 0) && <span className="text-xs text-muted-foreground">Nenhuma</span>}
                    </div>
                  </div>
                </div>
              </div>
            </GlowCard>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
