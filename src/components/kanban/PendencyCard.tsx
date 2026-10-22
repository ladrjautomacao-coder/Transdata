import { useNavigate } from "react-router-dom";
import { CalendarClock, CalendarPlus, CheckCircle2, Clock, CornerDownRight, ExternalLink, MapPin, MoreHorizontal, Puzzle, Trash2, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatLocation } from "@/lib/location";
import { fmtDate } from "@/lib/deadlineAlerts";
import { PENDENCY_AGE_STYLE, PENDENCY_REASON_LABEL, pendencyAge, type ProjectPendency } from "@/lib/projectPendencies";
import type { ProjectRow } from "@/pages/ProjectManagement";

export type PendencyAction = "agenda" | "implantada" | "cancelar" | "excluir";

/**
 * Card filho: a solução que ficou pendente, ligada ao projeto pai. Não é arrastável;
 * as ações (agenda, implantada, cliente desistiu) ficam no menu.
 */
export default function PendencyCard({ pendency: x, project, canEdit, onAction }: {
  pendency: ProjectPendency;
  project: ProjectRow | undefined;
  canEdit: boolean;
  onAction: (kind: PendencyAction, pendency: ProjectPendency) => void;
}) {
  const navigate = useNavigate();
  const age = pendencyAge(x.created_at);
  const open = () => navigate(`/projetos/${x.project_id}`, { state: { from: "/projetos/gestao" } });
  // concluído: implantado (vai para Implementado) ou cliente desistiu (vai para Outros › Cancelado)
  const done = x.status === "implantada", cancelled = x.status === "cancelada";
  const closedOn = x.resolved_at ? new Date(x.resolved_at).toLocaleDateString("pt-BR") : "";
  const tone = done
    ? { border: "border-emerald-500/45", icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", link: "text-emerald-500" }
    : cancelled
      ? { border: "border-muted-foreground/30", icon: "bg-muted text-muted-foreground", link: "text-muted-foreground" }
      : { border: "border-orange-500/45", icon: "bg-orange-500/15 text-orange-600 dark:text-orange-300", link: "text-orange-500" };

  const pending = !done && !cancelled;
  return (
    <div role="button" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === "Enter") open(); }}
      className={`group relative cursor-pointer rounded-lg border-2 bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${pending ? "border-transparent" : `border-dashed ${tone.border}`} ${cancelled ? "opacity-85" : ""}`}>
      {pending && (
        // aberto: a borda tracejada "anda" para lembrar o GP de implantar (mais rápida e vermelha após 60 dias)
        // o traço fica no meio da borda de 2px: svg 1px para fora da área interna, em cada lado
        <svg aria-hidden className="pointer-events-none absolute -left-px -top-px h-[calc(100%+2px)] w-[calc(100%+2px)] overflow-visible">
          <rect width="100%" height="100%" rx="7" ry="7" fill="none" strokeWidth="2" strokeDasharray="8 4"
            className={`card-filho-ants ${age.level === "late" ? "card-filho-ants-fast stroke-red-500" : "stroke-orange-500"}`} />
        </svg>
      )}
      <div className="flex items-start gap-2">
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300" title={`Implantada em ${closedOn}`}>
            <CheckCircle2 className="h-2.5 w-2.5" />Implantada {closedOn.slice(0, 5)}
          </span>
        ) : cancelled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground" title={`Cliente desistiu em ${closedOn}`}>
            <XCircle className="h-2.5 w-2.5" />Desistiu {closedOn.slice(0, 5)}
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PENDENCY_AGE_STYLE[age.level]}`} title={`Pendente há ${age.days} dia${age.days === 1 ? "" : "s"}`}>
            <Clock className="h-2.5 w-2.5" />{age.days}d
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={project?.company_name}>
          <CornerDownRight className={`mr-0.5 inline h-3 w-3 ${tone.link}`} />{project?.company_name ?? "Projeto"}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-6 w-6 shrink-0" onClick={e => e.stopPropagation()} aria-label="Ações do card filho">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
            <DropdownMenuItem onClick={open}><ExternalLink className="mr-2 h-4 w-4" />Abrir projeto</DropdownMenuItem>
            {canEdit && x.status === "aberta" && (
              <>
                <DropdownMenuItem onClick={() => onAction("agenda", x)}><CalendarPlus className="mr-2 h-4 w-4" />Solicitar agenda</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onAction("implantada", x)} className="text-emerald-700 focus:text-emerald-700 dark:text-emerald-400 dark:focus:text-emerald-400">
                  <CheckCircle2 className="mr-2 h-4 w-4" />Marcar como implantada
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction("cancelar", x)} className="text-destructive focus:text-destructive">
                  <XCircle className="mr-2 h-4 w-4" />Cliente desistiu
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onAction("excluir", x)} className="text-muted-foreground">
                  <Trash2 className="mr-2 h-4 w-4" />Excluir (aberto por engano)
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tone.icon}`}><Puzzle className="h-4 w-4" /></span>
        <span className={`min-w-0 text-sm font-semibold leading-tight ${cancelled ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}`}>{x.title}</span>
      </div>
      {done || cancelled ? (
        x.resolution_note && <p className="mt-1.5 text-xs text-muted-foreground">"{x.resolution_note}"{x.resolved_by_name ? ` · ${x.resolved_by_name}` : ""}</p>
      ) : (
        <p className="mt-1.5 text-xs">
          <span className="font-medium text-orange-700 dark:text-orange-300">{PENDENCY_REASON_LABEL[x.reason_kind]}</span>
          {x.reason && <span className="text-muted-foreground"> · {x.reason}</span>}
        </p>
      )}

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {project && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{formatLocation(project.city, project.state, project.country_code)}</p>}
        {project?.manager?.full_name && <p className="flex items-center gap-1.5"><Users className="h-3 w-3" />{project.manager.full_name}</p>}
        {x.status === "aberta" && x.expected_date && <p className="flex items-center gap-1.5"><CalendarClock className="h-3 w-3" />Previsão de retomada: {fmtDate(x.expected_date)}</p>}
      </div>
    </div>
  );
}
