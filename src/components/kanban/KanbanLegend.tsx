import { useSettings } from "@/contexts/SettingsContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function KanbanLegend({ className }: { className?: string }) {
  const { settings } = useSettings();
  const g = settings.slaGreenMaxDays;
  const y = settings.slaYellowMaxDays;
  const o = settings.slaOrangeMaxDays;

  const items = [
    { color: "bg-emerald-500", label: "Em dia", range: `até ${g} dias` },
    { color: "bg-yellow-500", label: "Atenção", range: `${g + 1} a ${y} dias` },
    { color: "bg-orange-500", label: "Atrasado", range: `${y + 1} a ${o} dias` },
    { color: "bg-red-500", label: "Crítico", range: `mais de ${o} dias` },
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Sem atualização
      </span>
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
          <span className="text-xs font-medium text-foreground">{item.label}</span>
          <span className="text-xs text-muted-foreground">({item.range})</span>
        </div>
      ))}
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Sobre a legenda de cores">
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[260px] text-xs">
            A cor indica há quantos dias o projeto está sem um novo registro no
            Acompanhamento do Projeto. Projetos sem nenhum registro aparecem em vermelho.
            Não se aplica a cards em "Implementado" e "Outros".
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
