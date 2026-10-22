import { useNavigate } from "react-router-dom";
import { PlusCircle, RefreshCw, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCanEditProject, useProjectDsvCases } from "@/hooks/useProjectDsvCases";
import DsvCaseList from "./DsvCaseList";

/** "Visualizar Casos DSV" do Kanban: a lista dos casos do projeto, com o link para o Azure. */
export default function DsvCasesDialog({ project, onOpenChange, onChanged }: {
  project: { id: string; company_name: string; manager_id: string | null } | null;
  onOpenChange: (o: boolean) => void;
  /** Avisa o quadro para atualizar a contagem do botão. */
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const { cases, error, reload } = useProjectDsvCases(project?.id, !!project);
  const canEdit = useCanEditProject(project?.manager_id);
  if (!project) return null;
  const open = (cases ?? []).filter(c => c.status === "aberto").length;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ticket className="h-5 w-5 text-sky-600" />Casos DSV</DialogTitle>
          <DialogDescription>
            {project.company_name}{cases ? ` · ${open} aberto${open === 1 ? "" : "s"} de ${cases.length}` : ""}
          </DialogDescription>
        </DialogHeader>
        {cases === null ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
            <span className="flex-1">Não foi possível carregar os casos. {error}</span>
            <Button size="sm" variant="outline" onClick={reload}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
          </div>
        ) : (
          <DsvCaseList cases={cases} canEdit={canEdit} onChanged={() => { reload(); onChanged(); }} />
        )}
        <DialogFooter>
          {canEdit && (
            <Button variant="outline" onClick={() => navigate(`/projetos/${project.id}?aba=dsv`, { state: { from: "/projetos/gestao" } })}>
              <PlusCircle className="mr-1.5 h-4 w-4" />Inserir caso DSV no projeto
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
