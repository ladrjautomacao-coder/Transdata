import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProjectPendency } from "@/lib/projectPendencies";
import type { ProjectRow } from "@/pages/ProjectManagement";
import PendencyCard, { type PendencyAction } from "./PendencyCard";

/** Coluna "Implantação pendente": os cards filhos em aberto (fora do arrastar e soltar). */
export default function PendencyColumn({ items, projects, canEditProject, onAction }: {
  items: ProjectPendency[];
  projects: Map<string, ProjectRow>;
  canEditProject: (p: { manager_id: string | null }) => boolean;
  onAction: (kind: PendencyAction, pendency: ProjectPendency) => void;
}) {
  return (
    <div className="flex w-[85vw] shrink-0 flex-col rounded-lg border border-orange-500/25 bg-orange-500/5 sm:w-auto sm:min-w-[260px] sm:max-w-[340px] sm:flex-1">
      <div className="flex items-center gap-2 border-b border-border/30 p-3">
        <div className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-orange-500" />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-sm font-semibold text-orange-600 dark:text-orange-400">Implantação pendente</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[280px] text-xs">
              Soluções que o cliente deixou para depois. O projeto pai segue em Implementado e o card filho fica aqui até ser implantado ou cancelado.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">{items.length}</Badge>
      </div>
      {/* conteúdo em bloco (não "table"): texto longo quebra/trunca em vez de alargar a coluna */}
      <ScrollArea className="flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
        <div className="min-h-[100px] space-y-2 p-2">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              Nenhuma pendência.<br />Use o botão <b>Card filho</b> no projeto quando uma solução ficar para depois.
            </p>
          ) : items.map(x => {
            const project = projects.get(x.project_id);
            return <PendencyCard key={x.id} pendency={x} project={project} canEdit={!!project && canEditProject(project)} onAction={onAction} />;
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
