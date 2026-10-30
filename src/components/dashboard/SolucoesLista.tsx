import { cn } from "@/lib/utils";
import { Bloco } from "./Bloco";

/** Projetos por solução em barras, da mais usada para a menos usada. Clicar filtra o painel. */
export function SolucoesLista({ lista, selecionado, onSelecionar, className }: {
  /** Com os filtros do painel, menos o de solução. */
  lista: { nome: string; n: number }[];
  selecionado: string;
  onSelecionar: (nome: string | null) => void;
  className?: string;
}) {
  const max = Math.max(1, ...lista.map(l => l.n));
  return (
    <Bloco className={className} titulo="Projetos por solução" sub="Clique numa solução para filtrar o painel."
      direita={<span>{lista.length} {lista.length === 1 ? "solução" : "soluções"}</span>}>
      {lista.length ? (
        <ul className="flex max-h-[268px] flex-col gap-0.5 overflow-y-auto pr-1">
          {lista.map(l => {
            const sel = selecionado === l.nome, apagada = selecionado !== "all" && !sel;
            return (
              <li key={l.nome}>
                <button type="button" onClick={() => onSelecionar(sel ? null : l.nome)} aria-pressed={sel}
                  className={cn("grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_2.5rem] items-center gap-3 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-muted/50",
                    sel && "bg-primary/[0.08]", apagada && "opacity-45")}>
                  <span className={cn("truncate", sel && "font-semibold")} title={l.nome}>{l.nome}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", sel ? "bg-primary" : "bg-primary/70")} style={{ width: `${(l.n / max) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{l.n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="py-10 text-center text-[13px] text-muted-foreground">Nenhuma solução nos projetos destes filtros.</p>}
    </Bloco>
  );
}
