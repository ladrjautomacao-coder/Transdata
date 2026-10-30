// Cores do Dashboard: os status com as mesmas cores das colunas do Kanban (statusColors em
// ProjectManagement) e as séries dos gráficos.
import type { ProjectStatus } from "@/lib/dashboard";

export const COR_STATUS: Record<ProjectStatus, { barra: string; borda: string; pill: string }> = {
  comercial: { barra: "bg-blue-500", borda: "border-t-blue-500", pill: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  planejamento: { barra: "bg-primary", borda: "border-t-primary", pill: "bg-primary/15 text-primary" },
  implantacao: { barra: "bg-amber-500", borda: "border-t-amber-500", pill: "bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  encerrado: { barra: "bg-emerald-500", borda: "border-t-emerald-500", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  suspenso: { barra: "bg-red-500", borda: "border-t-red-500", pill: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

/** Séries em destaque nos gráficos (a cor do portal primeiro) e o cinza das demais. */
export const SERIES = ["hsl(var(--primary))", "#0ea5e9", "#10b981", "#f59e0b"];
export const SERIE_CINZA = "hsl(var(--muted-foreground) / 0.35)";

export const numero = (n: number) => n.toLocaleString("pt-BR");
