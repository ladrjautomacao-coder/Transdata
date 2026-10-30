import { cn } from "@/lib/utils";
import { Bloco } from "./Bloco";

// Mapa do Brasil em quadrados: cada estado na sua posição aproximada (coluna, linha)
const POSICAO: Record<string, [number, number]> = {
  RR: [2, 0], AP: [4, 0],
  AM: [1, 1], PA: [3, 1], MA: [4, 1], CE: [5, 1], RN: [6, 1],
  AC: [0, 2], RO: [1, 2], MT: [2, 2], TO: [3, 2], PI: [4, 2], PE: [5, 2], PB: [6, 2],
  MS: [2, 3], GO: [3, 3], DF: [4, 3], BA: [5, 3], AL: [6, 3],
  SP: [3, 4], MG: [4, 4], ES: [5, 4], SE: [6, 4],
  PR: [3, 5], RJ: [4, 5],
  SC: [3, 6],
  RS: [3, 7],
};
const NOME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco",
  PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
/** Tom do quadrado pela quantidade (relativa ao estado com mais projetos). */
const TOM = ["bg-muted/60 text-muted-foreground/60", "bg-primary/20 text-foreground", "bg-primary/40 text-foreground", "bg-primary/70 text-primary-foreground", "bg-primary text-primary-foreground"];
const tomDe = (n: number, max: number) => (!n ? 0 : n / max > 0.66 ? 4 : n / max > 0.33 ? 3 : n / max > 0.12 ? 2 : 1);

/**
 * Onde estão os projetos: o mapa em quadrados (cor mais forte = mais projetos) e os estados com mais
 * projetos. Clicar num estado filtra o painel.
 */
export function MapaEstados({ contagem, selecionado, onSelecionar }: {
  /** Projetos por UF, com os filtros do painel, menos o de estado. */
  contagem: Record<string, number>;
  selecionado: string;
  onSelecionar: (uf: string | null) => void;
}) {
  const max = Math.max(1, ...Object.values(contagem));
  const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const fora = ranking.filter(([uf]) => !POSICAO[uf]);
  const escolher = (uf: string) => onSelecionar(selecionado === uf ? null : uf);
  const total = ranking.reduce((a, [, n]) => a + n, 0);

  return (
    <Bloco titulo="Onde estão os projetos" sub="Cor mais forte, mais projetos. Clique num estado para filtrar o painel."
      direita={<span>{ranking.length} {ranking.length === 1 ? "estado" : "estados"}</span>}>
      <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
        <div className="flex flex-col items-center gap-3">
          <div className="grid grid-cols-7 gap-1" style={{ gridTemplateRows: "repeat(8, minmax(0, 1fr))" }} role="group" aria-label="Mapa dos estados">
            {Object.entries(POSICAO).map(([uf, [c, l]]) => {
              const n = contagem[uf] ?? 0, sel = selecionado === uf;
              return (
                <button key={uf} type="button" disabled={!n && !sel} onClick={() => escolher(uf)} aria-pressed={sel}
                  title={`${NOME[uf]}: ${n} ${n === 1 ? "projeto" : "projetos"}`} style={{ gridColumn: c + 1, gridRow: l + 1 }}
                  className={cn("flex h-10 w-10 flex-col items-center justify-center rounded-md text-[10.5px] font-bold leading-none transition-transform enabled:hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-11 sm:w-11",
                    TOM[tomDe(n, max)], sel && "ring-2 ring-foreground ring-offset-2 ring-offset-card", selecionado !== "all" && !sel && "opacity-40")}>
                  {uf}
                  {n > 0 && <span className="mt-0.5 text-[10px] font-semibold tabular-nums opacity-90">{n}</span>}
                </button>
              );
            })}
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            menos {TOM.slice(1).map(t => <i key={t} className={cn("h-2.5 w-4 rounded-sm", t)} />)} mais
          </span>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Mais projetos</p>
          {ranking.length ? (
            <ol className="flex flex-col gap-0.5">
              {ranking.slice(0, 8).map(([uf, n], i) => {
                const sel = selecionado === uf;
                return (
                  <li key={uf}>
                    <button type="button" onClick={() => escolher(uf)} aria-pressed={sel}
                      className={cn("grid w-full grid-cols-[1.25rem_2rem_minmax(0,1fr)_minmax(0,0.9fr)_2rem] items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-muted/50",
                        sel && "bg-primary/[0.08]", selecionado !== "all" && !sel && "opacity-45")}>
                      <span className="text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                      <b className="font-semibold">{uf}</b>
                      <span className="truncate text-muted-foreground">{NOME[uf] ?? uf}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary/70" style={{ width: `${(n / max) * 100}%` }} /></span>
                      <span className="text-right font-semibold tabular-nums">{n}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : <p className="text-[13px] text-muted-foreground">Nenhum projeto nestes filtros.</p>}
          {ranking.length > 8 && <p className="mt-1.5 px-1.5 text-[12px] text-muted-foreground">e mais {ranking.length - 8} {ranking.length - 8 === 1 ? "estado" : "estados"} no mapa · {total} projetos no total</p>}
          {fora.length > 0 && <p className="mt-1.5 px-1.5 text-[12px] text-muted-foreground">Fora do Brasil: {fora.map(([uf, n]) => `${uf} (${n})`).join(", ")}</p>}
        </div>
      </div>
    </Bloco>
  );
}
