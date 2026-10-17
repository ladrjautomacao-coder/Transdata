import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProjectVisitsTimeline } from "@/components/agendamento/ProjectVisitsTimeline";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Plus, ChevronLeft, Pencil, Trash2 } from "lucide-react";

type ActivityStatus = "planejada" | "em_andamento" | "concluida";
type EffectiveStatus = ActivityStatus | "atrasada";

interface ActivityRow {
  id: string;
  project_id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: ActivityStatus;
  percent_complete: number;
  responsible_id: string | null;
  responsible: { full_name: string } | null;
}

interface ProjectRow {
  id: string;
  company_name: string;
  project_code: string | null;
}

interface Member {
  id: string;
  full_name: string;
}

const STATUS_LABEL: Record<EffectiveStatus, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
};

const BAR_CLASS: Record<EffectiveStatus, string> = {
  planejada: "border-2 border-dashed border-muted-foreground/40 bg-muted/40",
  em_andamento: "bg-primary",
  concluida: "bg-emerald-500",
  atrasada: "bg-destructive",
};

const DOT_CLASS: Record<EffectiveStatus, string> = {
  planejada: "border-2 border-dashed border-muted-foreground/50",
  em_andamento: "bg-primary",
  concluida: "bg-emerald-500",
  atrasada: "bg-destructive",
};

function toDate(d: string) {
  return new Date(d + "T00:00:00");
}

function rangeOf(dates: string[]) {
  const today = new Date();
  if (dates.length === 0) return { start: today, end: new Date(today.getTime() + 30 * 86400000) };
  const ts = dates.map(d => toDate(d).getTime());
  const start = new Date(Math.min(...ts, today.getTime()));
  const end = new Date(Math.max(...ts, today.getTime()));
  return { start, end };
}

function leftPct(date: Date, start: Date, end: Date) {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, ((date.getTime() - start.getTime()) / total) * 100));
}

function monthsBetween(start: Date, end: Date) {
  const months: { label: string; start: Date; end: Date }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    const monthStart = new Date(cur);
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    months.push({ label: cur.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), start: monthStart, end: monthEnd });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function effectiveStatus(a: { status: ActivityStatus; end_date: string }): EffectiveStatus {
  if (a.status === "concluida") return "concluida";
  if (toDate(a.end_date) < new Date()) return "atrasada";
  return a.status;
}

const emptyForm = { title: "", responsible_id: "", start_date: "", end_date: "", status: "planejada" as ActivityStatus, percent_complete: 0 };

