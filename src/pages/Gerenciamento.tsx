import { useSearchParams } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { ProjectPicker } from "@/components/gerenciamento/ProjectPicker";
import { ProjectWorkspace } from "@/components/gerenciamento/ProjectWorkspace";

/**
 * Gerenciamento (em desenvolvimento, só Super Admin): primeiro o GP escolhe o projeto,
 * depois trabalha nos módulos de gerenciamento daquele projeto (?projeto=<id>).
 */
export default function Gerenciamento() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("projeto");

  if (projectId) return <ProjectWorkspace key={projectId} id={projectId} onBack={() => setParams({})} />;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Gestão de Projetos</span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">Em desenvolvimento · só Super Admin</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Gerenciamento</h1>
          <p className="text-sm text-muted-foreground">Escolha o projeto para abrir os módulos de gerenciamento: as rotinas do GP, do cadastro à entrega.</p>
        </div>
      </div>

      <section className="flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-sm sm:p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15"><ListChecks className="h-6 w-6" /></span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold sm:text-xl">Tudo do projeto num só lugar</h2>
          <p className="max-w-2xl text-sm opacity-85">Os controles que hoje ficam em planilhas de cada GP (checklists, atas, cronogramas) passam a ficar no projeto, organizados em módulos.</p>
        </div>
      </section>

      <ProjectPicker onPick={id => setParams({ projeto: id })} />
    </div>
  );
}
