import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { evolucaoSolucoes } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { Bloco } from "./Bloco";
import { SERIES, SERIE_CINZA, numero } from "./cores";

type Dados = ReturnType<typeof evolucaoSolucoes>;

/** Dica do gráfico: as soluções daquele mês, da maior para a menor frota. */
function Dica({ active, payload, label, cores }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; cores: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  const itens = payload.filter(p => p.value > 0).sort((a, b) => b.value - a.value);
  return (
    <div className="min-w-[180px] rounded-lg border border-border/60 bg-background px-3 py-2 text-[12px] shadow-xl">
      <p className="mb-1 font-semibold">{label}</p>
      {itens.length ? itens.map(p => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: cores[p.dataKey] }} />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.dataKey}</span>
          <b className="tabular-nums">{numero(p.value)}</b>
        </p>
      )) : <p className="text-muted-foreground">Sem frota ainda</p>}
    </div>
  );
}

/**
 * Frota acumulada por solução: as 4 maiores em cor, com o nome e o total ao lado, e as outras em
 * cinza. Passar o mouse num nome destaca a linha dela.
 */
export function EvolucaoSolucoes({ dados, className }: { dados: Dados; className?: string }) {
  const [foco, setFoco] = useState<string | null>(null);
  const cores: Record<string, string> = Object.fromEntries([
    ...dados.destaques.map((d, i) => [d.nome, SERIES[i % SERIES.length]]),
    ...dados.outras.map(d => [d.nome, SERIE_CINZA]),
  ]);
  const config: ChartConfig = Object.fromEntries(Object.keys(cores).map(n => [n, { label: n, color: cores[n] }]));
  const apagada = (n: string) => !!foco && foco !== n;

  return (
    <Bloco className={className} titulo="Evolução por solução" sub="Veículos contratados por solução, mês a mês. Um projeto com duas soluções conta nas duas."
      direita={dados.destaques.length > 0 && <span>{dados.destaques.length} maiores em destaque{dados.outras.length ? ` · demais ${dados.outras.length} em cinza` : ""}</span>}>
      {dados.linhas.length ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
          <ChartContainer config={config} className="!aspect-auto h-[280px] w-full">
            <LineChart data={dados.linhas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} interval={Math.max(0, Math.ceil(dados.linhas.length / 6) - 1)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => numero(v)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <ChartTooltip cursor={{ stroke: "hsl(var(--border))" }} content={<Dica cores={cores} />} />
              {dados.outras.map(d => (
                <Line key={d.nome} dataKey={d.nome} type="monotone" stroke={SERIE_CINZA} strokeWidth={foco === d.nome ? 2.5 : 1.25} dot={false} isAnimationActive={false}
                  strokeOpacity={apagada(d.nome) ? 0.4 : 1} />
              ))}
              {dados.destaques.map(d => (
                <Line key={d.nome} dataKey={d.nome} type="monotone" stroke={cores[d.nome]} strokeWidth={foco === d.nome ? 3.25 : 2.25} dot={false} activeDot={{ r: 4 }} isAnimationActive={false}
                  strokeOpacity={apagada(d.nome) ? 0.2 : 1} />
              ))}
            </LineChart>
          </ChartContainer>
          <ul className="flex flex-col gap-1 self-start" onMouseLeave={() => setFoco(null)}>
            {dados.destaques.map(d => (
              <li key={d.nome}>
                <button type="button" onMouseEnter={() => setFoco(d.nome)} onFocus={() => setFoco(d.nome)} onBlur={() => setFoco(null)}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-opacity hover:bg-muted/50", apagada(d.nome) && "opacity-40")}>
                  <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cores[d.nome] }} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: cores[d.nome] }}>{d.nome}</span>
                  <span className="text-[12.5px] font-semibold tabular-nums">{numero(d.total)}</span>
                </button>
              </li>
            ))}
            {dados.outras.length > 0 && (
              <li className="mt-1 border-t border-border/60 pt-2">
                <p className="px-2 text-[12px] font-semibold text-muted-foreground">Outras {dados.outras.length}</p>
                {dados.outras.map(d => (
                  <button key={d.nome} type="button" onMouseEnter={() => setFoco(d.nome)} onFocus={() => setFoco(d.nome)} onBlur={() => setFoco(null)}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-0.5 text-left text-[12px] text-muted-foreground hover:bg-muted/50", apagada(d.nome) && "opacity-50")}>
                    <span className="min-w-0 flex-1 truncate">{d.nome}</span><span className="tabular-nums">{numero(d.total)}</span>
                  </button>
                ))}
              </li>
            )}
          </ul>
        </div>
      ) : <p className="flex h-[280px] items-center justify-center text-[13px] text-muted-foreground">Nenhum projeto com frota e solução nestes filtros.</p>}
    </Bloco>
  );
}
