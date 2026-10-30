import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { frotaDe, gerenteDe, solucoesDe, statusEfetivo, type DashProject } from "@/lib/dashboard";
import { statusLabels } from "@/lib/statusLabels";
import { teamRoleLabels } from "@/lib/teamRoleLabels";
import { cn } from "@/lib/utils";
import { Bloco } from "./Bloco";
import { COR_STATUS, numero } from "./cores";

const VISIVEIS = 10;
const dataBr = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");

/** Os projetos que passam nos filtros, do contrato mais novo para o mais antigo. Clicar abre o projeto. */
export function ListaProjetos({ ps, onAbrir }: { ps: DashProject[]; onAbrir: (id: string) => void }) {
  const [todos, setTodos] = useState(false);
  const ordenados = ps.slice().sort((a, b) => b.contract_date.localeCompare(a.contract_date) || a.company_name.localeCompare(b.company_name, "pt-BR"));
  const lista = todos ? ordenados : ordenados.slice(0, VISIVEIS);
  return (
    <Bloco titulo="Projetos no painel" sub="Os projetos que passam nos filtros, do contrato mais novo para o mais antigo. Clique para abrir."
      direita={<span>{ps.length} {ps.length === 1 ? "projeto" : "projetos"}</span>}>
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead className="bg-muted/40 text-left text-[12px] text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-medium">Projeto</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Local</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-3 py-2.5 font-medium">{teamRoleLabels.manager ?? "Gerente de Projetos"}</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Frota</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Soluções</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Contrato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {lista.map(p => {
              const st = statusEfetivo(p), sols = solucoesDe(p);
              return (
                <tr key={p.id} onClick={() => onAbrir(p.id)} className="cursor-pointer transition-colors hover:bg-muted/40">
                  <td className="px-3 py-2.5">
                    <button type="button" className="text-left font-medium hover:text-primary hover:underline" onClick={e => { e.stopPropagation(); onAbrir(p.id); }}>{p.company_name}</button>
                    {p.project_code && <span className="block font-mono text-[11px] text-muted-foreground">{p.project_code.split("-")[0]}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{p.city}/{p.state}</td>
                  <td className="px-3 py-2.5"><span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", COR_STATUS[st].pill)}>{statusLabels[st]}</span></td>
                  <td className={cn("px-3 py-2.5", !p.manager && "italic text-muted-foreground")}>{gerenteDe(p)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{frotaDe(p) ? numero(frotaDe(p)) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {sols.slice(0, 2).map(s => <span key={s} className="rounded-full border border-border/70 px-1.5 py-px text-[11px]">{s}</span>)}
                      {sols.length > 2 && <span className="rounded-full bg-muted px-1.5 py-px text-[11px] text-muted-foreground" title={sols.slice(2).join(", ")}>+{sols.length - 2}</span>}
                      {!sols.length && <span className="text-muted-foreground">—</span>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">{dataBr(p.contract_date)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ordenados.length > VISIVEIS && (
        <Button variant="ghost" size="sm" className="mt-2 h-8 text-[12.5px] text-primary" onClick={() => setTodos(t => !t)}>
          <ChevronDown className={cn("mr-1 h-4 w-4 transition-transform", todos && "rotate-180")} />{todos ? "Mostrar menos" : `Ver todos os ${ordenados.length} projetos`}
        </Button>
      )}
    </Bloco>
  );
}
