import { useState } from "react";
import { STATUS_ORDEM, contarStatus, frotaPorStatus, porcentagem, type DashProject, type ProjectStatus } from "@/lib/dashboard";
import { statusLabels } from "@/lib/statusLabels";
import { cn } from "@/lib/utils";
import { Bloco } from "./Bloco";
import { COR_STATUS, numero } from "./cores";

/**
 * Status dos projetos numa barra só, nas cores do Kanban, contando projetos ou veículos. Clicar num
 * status filtra o painel (o bloco continua mostrando todos e destaca o escolhido).
 */
export function StatusProjetos({ ps, selecionado, onSelecionar }: {
  /** Projetos com os filtros do painel, menos o de status. */
  ps: DashProject[];
  selecionado: string;
  onSelecionar: (s: ProjectStatus | null) => void;
}) {
  const [modo, setModo] = useState<"projetos" | "frota">("projetos");
  const valores = modo === "projetos" ? contarStatus(ps) : frotaPorStatus(ps);
  const total = STATUS_ORDEM.reduce((a, s) => a + valores[s], 0);
  const escolher = (s: ProjectStatus) => onSelecionar(selecionado === s ? null : s);
  const apagado = (s: ProjectStatus) => selecionado !== "all" && selecionado !== s;

  return (
    <Bloco titulo="Status dos projetos" sub="A mesma divisão das colunas do Kanban. Clique num status para filtrar o painel."
      direita={(
        <>
          <span className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Contar por">
            {(["projetos", "frota"] as const).map(m => (
              <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)}
                className={cn("rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors", modo === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {m === "projetos" ? "Projetos" : "Frota"}
              </button>
            ))}
          </span>
          <span className="tabular-nums">{numero(total)} {modo === "projetos" ? (total === 1 ? "projeto" : "projetos") : "veículos"}</span>
        </>
      )}>
      <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {STATUS_ORDEM.filter(s => valores[s] > 0).map(s => (
          <button key={s} type="button" onClick={() => escolher(s)} style={{ flexGrow: valores[s] }}
            title={`${statusLabels[s]}: ${numero(valores[s])} (${porcentagem(valores[s], total)}%)`} aria-label={`${statusLabels[s]}: ${numero(valores[s])}`}
            className={cn("min-w-[6px] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", COR_STATUS[s].barra, apagado(s) && "opacity-25")} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS_ORDEM.map(s => (
          <li key={s}>
            <button type="button" onClick={() => escolher(s)} aria-pressed={selecionado === s}
              className={cn("flex w-full flex-col items-start border-t-[3px] pt-2 text-left transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                COR_STATUS[s].borda, apagado(s) && "opacity-40", selecionado === s && "rounded-b-md bg-muted/60 px-2 pb-1.5")}>
              <span className="text-[13px] text-muted-foreground">{statusLabels[s]}</span>
              <span className="flex items-baseline gap-1.5">
                <b className="text-xl font-bold tabular-nums">{numero(valores[s])}</b>
                <span className="text-[12.5px] tabular-nums text-muted-foreground">· {porcentagem(valores[s], total)}%{modo === "frota" ? " · veículos" : ""}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Bloco>
  );
}