export function CronogramaTab() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  // ?projeto=<id> (link dos e-mails de alerta e do Acompanhamento) já abre a visão do projeto
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => searchParams.get("projeto"));
  const backToOverview = () => {
    setSelectedProjectId(null);
    if (searchParams.has("projeto")) setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete("projeto"); return next; }, { replace: true });
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: projData }, { data: actData }, { data: memberData }] = await Promise.all([
      supabase.from("projects").select("id, company_name, project_code").order("company_name"),
      (supabase as any)
        .from("project_activities")
        .select("id, project_id, title, start_date, end_date, status, percent_complete, responsible_id, responsible:team_members(full_name)")
        .order("start_date"),
      supabase.from("team_members").select("id, full_name").eq("active", true).order("full_name"),
    ]);
    setProjects((projData as any) || []);
    setActivities((actData as any) || []);
    setMembers((memberData as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activitiesByProject = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    activities.forEach(a => {
      const list = map.get(a.project_id) ?? [];
      list.push(a);
      map.set(a.project_id, list);
    });
    return map;
  }, [activities]);

  const projectSummaries = useMemo(() => {
    return projects
      .map(p => {
        const acts = activitiesByProject.get(p.id) ?? [];
        if (acts.length === 0) return null;
        const avgPct = Math.round(acts.reduce((s, a) => s + a.percent_complete, 0) / acts.length);
        const statuses = acts.map(effectiveStatus);
        const status: EffectiveStatus = statuses.includes("atrasada")
          ? "atrasada"
          : acts.every(a => a.status === "concluida")
          ? "concluida"
          : statuses.includes("em_andamento")
          ? "em_andamento"
          : "planejada";
        const dates = acts.flatMap(a => [a.start_date, a.end_date]);
        return { project: p, avgPct, status, dates, count: acts.length };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [projects, activitiesByProject]);

  const overviewRange = useMemo(() => rangeOf(projectSummaries.flatMap(s => s.dates)), [projectSummaries]);
  const overviewMonths = useMemo(() => monthsBetween(overviewRange.start, overviewRange.end), [overviewRange]);
  const todayLeftOverview = leftPct(new Date(), overviewRange.start, overviewRange.end);

  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null;
  const selectedActivities = selectedProjectId ? activitiesByProject.get(selectedProjectId) ?? [] : [];
  const projectRange = useMemo(
    () => rangeOf(selectedActivities.flatMap(a => [a.start_date, a.end_date])),
    [selectedActivities],
  );
  const projectMonths = useMemo(() => monthsBetween(projectRange.start, projectRange.end), [projectRange]);
  const todayLeftProject = leftPct(new Date(), projectRange.start, projectRange.end);
  const selectedSummary = selectedProjectId ? projectSummaries.find(s => s.project.id === selectedProjectId) : null;

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (a: ActivityRow) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      responsible_id: a.responsible_id ?? "",
      start_date: a.start_date,
      end_date: a.end_date,
      status: a.status,
      percent_complete: a.percent_complete,
    });
    setDialogOpen(true);
  };

  const setStatus = (status: ActivityStatus) => {
    setForm(f => ({
      ...f,
      status,
      percent_complete: status === "planejada" ? 0 : status === "concluida" ? 100 : f.percent_complete,
    }));
  };

  const handleSave = async () => {
    if (!selectedProjectId) return;
    if (!form.title.trim() || !form.start_date || !form.end_date) {
      toast.error("Preencha nome, data início e data fim");
      return;
    }
    if (form.end_date < form.start_date) {
      toast.error("Data fim não pode ser antes da data início");
      return;
    }
    setSaving(true);
    const payload = {
      project_id: selectedProjectId,
      title: form.title.trim(),
      responsible_id: form.responsible_id || null,
      start_date: form.start_date,
      end_date: form.end_date,
      status: form.status,
      percent_complete: form.percent_complete,
    };
    const { error } = editingId
      ? await (supabase as any).from("project_activities").update(payload).eq("id", editingId)
      : await (supabase as any).from("project_activities").insert({ ...payload, created_by: user?.id });
    if (error) {
      toast.error("Erro ao salvar atividade", { description: error.message });
    } else {
      toast.success(editingId ? "Atividade atualizada" : "Atividade criada");
      setDialogOpen(false);
      load();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir esta atividade?")) return;
    const { error } = await (supabase as any).from("project_activities").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir", { description: error.message });
    else { toast.success("Atividade excluída"); load(); }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  // ---------- Visão por projeto ----------
  if (selectedProjectId && selectedProject) {
    return (
      <div className="space-y-4">
        <button onClick={backToOverview} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Voltar para visão geral
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{selectedProject.company_name}</h2>
              {selectedSummary && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {STATUS_LABEL[selectedSummary.status]}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedActivities.length} atividade{selectedActivities.length !== 1 ? "s" : ""}
              {selectedSummary && <> · {selectedSummary.avgPct}% concluído</>}
            </p>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova Atividade
          </Button>
        </div>

        {selectedActivities.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            Nenhuma etapa cadastrada. Use <b className="text-foreground">Nova Atividade</b> para montar o cronograma deste projeto.
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="relative flex">
              <div className="w-[240px] shrink-0 border-r bg-muted/30 p-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Atividade
              </div>
              <div className="flex flex-1">
                {projectMonths.map(m => (
                  <div key={m.label + m.start.toISOString()} className="flex-1 border-r p-3 text-center text-xs font-semibold text-muted-foreground last:border-r-0">
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div
                className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-dashed border-amber-500"
                style={{ left: `calc(240px + (100% - 240px) * ${todayLeftProject / 100})` }}
                title="Hoje"
              />
              {selectedActivities.map(a => {
                const st = effectiveStatus(a);
                const left = leftPct(toDate(a.start_date), projectRange.start, projectRange.end);
                const right = leftPct(toDate(a.end_date), projectRange.start, projectRange.end);
                return (
                  <div key={a.id} className="flex border-t">
                    <div className="w-[240px] shrink-0 border-r p-3">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.responsible?.full_name ?? "Sem responsável"}</p>
                    </div>
                    <div className="relative flex-1 py-3">
                      <div
                        className={`group absolute top-1/2 flex h-6 -translate-y-1/2 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-white ${BAR_CLASS[st]}`}
                        style={{ left: `${left}%`, width: `${Math.max(right - left, 3)}%` }}
                      >
                        {st !== "planejada" && <span>{a.percent_complete}%</span>}
                      </div>
                      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100">
                        <button onClick={() => openEdit(a)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(a.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <ProjectVisitsTimeline projectId={selectedProjectId} />

        <ActivityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          form={form}
          setForm={setForm}
          setStatus={setStatus}
          members={members}
          saving={saving}
          isEditing={!!editingId}
          onSave={handleSave}
        />
      </div>
    );
  }

  // ---------- Visão geral (todos os projetos) ----------
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Cronograma</h2>
          <p className="text-xs text-muted-foreground">
            Visualize o prazo dos projetos com atividades cadastradas. Clique em um projeto para ver e gerenciar as etapas dele.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {(["planejada", "em_andamento", "atrasada", "concluida"] as EffectiveStatus[]).map(s => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${DOT_CLASS[s]}`} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      {projectSummaries.length === 0 ? (
        <EmptyState
          type="projects"
          title="Nenhum projeto com atividades ainda"
          description="Abra um projeto e cadastre a primeira atividade para ele aparecer aqui."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex border-b bg-muted/30">
            <div className="w-[240px] shrink-0 border-r p-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Projeto
            </div>
            <div className="flex flex-1">
              {overviewMonths.map(m => (
                <div key={m.label + m.start.toISOString()} className="flex-1 border-r p-3 text-center text-xs font-semibold text-muted-foreground last:border-r-0">
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div
              className="pointer-events-none absolute top-0 bottom-0 border-l-2 border-dashed border-amber-500"
              style={{ left: `calc(240px + (100% - 240px) * ${todayLeftOverview / 100})` }}
              title="Hoje"
            />
            {projectSummaries.map(s => {
              const [minD, maxD] = [s.dates.reduce((a, b) => (a < b ? a : b)), s.dates.reduce((a, b) => (a > b ? a : b))];
              const left = leftPct(toDate(minD), overviewRange.start, overviewRange.end);
              const right = leftPct(toDate(maxD), overviewRange.start, overviewRange.end);
              return (
                <button
                  key={s.project.id}
                  onClick={() => setSelectedProjectId(s.project.id)}
                  className="flex w-full border-t text-left transition-colors hover:bg-muted/40"
                >
                  <div className="w-[240px] shrink-0 border-r p-3">
                    <p className="text-sm font-semibold">{s.project.company_name}</p>
                    <p className="text-xs text-muted-foreground">{s.count} atividade{s.count !== 1 ? "s" : ""} · {s.project.project_code ?? ""}</p>
                  </div>
                  <div className="relative flex-1 py-3">
                    <div
                      className={`absolute top-1/2 flex h-6 -translate-y-1/2 items-center justify-center rounded-md px-2 text-[11px] font-semibold text-white ${BAR_CLASS[s.status]}`}
                      style={{ left: `${left}%`, width: `${Math.max(right - left, 3)}%` }}
                    >
                      {s.status !== "planejada" && <span>{s.avgPct}%</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function ActivityDialog({
  open, onOpenChange, form, setForm, setStatus, members, saving, isEditing, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  setStatus: (s: ActivityStatus) => void;
  members: Member[];
  saving: boolean;
  isEditing: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Atividade" : "Nova Atividade"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da atividade *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={150} />
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={form.responsible_id || "none"} onValueChange={v => setForm(f => ({ ...f, responsible_id: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data início *</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Data fim *</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex gap-1 rounded-md bg-muted p-1">
              {(["planejada", "em_andamento", "concluida"] as ActivityStatus[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 rounded-sm px-2 py-1.5 text-xs font-semibold transition-colors ${form.status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>% de conclusão</Label>
              <span className="text-xs font-semibold text-muted-foreground">{form.percent_complete}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={form.percent_complete}
              disabled={form.status !== "em_andamento"}
              onChange={e => setForm(f => ({ ...f, percent_complete: Number(e.target.value) }))}
              className="w-full accent-primary disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">
              Preenchido automaticamente pelo status; ajustável manualmente enquanto "Em andamento".
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Salvar atividade"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
