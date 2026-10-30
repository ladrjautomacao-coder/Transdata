import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEM_GERENTE, type CargaGerente } from "@/lib/dashboard";
import { statusLabels } from "@/lib/statusLabels";
import { teamRoleLabels } from "@/lib/teamRoleLabels";
import { cn } from "@/lib/utils";
import { Bloco } from "./Bloco";

type Coluna = "nome" | "emAndamento" | "comercial" | "planejamento" | "implantacao" | "suspenso" | "implementados" | "total";

/**
 * Carga de cada gerente de projetos, pela coluna do Kanban: quem tem menos em andamento aparece
 * primeiro (para distribuir os novos). Clicar no gerente filtra o painel pelos projetos dele.
 */
export function CargaGerentes({ linhas, selecionado, onSelecionar, podeAtribuir, onAtribuir }: {
  /** Com os filtros do painel, menos o de gerente. */
  linhas: CargaGerente[];
  selecionado: string;
  onSelecionar: (nome: string | null) => void;
  podeAtribuir: boolean;
  onAtribuir: (gerenteId: string) => void;
}) {
  const [ordem, setOrdem] = useState<{ col: Coluna; asc: boolean }>({ col: "emAndamento", asc: true });
  const gerentes = linhas.filter(l => l.nome !== SEM_GERENTE);
  const sem = linhas.find(l => l.nome === SEM_GERENTE);
  const emAndamento = gerentes.reduce((a, l) => a + l.emAndamento, 0);
  const max = Math.max(1, ...gerentes.map(l => l.emAndamento));
  const ordenadas = gerentes.slice().sort((a, b) => {
    const d = ordem.col === "nome" ? a.nome.localeCompare(b.nome, "pt-BR") : a[ordem.col] - b[ordem.col];
    return (ordem.asc ? d : -d) || a.nome.localeCompare(b.nome, "pt-BR");
  });
  const menorCarga = ordem.col === "emAndamento" && ordem.asc && ordenadas.length > 1 ? ordenadas[0]?.nome : null;
  const rotuloGp = teamRoleLabels.manager ?? "Gerente de Projetos";

  const cab = (col: Coluna, rotulo: string, direita = true) => {
    const ativa = ordem.col === col;
    return (
      <th scope="col" aria-sort={ativa ? (ordem.asc ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5 font-medium", direita ? "text-right" : "text-left")}>
        <button type="button" onClick={() => setOrdem(o => ({ col, asc: o.col === col ? !o.asc : col !== "nome" ? false : true }))}
          className={cn("inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground", ativa && "text-foreground")}>
          {rotulo}{ativa && (ordem.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
      </th>
    );
  };

  return (
    <Bloco titulo={`Carga por ${rotuloGp.toLowerCase()}`}
      sub={<>Em andamento = {statusLabels.comercial}, {statusLabels.planejamento}, {statusLabels.implantacao} e {statusLabels.suspenso} › Suspenso. Quem tem menos aparece primeiro.</>}
      direita={(
        <>
          {[["Em andamento", String(emAndamento)], ["Gerentes", String(gerentes.length)], ["Média por gerente", gerentes.length ? (emAndamento / gerentes.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"]].map(([r, v]) => (
            <span key={r} className="flex flex-col items-end leading-tight">
              <span className="text-[11px]">{r}</span>
              <b className="text-lg font-bold tabular-nums text-foreground">{v}</b>
            </span>
          ))}
        </>
      )}>
      {gerentes.length ? (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[780px] text-[13px]">
            <thead className="bg-muted/40 text-[12px] text-muted-foreground">
              <tr>
                {cab("nome", "Gerente", false)}
                {cab("emAndamento", "Em andamento", false)}
                {cab("comercial", statusLabels.comercial)}
                {cab("planejamento", statusLabels.planejamento)}
                {cab("implantacao", statusLabels.implantacao)}
                {cab("suspenso", statusLabels.suspenso)}
                {cab("implementados", "Implementados")}
                {cab("total", "Total")}
                {podeAtribuir && <th scope="col" className="px-3 py-2.5"><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {ordenadas.map(l => {
                const sel = selecionado === l.nome;
                return (
                  <tr key={l.nome} onClick={() => onSelecionar(sel ? null : l.nome)}
                    className={cn("cursor-pointer transition-colors", sel ? "bg-primary/[0.07]" : menorCarga === l.nome ? "bg-emerald-500/[0.06] hover:bg-emerald-500/10" : "hover:bg-muted/40")}>
                    <td className="px-3 py-2.5">
                      <button type="button" className="text-left font-medium text-primary hover:underline" onClick={e => { e.stopPropagation(); onSelecionar(sel ? null : l.nome); }}>{l.nome}</button>
                      {menorCarga === l.nome && <span className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Menor carga atual</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${(l.emAndamento / max) * 100}%` }} />
                        </span>
                        <b className="w-6 text-right tabular-nums">{l.emAndamento}</b>
                      </span>
                    </td>
                    {(["comercial", "planejamento", "implantacao", "suspenso", "implementados", "total"] as const).map(c => (
                      <td key={c} className={cn("px-3 py-2.5 text-right tabular-nums", c === "total" ? "font-semibold" : l[c] ? "" : "text-muted-foreground/50")}>{l[c]}</td>
                    ))}
                    {podeAtribuir && (
                      <td className="px-3 py-2 text-right">
                        {l.id && (
                          <Button variant="outline" size="sm" className="h-8 text-xs" title={`Abre o cadastro de projeto com ${l.nome} como ${rotuloGp}`}
                            onClick={e => { e.stopPropagation(); onAtribuir(l.id!); }}>
                            <UserPlus className="mr-1.5 h-3.5 w-3.5" />Atribuir projeto
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">Nenhum projeto com gerente nestes filtros.</p>}

      {sem && sem.emAndamento > 0 && (
        <button type="button" onClick={() => onSelecionar(selecionado === SEM_GERENTE ? null : SEM_GERENTE)}
          className={cn("mt-3 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] transition-colors",
            selecionado === SEM_GERENTE ? "border-amber-500 bg-amber-500/15" : "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15", "text-amber-900 dark:text-amber-100")}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1"><b>{sem.emAndamento} {sem.emAndamento === 1 ? "projeto em andamento está" : "projetos em andamento estão"} sem gerente.</b> Clique para ver no painel.</span>
        </button>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
        <span>Clique num gerente para filtrar o painel pelos projetos dele.</span>
        {selecionado !== "all" && <button type="button" className="font-medium text-primary hover:underline" onClick={() => onSelecionar(null)}>Ver todos os gerentes</button>}
      </div>
    </Bloco>
  );
}
