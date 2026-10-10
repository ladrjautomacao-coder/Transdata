import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectFilters } from "@/contexts/ProjectFiltersContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Search, ArrowUpDown, Trash2, Eye, Plus, CalendarClock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import { Constants } from "@/integrations/supabase/types";
import { formatLocation } from "@/lib/location";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { teamRoleLabels } from "@/lib/teamRoleLabels";

type ProjectStatus = Database["public"]["Enums"]["project_status"];
type BrazilianState = Database["public"]["Enums"]["brazilian_state"];

const statusLabels: Record<ProjectStatus, string> = {
  comercial: "Comercial",
  planejamento: "Planejamento",
  implantacao: "Implantação",
  encerrado: "Implementado",
  suspenso: "Outros",
};

const statusColors: Record<ProjectStatus, string> = {
  comercial: "bg-blue-100 text-blue-800 border-blue-300",
  planejamento: "bg-primary/15 text-primary border-primary/30",
  implantacao: "bg-amber-100 text-amber-800 border-amber-300",
  encerrado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  suspenso: "bg-red-100 text-red-800 border-red-300",
};

interface ProjectRow {
  id: string;
  company_name: string;
  city: string;
  state: BrazilianState | null;
  country_code: string | null;
  contract_date: string;
  d_zero_date: string | null;
  handover_date: string | null;
  status: ProjectStatus;
  executive: { full_name: string } | null;
  manager: { full_name: string } | null;
  project_solutions: { solution: { name: string } | null }[];
}

type SortKey = "company_name" | "city" | "contract_date" | "d_zero_date" | "handover_date" | "status";

export default function ProjectList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const { filters: globalFilters } = useProjectFilters();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(globalFilters.companyName);
  const [filterStatus, setFilterStatus] = useState(globalFilters.status);
  const [filterState, setFilterState] = useState(globalFilters.state);
  const [filterManager, setFilterManager] = useState("");
  const [filterExecutive, setFilterExecutive] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("company_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [managers, setManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [executives, setExecutives] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    supabase.from("team_members").select("id, full_name").eq("role", "gerente_projetos").eq("active", true).then(({ data }) => setManagers(data || []));
    supabase.from("team_members").select("id, full_name").eq("role", "executivo_vendas").eq("active", true).then(({ data }) => setExecutives(data || []));
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("id, company_name, city, state, country_code, contract_date, d_zero_date, handover_date, status, executive:team_members!projects_executive_id_fkey(full_name), manager:team_members!projects_manager_id_fkey(full_name), project_solutions(solution:solutions(name))")
      .order("company_name");
    setProjects((data as unknown as ProjectRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirmText !== "EXCLUIR") return;
    setDeleting(true);
    try {
      // Registros relacionados são removidos em cascata pelo banco
      // e o histórico de exclusão é gravado automaticamente por trigger.
      const { error } = await supabase.from("projects").delete().eq("id", deleteTarget.id);
      if (error) throw error;

      toast({ title: "Projeto excluído", description: `O projeto "${deleteTarget.company_name}" foi excluído com sucesso.` });
      setDeleteTarget(null);
      setDeleteConfirmText("");
      loadProjects();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const intlCountries = useMemo(
    () => Array.from(new Set(projects.map(p => p.country_code || "BR").filter(c => c !== "BR"))).sort(),
    [projects]
  );

  const filtered = useMemo(() => {
    let list = projects;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.company_name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.executive?.full_name?.toLowerCase().includes(q) ||
        p.manager?.full_name?.toLowerCase().includes(q)
      );
    }
    if (filterStatus) list = list.filter(p => p.status === filterStatus);
    if (filterState) list = filterState.startsWith("c:")
      ? list.filter(p => (p.country_code || "BR") === filterState.slice(2))
      : list.filter(p => p.state === filterState && (p.country_code || "BR") === "BR");
    if (filterManager) list = list.filter(p => p.manager?.full_name === filterManager);
    if (filterExecutive) list = list.filter(p => p.executive?.full_name === filterExecutive);

    list = [...list].sort((a, b) => {
      const av = (a as any)[sortKey] || "";
      const bv = (b as any)[sortKey] || "";
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return list;
  }, [projects, search, filterStatus, filterState, filterManager, filterExecutive, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-1">{label} <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></span>
    </TableHead>
  );

  const fmtDate = (d: string | null) => d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : "—";

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate("/projetos")} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projetos Existentes</h1>
        <Button onClick={() => navigate("/projetos/novo")}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar Projeto
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {Constants.public.Enums.project_status.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterState} onValueChange={v => setFilterState(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Constants.public.Enums.brazilian_state.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            {intlCountries.map(c => <SelectItem key={c} value={`c:${c}`}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterManager} onValueChange={v => setFilterManager(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={teamRoleLabels.manager ?? "Gerente"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Gerentes</SelectItem>
            {managers.map(m => <SelectItem key={m.id} value={m.full_name}>{m.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterExecutive} onValueChange={v => setFilterExecutive(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={teamRoleLabels.executive ?? "Executivo"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Executivos</SelectItem>
            {executives.map(e => <SelectItem key={e.id} value={e.full_name}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState type="search" title="Nenhum projeto encontrado" description="Tente ajustar os filtros ou a busca para encontrar resultados." />
      ) : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Empresa" field="company_name" />
                <TableHead className="whitespace-nowrap">Cidade/Estado</TableHead>
                <TableHead className="whitespace-nowrap">{teamRoleLabels.manager ?? "Gerente"}</TableHead>
                <TableHead className="whitespace-nowrap">{teamRoleLabels.executive ?? "Executivo"}</TableHead>
                <SortHeader label="D-zero" field="d_zero_date" />
                <SortHeader label="Handover" field="handover_date" />
                <SortHeader label="Status" field="status" />
                <TableHead className="whitespace-nowrap">Soluções</TableHead>
                <TableHead className="whitespace-nowrap">Cronograma</TableHead>
                <TableHead className="whitespace-nowrap w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{p.company_name}</TableCell>
                  <TableCell>{formatLocation(p.city, p.state, p.country_code)}</TableCell>
                  <TableCell>{p.manager?.full_name || "—"}</TableCell>
                  <TableCell>{p.executive?.full_name || "—"}</TableCell>
                  <TableCell>{fmtDate(p.d_zero_date)}</TableCell>
                  <TableCell>{fmtDate(p.handover_date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[p.status]}>{statusLabels[p.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.project_solutions?.map((ps, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{ps.solution?.name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Cronograma
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4" align="end">
                        <ProjectTimeline status={p.status} companyName={p.company_name} />
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:bg-primary/10"
                        onClick={() => navigate(`/projetos/${p.id}`)}
                        title="Visualizar / Editar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => { setDeleteTarget(p); setDeleteConfirmText(""); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir Projeto</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Tem certeza que deseja excluir permanentemente o projeto <strong>{deleteTarget?.company_name}</strong> ({formatLocation(deleteTarget?.city, deleteTarget?.state, deleteTarget?.country_code)})?
              </span>
              <span className="block text-destructive font-medium">
                Esta ação não pode ser desfeita. Todos os dados relacionados (soluções, anexos e produtos) serão removidos.
              </span>
              <span className="block text-sm">
                Para confirmar, digite <strong>EXCLUIR</strong> no campo abaixo:
              </span>
              <Input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder="Digite EXCLUIR para confirmar"
                className="mt-2"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConfirmText !== "EXCLUIR" || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
