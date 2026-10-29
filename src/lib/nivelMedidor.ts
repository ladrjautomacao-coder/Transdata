// Faixas dos medidores de saúde (Gerenciamento e Grandes Operações): até 40% atenção, até 70% em
// andamento, depois quase lá; 100% tudo feito.
import { AlertTriangle, PartyPopper, TrendingUp } from "lucide-react";

export type Nivel = "atencao" | "andamento" | "quase" | "concluido";
export const nivelDe = (pct: number): Nivel => (pct >= 100 ? "concluido" : pct >= 70 ? "quase" : pct >= 40 ? "andamento" : "atencao");
export const NIVEL: Record<Nivel, { titulo: string; arco: string; faixa: string; caixa: string; icone: typeof AlertTriangle }> = {
  atencao: { titulo: "Atenção", arco: "stroke-red-500", faixa: "bg-red-500", caixa: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200", icone: AlertTriangle },
  andamento: { titulo: "Em andamento", arco: "stroke-amber-500", faixa: "bg-amber-500", caixa: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100", icone: TrendingUp },
  quase: { titulo: "Quase lá", arco: "stroke-emerald-500", faixa: "bg-emerald-500", caixa: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200", icone: TrendingUp },
  concluido: { titulo: "Tudo feito", arco: "stroke-emerald-500", faixa: "bg-emerald-500", caixa: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200", icone: PartyPopper },
};
