import { Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DsvCase } from "@/lib/dsvCases";
import DsvCaseForm from "./DsvCaseForm";
import DsvCaseList from "./DsvCaseList";

/** Aba "Inserir caso DSV" do projeto: cadastro (GP e administradores) e a lista dos casos. */
export default function ProjectDsvPanel({ projectId, cases, error, canEdit, onChanged }: {
  projectId: string;
  cases: DsvCase[] | null;
  error: string | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-5">
      {canEdit ? (
        <DsvCaseForm projectId={projectId} existing={cases ?? []} onCreated={onChanged} />
      ) : (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3.5 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Só o GP do projeto e os administradores registram casos DSV.
        </p>
      )}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Casos do projeto</p>
        {cases === null ? (
          <Skeleton className="h-20 rounded-lg" />
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm">
            <span className="flex-1">Não foi possível carregar os casos. {error}</span>
            <Button size="sm" variant="outline" onClick={onChanged}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
          </div>
        ) : (
          <DsvCaseList cases={cases} canEdit={canEdit} onChanged={onChanged} />
        )}
      </div>
    </div>
  );
}
