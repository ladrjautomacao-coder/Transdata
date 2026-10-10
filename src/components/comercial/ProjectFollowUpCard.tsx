import { formatLocation } from "@/lib/location";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bus, MapPin, UserRound, UsersRound, MessageSquareText, Clock } from "lucide-react";
import { statusLabels, subPhasesByStatus } from "@/pages/ProjectManagement";
import {
  daysSince,
  effectiveFollowUps,
  followUpReferenceDate,
  followUpLevel,
  followUpLevelStyles,
} from "@/lib/followUpNotes";
import type { FollowUpProject, ProjectStatus } from "./types";

interface Props {
  project: FollowUpProject;
  staleDays: number;
  onOpen: (project: FollowUpProject) => void;
  justUpdated?: boolean;
  isNew?: boolean;
}

const statusPill: Record<ProjectStatus, string> = {
  comercial: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  planejamento: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  implantacao: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  encerrado: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  suspenso: "bg-muted text-muted-foreground",
};

const levelBorder = {
  ok: "border-l-emerald-500",
  warn: "border-l-amber-500",
  late: "border-l-orange-500",
  critical: "border-l-destructive",
} as const;

function progressColor(pct: number) {
  if (pct >= 45) return "bg-emerald-500";
  if (pct >= 25) return "bg-amber-500";
  return "bg-red-500";
}

export function ProjectFollowUpCard({ project, staleDays, onOpen, justUpdated, isNew }: Props) {
  const notes = effectiveFollowUps(project).slice(0, 2);
  const days = daysSince(followUpReferenceDate(project)) ?? 0;
  const level = followUpLevel(days, staleDays);
  const levelStyle = followUpLevelStyles[level];
  const isStale = days > staleDays;
  const subPhaseLabel = project.sub_phase
    ? subPhasesByStatus[project.status]?.find(sp => sp.id === project.sub_phase)?.label ?? null
    : null;

  const total = project.fleet_size ?? 0;
  const done = project.implemented_fleet ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(project)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(project); } }}
      className={`relative flex cursor-pointer flex-col gap-3 rounded-xl border border-l-4 border-border/60 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${levelBorder[level]} ${justUpdated ? "ring-2 ring-primary/40" : ""}`}
    >
      {justUpdated && (
        <Badge className="absolute -top-2 right-4 bg-primary text-[10px] text-primary-foreground">Atualizado agora</Badge>
      )}

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bus className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{project.company_name}</h3>
              {isNew && <Badge className="bg-primary text-[10px] uppercase tracking-wide text-primary-foreground">Novo</Badge>}
              {project.is_pilot && <Badge variant="outline" className="text-[10px]">Piloto</Badge>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className={`rounded-md px-2.5 py-0.5 text-[11px] font-medium ${statusPill[project.status]}`}>
                {statusLabels[project.status]}
              </span>
              {subPhaseLabel && <span className="text-[10px] text-muted-foreground">{subPhaseLabel}</span>}
            </div>
          </div>

          {project.project_code && (
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase text-muted-foreground">{project.project_code}</p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{formatLocation(project.city, project.state, project.country_code)}</span>
            <span className="flex items-center gap-1"><UserRound className="h-3 w-3" />{project.manager?.full_name ?? "Sem gerente"}</span>
            <span className="flex items-center gap-1"><UsersRound className="h-3 w-3" />{project.executive?.full_name ?? "Sem executivo"}</span>
            <span className={`ml-auto flex items-center gap-1 font-medium ${levelStyle.text}`} title={`Frota implantada · ${levelStyle.label}`}>
              {level !== "ok" && <AlertTriangle className="h-3 w-3" />}
              {done} / {total || "—"}{total > 0 ? ` (${pct}%)` : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-9 text-right text-[11px] font-semibold text-muted-foreground">{pct}%</span>
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-foreground">
          <MessageSquareText className="h-3.5 w-3.5 text-primary" />
          Últimas atualizações
        </div>
        {notes.length > 0 ? (
          <ul className="space-y-2">
            {notes.map((n, i) => (
              <li key={i} className={i > 0 ? "border-t border-border/40 pt-2" : undefined}>
                <p className={`whitespace-pre-line text-xs text-foreground ${i === 0 ? "line-clamp-3" : "line-clamp-2 opacity-80"}`}>{n.text}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {n.dateLabel ?? "—"}{n.author ? ` • ${n.author}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs italic text-muted-foreground">Nenhum acompanhamento registrado pelo gerente.</p>
        )}
      </div>

      {isStale && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Sem atualização há {days} dias
        </div>
      )}
    </div>
  );
}
