import { useMemo } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { statusLabels, statusColors, statusDescriptions, type SubPhaseConfig, type ProjectRow } from "@/pages/ProjectManagement";
import type { Database } from "@/integrations/supabase/types";
import KanbanCard from "./KanbanCard";

type ProjectStatus = Database["public"]["Enums"]["project_status"];

interface Props {
  status: ProjectStatus;
  items: ProjectRow[];
  subPhases: SubPhaseConfig[] | null;
  onUpdateObservations: (projectId: string, text: string) => Promise<void>;
  canEditProject: (p: { manager_id: string | null }) => boolean;
  /** Cards filhos em aberto por projeto (selo no card pai). */
  pendencyCount?: Map<string, number>;
  /** Criar card filho (só nas colunas Implantação e Implementado). */
  onCreateChild?: (p: ProjectRow) => void;
  /** Projeto em Implantação com card filho aberto: atalho para finalizar. */
  onMoveToImplemented?: (p: ProjectRow) => void;
}

export default function KanbanColumn({ status, items, subPhases, onUpdateObservations, canEditProject, pendencyCount, onCreateChild, onMoveToImplemented }: Props) {
  const colors = statusColors[status];
  const allowChild = status === "implantacao" || status === "encerrado";
  const card = (p: ProjectRow, index: number) => (
    <KanbanCard key={p.id} project={p} index={index} onUpdateObservations={onUpdateObservations} canEdit={canEditProject(p)}
      pendencies={pendencyCount?.get(p.id) ?? 0} onCreateChild={allowChild && onCreateChild ? () => onCreateChild(p) : undefined}
      onMoveToImplemented={status === "implantacao" && onMoveToImplemented ? () => onMoveToImplemented(p) : undefined} />
  );

  const groupedBySubPhase = useMemo(() => {
    if (!subPhases) return null;
    const map: Record<string, ProjectRow[]> = {};
    subPhases.forEach(sp => { map[sp.id] = []; });
    items.forEach(p => {
      const key = p.sub_phase && map[p.sub_phase] ? p.sub_phase : subPhases[0].id;
      map[key].push(p);
    });
    return map;
  }, [items, subPhases]);

  return (
    <div className={`shrink-0 w-[85vw] sm:w-auto sm:flex-1 sm:min-w-[260px] sm:max-w-[340px] flex flex-col rounded-lg border ${colors.border} ${colors.bg}`}>
      {/* Column header */}
      <div className="flex items-center gap-2 p-3 border-b border-border/30">
        <div className={`h-2.5 w-2.5 rounded-full ${colors.accent}`} />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`text-sm font-semibold ${colors.text} ${statusDescriptions[status] ? "cursor-help" : ""}`}>{statusLabels[status]}</span>
            </TooltipTrigger>
            {statusDescriptions[status] && (
              <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                {statusDescriptions[status]}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">{items.length}</Badge>
      </div>

      <ScrollArea className="flex-1">
        {subPhases && groupedBySubPhase ? (
          <div className="flex flex-col">
            {subPhases.map((sp) => {
              const spItems = groupedBySubPhase[sp.id];
              const droppableId = `${status}::${sp.id}`;
              return (
                <div key={sp.id}>
                  {/* Sub-phase header */}
                  <div className="px-3 pt-3 pb-1.5 flex items-center gap-2">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs font-bold text-foreground/70 tracking-wide truncate cursor-help">
                            {sp.label}
                          </span>
                        </TooltipTrigger>
                        {sp.description && (
                          <TooltipContent side="right" className="max-w-[260px] text-xs">
                            {sp.description}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    {spItems.length > 0 && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1 ml-auto shrink-0">{spItems.length}</Badge>
                    )}
                  </div>
                  <Droppable droppableId={droppableId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`px-2 pb-1 min-h-[48px] transition-colors rounded-md mx-1 ${snapshot.isDraggingOver ? "bg-primary/10" : ""}`}
                      >
                        <div className="space-y-2">
                          {spItems.map((p, index) => (
                            card(p, index)
                          ))}
                        </div>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  <div className="mx-3 border-b border-border/20 last:border-0" />
                </div>
              );
            })}
          </div>
        ) : (
          <Droppable droppableId={status}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`p-2 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? "bg-primary/5" : ""}`}
              >
                <div className="space-y-2">
                  {items.length === 0 && !snapshot.isDraggingOver ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhum projeto</p>
                  ) : (
                    items.map((p, index) => (
                      card(p, index)
                    ))
                  )}
                </div>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        )}
      </ScrollArea>
    </div>
  );
}
