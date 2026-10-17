import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { statusLabels, subPhasesByStatus } from "@/pages/ProjectManagement";
import { effectiveFollowUps } from "@/lib/followUpNotes";
import { format } from "date-fns";
import { CalendarDays, CalendarRange, History, MessageSquareText, Layers, Plug, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { FollowUpProject, ProjectStatus } from "./types";

interface HistoryRow {
  id: string;
  change_type: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  changed_by: string | null;
}

interface Props {
  project: FollowUpProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");

export function ProjectFollowUpDrawer({ project, open, onOpenChange }: Props) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || !project) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("project_history")
        .select("id, change_type, old_values, new_values, created_at, changed_by")
        .eq("project_id", project.id)
        .eq("change_type", "status_change")
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      const rows = (data as unknown as HistoryRow[]) || [];
      setHistory(rows);

      const ids = Array.from(new Set(rows.map(r => r.changed_by).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
        if (!cancelled) {
          const map: Record<string, string> = {};
          (profs || []).forEach(p => { if (p.full_name) map[p.user_id] = p.full_name; });
          setAuthors(map);
        }
      } else {
        setAuthors({});
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, project]);

  if (!project) return null;

  const notes = effectiveFollowUps(project);
  const subPhaseLabel = project.sub_phase
    ? subPhasesByStatus[project.status]?.find(sp => sp.id === project.sub_phase)?.label ?? project.sub_phase
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full h-full max-w-full sm:max-w-xl overflow-hidden p-0"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/60 p-5 text-left">
            <SheetTitle className="text-base">{project.company_name}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
              {project.project_code && <span className="font-mono">{project.project_code}</span>}
              <span>{project.city}/{project.state}</span>
              <Badge variant="outline">{statusLabels[project.status]}</Badge>
              {subPhaseLabel && <span>{subPhaseLabel}</span>}
            </SheetDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/projetos/${project.id}`)}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir projeto
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/projetos/cronograma?projeto=${project.id}`)}
              >
                <CalendarRange className="mr-1.5 h-3.5 w-3.5" /> Cronograma e visitas
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-6 p-5">
              <section>
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" /> Linha da vida
                </h4>
                <div className="overflow-x-auto pb-2">
                  <ProjectTimeline status={project.status as ProjectStatus} companyName={project.company_name} compact />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div><p className="text-muted-foreground">Contrato</p><p className="font-medium">{fmtDate(project.contract_date)}</p></div>
                  <div><p className="text-muted-foreground">D-Zero</p><p className="font-medium">{fmtDate(project.d_zero_date)}</p></div>
                  <div><p className="text-muted-foreground">Handover</p><p className="font-medium">{fmtDate(project.handover_date)}</p></div>
                  <div><p className="text-muted-foreground">Cadastro</p><p className="font-medium">{fmtDate(project.created_at)}</p></div>
                </div>
              </section>

              <Separator />

              <section>
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <MessageSquareText className="h-3.5 w-3.5 text-primary" /> Acompanhamento ({notes.length})
                </h4>
                {notes.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">Nenhuma nota registrada.</p>
                ) : (
                  <ol className="space-y-3">
                    {notes.map((n, i) => (
                      <li key={i} className="rounded-lg border border-border/50 bg-card p-3">
                        <p className="whitespace-pre-line text-sm">{n.text}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {n.dateLabel ?? "Data não registrada"}{n.author ? ` • ${n.author}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <Separator />

              <section>
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <History className="h-3.5 w-3.5 text-primary" /> Mudanças de status
                </h4>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-sm italic text-muted-foreground">Nenhuma mudança de status registrada.</p>
                ) : (
                  <ol className="space-y-2">
                    {history.map(h => {
                      const from = h.old_values?.status as ProjectStatus | undefined;
                      const to = h.new_values?.status as ProjectStatus | undefined;
                      return (
                        <li key={h.id} className="rounded-lg border border-border/50 bg-card p-3 text-sm">
                          <p>
                            {from ? statusLabels[from] : "—"} <span className="text-muted-foreground">→</span>{" "}
                            <span className="font-medium">{to ? statusLabels[to] : "—"}</span>
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {format(new Date(h.created_at), "dd/MM/yyyy HH:mm")}
                            {h.changed_by && authors[h.changed_by] ? ` • ${authors[h.changed_by]}` : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              <Separator />

              <section className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Layers className="h-3.5 w-3.5 text-primary" /> Soluções / Escopo
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {project.project_solutions.length === 0 && <span className="text-sm italic text-muted-foreground">—</span>}
                    {project.project_solutions.map((s, i) => (
                      <Badge key={i} variant="secondary">{s.solution?.name ?? "—"}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Plug className="h-3.5 w-3.5 text-primary" /> Integrações
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {project.project_integrations.length === 0 && <span className="text-sm italic text-muted-foreground">—</span>}
                    {project.project_integrations.map((s, i) => (
                      <Badge key={i} variant="outline">{s.integration?.name ?? "—"}</Badge>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
