import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Building2, FolderKanban, MapPin, Search, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyBlock, Kpi } from "@/components/agendamento/AgendaShared";
import { Barra, GoCabecalho, GoErro, SituacaoPill } from "@/components/grandes-operacoes/GoShared";
import { useGoDados } from "@/components/grandes-operacoes/useGoDados";
import {
  FILTROS_HUB_PADRAO, atvsDe, hubGrupos, nomeCurto, projsDoCliente, resumo, stats, type FiltroSituacao, type FiltrosHub,
} from "@/lib/grandesOperacoes/dados";
import { URL_GESTAO_OPERACIONAL } from "@/lib/gestaoOperacional";
import { urlCliente, urlProjeto } from "@/lib/grandesOperacoes/ui";

const FILTROS_KEY = "go-hub-filtros";
const SITUACOES: { v: FiltroSituacao; l: string }[] = [
  { v: "ativos", l: "Ativos e pausados" }, { v: "ativo", l: "Só ativos" }, { v: "pausado", l: "Só pausados" },
  { v: "encerrado", l: "Só encerrados" }, { v: "todos", l: "Todos, inclusive encerrados" },
];
function lerFiltros(): FiltrosHub {
  try {
    const h = JSON.parse(localStorage.getItem(FILTROS_KEY) ?? "{}") as Partial<FiltrosHub>;
    const f = { ...FILTROS_HUB_PADRAO };
    (["q", "cli", "loc"] as const).forEach(k => { if (typeof h[k] === "string") f[k] = h[k] as string; });
    if (SITUACOES.some(s => s.v === h.sit)) f.sit = h.sit as FiltroSituacao;
    return f;
  } catch { return { ...FILTROS_HUB_PADRAO }; }
}

/**
 * Hub de Grandes Operações (Gestão Operacional): todos os clientes e projetos do departamento,
 * com filtros, totais e um cartão por projeto. Tradução da tela "Hub" do sistema original.
 */
