import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyBlock } from "@/components/agendamento/AgendaShared";
import { URL_GESTAO_OPERACIONAL, areaOperacional } from "@/lib/gestaoOperacional";

/**
 * Uma área da Gestão Operacional (Operações, Grandes Operações), aberta pelo quadrante. Os
 * processos trazidos do sistema atual entram aqui conforme forem migrados.
 */
export default function AreaOperacional() {
  const { area: id } = useParams();
  const navigate = useNavigate();
  const area = areaOperacional(id);
  if (!area) return <Navigate to={URL_GESTAO_OPERACIONAL} replace />;

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" size="sm" className="-ml-2 h-8 w-fit text-muted-foreground" onClick={() => navigate(URL_GESTAO_OPERACIONAL)}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />Gestão Operacional
      </Button>
      {/* Header */}
      <div className="-mt-2 flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><area.icon className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Gestão Operacional</span>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">Em desenvolvimento · só Super Admin</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{area.titulo}</h1>
            <p className="text-sm text-muted-foreground">{area.descricao}.</p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-border/60 bg-card shadow-sm">
        <EmptyBlock icon={PackageOpen} title="Em preparação"
          text={`Os processos de ${area.titulo} que hoje rodam no sistema atual vão ser trazidos para cá, um a um.`} />
      </section>
    </div>
  );
}
