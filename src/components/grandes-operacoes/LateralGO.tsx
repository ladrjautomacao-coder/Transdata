import { Link } from "react-router-dom";
import { CheckCircle2, Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { atvsDe, nomeCurto, resumo, stats, type GoDados, type GoProjeto } from "@/lib/grandesOperacoes/dados";
import { urlCliente, urlProjeto } from "@/lib/grandesOperacoes/ui";
import { NIVEL, nivelDe } from "@/lib/nivelMedidor";
import { cn } from "@/lib/utils";
import { Barra, SituacaoPill } from "./GoShared";

const cartao = (ativo: boolean) => cn("flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  ativo ? "border-primary bg-primary/[0.06] ring-1 ring-primary hover:bg-primary/[0.1]" : "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/[0.03]");

/**
 * A lateral do painel, como a dos módulos no Gerenciamento: o cliente, a saúde de todos os projetos
 * dele e um cartão por projeto, com o andamento.
 */
export function LateralGO({ dados, cliId, projetos, projAtual, onCliente }: {
  dados: GoDados;
  cliId: number | "todos";
  /** Projetos do cliente escolhido (ou de todos). */
  projetos: GoProjeto[];
  projAtual: GoProjeto | undefined;
  onCliente: (v: string) => void;
}) {
  const cli = cliId !== "todos" ? dados.cli.get(cliId) : undefined;
  const st = stats(atvsDe(dados, projetos.map(p => p.id)));
  const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
  return (
    <nav aria-label="Cliente e projetos" className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Cliente</p>
      <Select value={String(cliId)} onValueChange={onCliente}>
        <SelectTrigger className="h-10 bg-card" aria-label="Cliente"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os clientes</SelectItem>
          {dados.clientes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}{c.local ? ` — ${c.local}` : ""}</SelectItem>)}
        </SelectContent>
      </Select>

      <Link to={urlCliente(cliId)} aria-current={!projAtual ? "page" : undefined} className={cn(cartao(!projAtual), "mt-1")}>
        <span className="flex items-center gap-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${!projAtual ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}><Layers className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">{cli ? `Todos de ${cli.nome}` : "Todos os projetos"}</span>
            <span className="block text-[11.5px] text-muted-foreground">{st.done} de {st.total} concluídas</span>
          </span>
          <span className="text-lg font-bold tabular-nums">{pct}<span className="text-xs">%</span></span>
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-muted">
          <span className={`block h-full rounded-full transition-[width] duration-500 ${NIVEL[nivelDe(pct)].faixa}`} style={{ width: `${pct}%` }} />
        </span>
      </Link>

      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{cli ? "Projetos do cliente" : "Projetos"}</p>
      {projetos.length ? projetos.map((p, i) => {
        const s = stats(atvsDe(dados, [p.id])), ativo = projAtual?.id === p.id;
        const completo = s.total > 0 && s.done === s.total;
        return (
          <Link key={p.id} to={urlProjeto(p.id)} title={p.nome} aria-current={ativo ? "page" : undefined}
            className={cn(cartao(ativo), p.situacao !== "ativo" && !ativo && "opacity-70")}>
            <span className="flex items-center gap-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold tabular-nums ${ativo ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-semibold">{nomeCurto(p)}</span>
                {!cli && <span className="block truncate text-[11px] text-muted-foreground">{dados.cli.get(p.cliente_id)?.nome}</span>}
              </span>
              {completo ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Projeto concluído" />
                : <span className="text-xs font-semibold tabular-nums text-primary">{s.pct}%</span>}
            </span>
            <Barra s={s} />
            <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{resumo(s)}</span>
              <SituacaoPill situacao={p.situacao} />
            </span>
          </Link>
        );
      }) : <p className="rounded-xl border border-dashed border-border p-3 text-[13px] text-muted-foreground">Este cliente ainda não tem projetos.</p>}
    </nav>
  );
}