export default function GrandesOperacoes() {
  const { dados, erro, recarregar } = useGoDados();
  const [f, setF] = useState<FiltrosHub>(lerFiltros);
  useEffect(() => { try { localStorage.setItem(FILTROS_KEY, JSON.stringify(f)); } catch { /* ignore */ } }, [f]);
  const set = (patch: Partial<FiltrosHub>) => setF(x => ({ ...x, ...patch }));

  const locais = useMemo(() => (dados ? Array.from(new Set(dados.clientes.map(c => c.local).filter(Boolean))).sort((a, b) => a.localeCompare(b)) : []), [dados]);
  // filtro guardado que não existe mais (cliente apagado) volta para "todos"
  const fv: FiltrosHub = dados ? {
    ...f, cli: f.cli !== "all" && !dados.cli.has(Number(f.cli)) ? "all" : f.cli, loc: f.loc !== "all" && !locais.includes(f.loc) ? "all" : f.loc,
  } : f;
  const filtrado = fv.cli !== "all" || fv.loc !== "all" || fv.sit !== "ativos" || !!fv.q;
  const { ps, grupos } = dados ? hubGrupos(dados, fv) : { ps: [], grupos: [] };
  const s = dados ? stats(atvsDe(dados, ps.map(p => p.id))) : null;
  const ultima = dados?.atividades.map(a => a.atualizado_em).sort().pop();

  return (
    <div className="flex flex-col gap-5">
      <GoCabecalho voltar={{ to: URL_GESTAO_OPERACIONAL, label: "Gestão Operacional" }} titulo="Grandes Operações"
        sub="Hub de projetos: o acompanhamento dos clientes e projetos do departamento." />

      {/* KPIs */}
      {!dados || !s ? (
        erro ? <GoErro erro={erro} onTentar={recarregar} /> : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={Building2} label={grupos.length === 1 ? "Cliente" : "Clientes"} value={grupos.length} caption="com os filtros aplicados" tone="bg-primary/10 text-primary"
            info="Clientes que aparecem com os filtros de cima. Cliente sem projeto aparece quando não há busca nem filtro de uma situação só." />
          <Kpi icon={FolderKanban} label={ps.length === 1 ? "Projeto" : "Projetos"} value={ps.length} caption={SITUACOES.find(x => x.v === fv.sit)?.l.toLowerCase() ?? ""} tone="bg-primary/10 text-primary"
            info="Projetos que passam nos filtros. O padrão mostra os ativos e os pausados; os encerrados ficam de fora." />
          <Kpi icon={Activity} label="Em andamento" value={s.doing} caption="atividades em andamento" tone="bg-sky-500/15 text-sky-700 dark:text-sky-300"
            info="Atividades com status Em andamento nos projetos que aparecem." />
          <Kpi icon={TrendingUp} label="Progresso geral" value={`${s.pct}%`} caption={s.total ? `${s.done} de ${s.total} concluídas` : "sem atividades"} tone="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            info="Concluídas sobre o total de atividades dos projetos que aparecem. Atividades removidas não entram na conta." />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 pl-9" type="search" placeholder="Buscar cliente ou projeto" aria-label="Buscar cliente ou projeto" value={f.q} onChange={ev => set({ q: ev.target.value })} />
        </div>
        <Select value={fv.cli} onValueChange={v => set({ cli: v })}>
          <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Cliente"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {dados?.clientes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fv.loc} onValueChange={v => set({ loc: v })}>
          <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Local"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os locais</SelectItem>
            {locais.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fv.sit} onValueChange={v => set({ sit: v as FiltroSituacao })}>
          <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Situação"><SelectValue /></SelectTrigger>
          <SelectContent>{SITUACOES.map(x => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}</SelectContent>
        </Select>
        {filtrado && <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setF({ ...FILTROS_HUB_PADRAO })}>Limpar</Button>}
      </div>

      {/* Clientes e projetos */}
      {!dados ? (
        !erro && <div className="space-y-4">{[0, 1].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : !dados.clientes.length ? (
        <div className="rounded-xl border border-border/60 bg-card"><EmptyBlock icon={Building2} title="Nenhum cliente cadastrado ainda" text="Os clientes e projetos do departamento aparecem aqui assim que forem cadastrados." /></div>
      ) : !grupos.length ? (
        <div className="rounded-xl border border-border/60 bg-card">
          <EmptyBlock icon={Search} title="Nenhum projeto com esses filtros" text="Mude a busca ou os filtros para ver outros clientes e projetos."
            action={<Button variant="outline" size="sm" onClick={() => setF({ ...FILTROS_HUB_PADRAO })}>Limpar filtros</Button>} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map(g => {
            const gs = stats(atvsDe(dados, g.ps.map(p => p.id)));
            return (
              <section key={g.c.id} aria-labelledby={`go-cli-${g.c.id}`} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 pb-2">
                  <Link id={`go-cli-${g.c.id}`} to={urlCliente(g.c.id)} title="Abrir todos os projetos deste cliente"
                    className="text-lg font-bold tracking-tight hover:text-primary hover:underline">{g.c.nome}</Link>
                  {g.c.local && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground"><MapPin className="h-3 w-3" />{g.c.local}</span>}
                  <span className="text-[12.5px] text-muted-foreground">{g.ps.length} {g.ps.length === 1 ? "projeto" : "projetos"}{gs.total ? ` · ${gs.pct}% concluído` : ""}</span>
                </div>
                {g.ps.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {g.ps.map(p => {
                      const st = stats(atvsDe(dados, [p.id]));
                      return (
                        <Link key={p.id} to={urlProjeto(p.id)}
                          className={`group relative flex flex-col gap-2.5 overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${p.situacao !== "ativo" ? "opacity-60 hover:opacity-100" : ""}`}>
                          <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
                          <span className="flex items-start gap-3">
                            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold group-hover:text-primary" title={p.nome}>{nomeCurto(p)}</span>
                            <span className="text-xl font-bold leading-none tabular-nums">{st.pct}%</span>
                          </span>
                          <Barra s={st} className="h-2" />
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 text-[12.5px] text-muted-foreground">{resumo(st)}</span>
                            <SituacaoPill situacao={p.situacao} />
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground">
                    {projsDoCliente(dados, g.c.id).length ? "Nenhum projeto deste cliente com esses filtros." : "Nenhum projeto cadastrado para este cliente ainda."}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {ultima && <p className="text-center text-xs text-muted-foreground">Última alteração em {new Date(ultima).toLocaleDateString("pt-BR")} às {new Date(ultima).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
    </div>
  );
}
