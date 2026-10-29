// Endereços e cores das telas do Hub de Grandes Operações. As cores de status são as do
// sistema original: concluído verde, em andamento azul, em espera âmbar, removido cinza.
import type { GoStatus } from "@/lib/grandesOperacoes/dados";

export const GO_BASE = "/gestao-operacional/grandes-operacoes";
export const urlProjeto = (id: number) => `${GO_BASE}/projeto/${id}`;
export const urlCliente = (id: number | "todos") => `${GO_BASE}/cliente/${id}`;

export const COR_STATUS: Record<GoStatus, { dot: string; pill: string; texto: string; barra: string }> = {
  concluido: { dot: "bg-emerald-500", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", texto: "text-emerald-700 dark:text-emerald-300", barra: "bg-emerald-500" },
  andamento: { dot: "bg-sky-500", pill: "bg-sky-500/15 text-sky-700 dark:text-sky-300", texto: "text-sky-700 dark:text-sky-300", barra: "bg-sky-500" },
  espera: { dot: "bg-amber-500", pill: "bg-amber-500/15 text-amber-800 dark:text-amber-200", texto: "text-amber-800 dark:text-amber-200", barra: "bg-amber-400" },
  removido: { dot: "bg-muted-foreground/50", pill: "bg-muted text-muted-foreground line-through", texto: "text-muted-foreground", barra: "bg-muted-foreground/40" },
};

/** Destaque de uma linha: selecionada, predecessora (roxo) ou sucessora (laranja) da selecionada. */
export const destaqueLinha = (sel: boolean, pred: boolean, succ: boolean) =>
  sel ? "border-primary bg-primary/[0.07] ring-1 ring-primary"
    : pred ? "border-primary/40 bg-primary/[0.05] shadow-[inset_3px_0_0_hsl(var(--primary))]"
    : succ ? "border-orange-500/40 bg-orange-500/[0.06] shadow-[inset_3px_0_0_#f97316]"
    : "border-border/60 bg-card hover:bg-muted/50";

/** Cor de cada projeto no Gantt (a mesma sequência do original). */
export const CORES_PROJETO = ["#8e44c9", "#f26a21", "#1f8fb3", "#13a06b", "#d0453f", "#b8860b"];
