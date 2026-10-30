import { Area, AreaChart, CartesianGrid, ReferenceDot, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { evolucaoFrota } from "@/lib/dashboard";
import { Bloco } from "./Bloco";
import { numero } from "./cores";

const config: ChartConfig = { frota: { label: "Frota acumulada", color: "hsl(var(--primary))" } };

/** Veículos contratados acumulados mês a mês, pela data de contrato, com o total de hoje marcado. */
export function EvolucaoFrota({ dados, className }: { dados: ReturnType<typeof evolucaoFrota>; className?: string }) {
  const ultimo = dados[dados.length - 1];
  const haUmAno = dados[dados.length - 13];
  const noAno = ultimo && haUmAno ? ultimo.frota - haUmAno.frota : null;
  return (
    <Bloco className={className} titulo="Evolução da frota" sub="Veículos contratados, somados mês a mês pela data de contrato."
      direita={noAno != null && <span><b className="font-semibold text-foreground">+{numero(noAno)}</b> veículos nos últimos 12 meses</span>}>
      {dados.length ? (
        <ChartContainer config={config} className="!aspect-auto h-[260px] w-full">
          <AreaChart data={dados} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dash-frota" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} interval={Math.max(0, Math.ceil(dados.length / 6) - 1)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => numero(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <ChartTooltip cursor={{ stroke: "hsl(var(--border))" }} content={<ChartTooltipContent formatter={v => <span className="font-semibold tabular-nums">{numero(Number(v))} veículos</span>} />} />
            <Area type="monotone" dataKey="frota" stroke="hsl(var(--primary))" strokeWidth={2.25} fill="url(#dash-frota)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            {ultimo && (
              <ReferenceDot x={ultimo.mes} y={ultimo.frota} r={4.5} fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth={2}
                label={{ value: numero(ultimo.frota), position: "top", offset: 10, fontSize: 12, fontWeight: 700, fill: "hsl(var(--foreground))" }} />
            )}
          </AreaChart>
        </ChartContainer>
      ) : <p className="flex h-[260px] items-center justify-center text-[13px] text-muted-foreground">Nenhum projeto com frota nestes filtros.</p>}
    </Bloco>
  );
}
