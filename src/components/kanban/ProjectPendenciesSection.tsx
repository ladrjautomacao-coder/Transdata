import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CornerDownRight, Puzzle, RefreshCw, Trash2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/deadlineAlerts";
import { errorMessage } from "@/lib/implantationScheduling";
import {
  PENDENCY_AGE_STYLE, PENDENCY_REASON_LABEL, PENDENCY_STATUS_LABEL, fetchProjectPendencies, pendencyAge,
  type ProjectPendency,
} from "@/lib/projectPendencies";
import PendencyDialog, { type PendencyDialogMode } from "./PendencyDialog";

const fmtDT = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/**
 * Detalhe do projeto: cards filhos (soluções que o cliente deixou para depois),
 * os abertos com as ações e o histórico dos encerrados.
 */
export default function ProjectPendenciesSection({ project, onProjectChanged }: {
  project: { id: string; company_name: string; status: string; manager_id: string | null; reached_implemented: boolean; solutions: { id: string; name: string }[] };
  /** Recarrega a página depois de mover o projeto para Implementado. */
  onProjectChanged: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [list, setList] = useState<ProjectPendency[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myManagerId, setMyManagerId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<PendencyDialogMode | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchProjectPendencies(project.id).then(setList).catch(e => { setError(errorMessage(e)); setList([]); });
  }, [project.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_my_manager_id").then(({ data }) => setMyManagerId((data as string | null) ?? null));
  }, [user]);

  // mesma regra de quem move o card no Kanban (o banco confere de novo)
  const canEdit = isAdmin || (!!myManagerId && myManagerId === project.manager_id);
  const open = (list ?? []).filter(p => p.status === "aberta");
  const closed = (list ?? []).filter(p => p.status !== "aberta");

  const moveParent = async (projectId: string) => {
    const nowIso = new Date().toISOString();
    const { error: err } = await supabase.from("projects").update({
      status: "encerrado", sub_phase: null,
      ...(project.reached_implemented ? {} : { reached_implemented: true, reached_implemented_at: nowIso }),
    }).eq("id", projectId);
    if (err) { toast.error("Não foi possível mover o projeto", { description: errorMessage(err) }); return false; }
    toast.success("Projeto movido para Implementado");
    onProjectChanged();
    return true;
  };

  return (
    <Card className="mb-6 border-orange-500/30">
      <CardHeader className="flex flex-row flex-wrap items-start gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2 text-lg"><CornerDownRight className="h-5 w-5 text-orange-500" />Implantação pendente</CardTitle>
          <CardDescription>Soluções que o cliente deixou para depois. O projeto pode ficar em Implementado enquanto o card filho estiver aberto.</CardDescription>
        </div>
        {canEdit && (project.status === "implantacao" || project.status === "encerrado") && (
          <Button size="sm" variant="outline" className="border-orange-500/40 text-orange-700 hover:bg-orange-500/10 dark:text-orange-300"
            onClick={() => setDialog({
              kind: "criar", project: { id: project.id, company_name: project.company_name, status: project.status, solutions: project.solutions },
              openTitles: open.map(p => p.title),
            })}>
            <CornerDownRight className="mr-1.5 h-4 w-4" />Card filho
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {list === null ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
            <span className="flex-1">Não foi possível carregar os cards filhos. {error}</span>
            <Button size="sm" variant="outline" onClick={load}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum card filho. Use quando o cliente deixar uma solução contratada para depois.</p>
        ) : (
          <>
            {canEdit && project.status === "implantacao" && open.length > 0 && (
              // o objetivo do card filho: liberar o projeto para Implementado
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="min-w-0 flex-1 text-sm">
                  <b>O que faltou já está {open.length === 1 ? "no card filho" : `em ${open.length} cards filhos`}.</b> Mova o projeto para Implementado: ele conta como finalizado e as pendências continuam à vista.
                </p>
                <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => void moveParent(project.id)}>Mover para Implementado</Button>
              </div>
            )}
            {open.length > 0 && (
              <ul className="grid gap-3 md:grid-cols-2">
                {open.map(x => {
                  const age = pendencyAge(x.created_at);
                  return (
                    <li key={x.id} className="flex flex-col gap-2 rounded-lg border-2 border-dashed border-orange-500/45 p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-300"><Puzzle className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1 font-semibold">{x.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PENDENCY_AGE_STYLE[age.level]}`}>há {age.days} dia{age.days === 1 ? "" : "s"}</span>
                      </div>
                      <p className="text-sm"><span className="font-medium text-orange-700 dark:text-orange-300">{PENDENCY_REASON_LABEL[x.reason_kind]}</span>{x.reason && <span className="text-muted-foreground"> · {x.reason}</span>}</p>
                      <p className="text-xs text-muted-foreground">
                        Aberto em {fmtDT(x.created_at)}{x.created_by_name ? ` por ${x.created_by_name}` : ""}{x.expected_date ? ` · previsão de retomada ${fmtDate(x.expected_date)}` : ""}
                      </p>
                      {canEdit && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button size="sm" className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-500"
                            onClick={() => setDialog({ kind: "implantada", pendency: x, projectName: project.company_name })}>
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Marcar como implantada
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 border-destructive/40 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDialog({ kind: "cancelar", pendency: x, projectName: project.company_name })}>
                            <XCircle className="mr-1.5 h-3.5 w-3.5" />Cliente desistiu
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" title="Card filho aberto por engano"
                            onClick={() => setDialog({ kind: "excluir", pendency: x, projectName: project.company_name })}>
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {closed.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Histórico</p>
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                  {closed.map(x => (
                    <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${x.status === "implantada" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                        {PENDENCY_STATUS_LABEL[x.status]}
                      </span>
                      <span className="font-medium">{x.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDT(x.created_at)} → {x.resolved_at ? fmtDT(x.resolved_at) : "—"}{x.resolved_by_name ? ` · ${x.resolved_by_name}` : ""}
                      </span>
                      {x.resolution_note && <span className="basis-full text-xs text-muted-foreground">"{x.resolution_note}"</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
      <PendencyDialog mode={dialog} onOpenChange={o => { if (!o) setDialog(null); }} onDone={load}
        onMoveParent={project.status === "encerrado" ? undefined : moveParent} />
    </Card>
  );
}
