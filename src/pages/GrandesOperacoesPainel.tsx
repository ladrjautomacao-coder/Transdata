import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Activity, CalendarRange, CheckCircle2, Columns3, Hourglass, ListChecks, ListTree, Search, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Kpi } from "@/components/agendamento/AgendaShared";
import { DetalheGO } from "@/components/grandes-operacoes/DetalheGO";
import { EtapasGO } from "@/components/grandes-operacoes/EtapasGO";
import { GanttGO } from "@/components/grandes-operacoes/GanttGO";
import { Barra, GoCabecalho, GoErro, SituacaoPill } from "@/components/grandes-operacoes/GoShared";
import { QuadroGO } from "@/components/grandes-operacoes/QuadroGO";
import { useGoDados } from "@/components/grandes-operacoes/useGoDados";
import {
  SITUACAO_NOME, atvsDe, matchQ, matchResp, nomeCurto, projsDoCliente, relDe, respOptions, resumo, stats,
} from "@/lib/grandesOperacoes/dados";
import { GO_BASE, urlCliente, urlProjeto } from "@/lib/grandesOperacoes/ui";

type Visao = "quadro" | "etapas" | "gantt";
const VISAO_KEY = "go-visao";
const VISOES: { v: Visao; l: string; icon: typeof Columns3 }[] = [
  { v: "quadro", l: "Quadro", icon: Columns3 }, { v: "etapas", l: "Etapas", icon: ListTree }, { v: "gantt", l: "Gantt", icon: CalendarRange },
];
const lerVisao = (): Visao => { try { const v = localStorage.getItem(VISAO_KEY); return v === "etapas" || v === "gantt" ? v : "quadro"; } catch { return "quadro"; } };

/**
 * Painel de acompanhamento do Hub de Grandes Operações: um projeto (…/projeto/<id>) ou todos os
 * projetos de um cliente (…/cliente/<id>, "todos" = todos os clientes), nas visões Quadro,
 * Etapas e Gantt, com os detalhes da atividade selecionada. Somente leitura nesta etapa.
 */
export default function GrandesOperacoesPainel() {
  const { cli: cliParam, proj: projParam } = useParams();
  const navigate = useNavigate();
  const { dados, erro, recarregar } = useGoDados();
  const [visao, setVisao] = useState<Visao>(lerVisao);
  const [q, setQ] = useState("");
  const [resp, setResp] = useState("all");
  const [act, setAct] = useState<number | null>(null);
  const [etapa, setEtapa] = useState<number | null>(null);
  const detalheRef = useRef<HTMLElement>(null);
  useEffect(() => { try { localStorage.setItem(VISAO_KEY, visao); } catch { /* ignore */ } }, [visao]);
  // trocou de cliente ou de projeto: a seleção recomeça
  useEffect(() => { setAct(null); setEtapa(null); window.scrollTo(0, 0); }, [cliParam, projParam]);

  const proj = projParam && dados ? dados.proj.get(Number(projParam)) : undefined;
  const cliId: number | "todos" = proj ? proj.cliente_id : !cliParam || cliParam === "todos" ? "todos" : Number(cliParam);
  const cli = cliId !== "todos" && dados ? dados.cli.get(cliId) : undefined;
  const naoAchou = !!dados && ((!!projParam && !proj) || (cliId !== "todos" && !cli));
  useEffect(() => { if (naoAchou) toast.error(projParam ? `Projeto ${projParam} não encontrado` : `Cliente ${cliParam} não encontrado`); }, [naoAchou, projParam, cliParam]);
  if (naoAchou) return <Navigate to={GO_BASE} replace />;

  const selecionar = (id: number | null) => {
    setAct(cur => (cur === id ? null : id));
    // detalhe fora da tela: rola até ele
    setTimeout(() => {
      const d = detalheRef.current;
      if (id != null && d && d.getBoundingClientRect().top > window.innerHeight - 120) d.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  };

  const pc = proj ? dados?.cli.get(proj.cliente_id) : undefined;
  const titulo = proj ? nomeCurto(proj) : cli ? cli.nome : "Todos os projetos";
  const sub = proj ? `${pc ? `${pc.nome}${pc.local ? ` · ${pc.local}` : ""} · ` : ""}Painel de acompanhamento`
    : cli ? `${cli.local ? `${cli.local} · ` : ""}Todos os projetos do cliente` : "Painel de acompanhamento";
  const cabecalho = <GoCabecalho voltar={{ to: GO_BASE, label: "Hub de Grandes Operações" }} titulo={dados ? titulo : "Grandes Operações"} sub={dados ? sub : "Carregando…"} />;

  if (!dados) {
    return (
      <div className="flex flex-col gap-5">
        {cabecalho}
        {erro ? <GoErro erro={erro} onTentar={recarregar} /> : <>
          <Skeleton className="h-24 rounded-xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[88px] rounded-xl" />)}</div>
          <Skeleton className="h-96 rounded-xl" />
        </>}
      </div>
    );
  }

  const projsEscopo = cliId === "todos" ? dados.projetos : projsDoCliente(dados, cliId);
  const escopo = atvsDe(dados, proj ? [proj.id] : projsEscopo.map(p => p.id));
  const opcoesResp = respOptions(dados, proj ? [proj] : projsEscopo);
  const respSel = opcoesResp.includes(resp) ? resp : "all";
  const visiveis = escopo.filter(a => matchResp(a, respSel) && matchQ(dados, a, q.trim()));
  const s = stats(visiveis);
  const rel = relDe(dados, act);
  const nota = [(respSel !== "all" || q.trim()) && "Filtro ativo.", s.removed > 0 && `${s.removed} ${s.removed > 1 ? "atividades removidas não entram" : "atividade removida não entra"} na conta.`].filter(Boolean).join(" ");

  // cartões de cima: "Todos de <cliente>" + os projetos do cliente
  const cartoes = [
    { key: "todos", to: urlCliente(cliId), label: cliId === "todos" ? "Todos os projetos" : `Todos de ${cli?.nome ?? "cliente"}`, title: "", on: !proj, s: stats(atvsDe(dados, projsEscopo.map(p => p.id))), sit: null },
    ...projsEscopo.map(p => ({ key: String(p.id), to: urlProjeto(p.id), label: nomeCurto(p), title: p.nome, on: proj?.id === p.id, s: stats(atvsDe(dados, [p.id])), sit: p.situacao })),
  ];

  return (
    <div className="flex flex-col gap-5">
      {cabecalho}

      {/* cliente e projetos */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Cliente</span>
          <Select value={String(cliId)} onValueChange={v => navigate(urlCliente(v === "todos" ? "todos" : Number(v)))}>
            <SelectTrigger className="h-8 w-auto min-w-[200px]" aria-label="Cliente"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {dados.clientes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}{c.local ? ` — ${c.local}` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
          {proj && <><span className="text-muted-foreground">/</span><b className="font-semibold">{proj.nome}</b>{proj.situacao !== "ativo" && <SituacaoPill situacao={proj.situacao} />}</>}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {cartoes.map(c => (
            <Link key={c.key} to={c.to} title={c.title || c.label} aria-current={c.on ? "page" : undefined}
              className={`flex w-[230px] shrink-0 flex-col gap-2 rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${c.on ? "border-primary bg-primary/[0.06] ring-1 ring-primary" : "border-border/60 bg-card shadow-sm"}`}>
              <span className="flex items-center gap-2">
                <span className={`min-w-0 flex-1 truncate text-[13.5px] font-semibold ${c.on ? "text-primary" : ""}`}>{c.label}</span>
                <span className="text-[15px] font-bold tabular-nums">{c.s.pct}%</span>
              </span>
              <Barra s={c.s} />
              <span className="truncate text-[11.5px] text-muted-foreground">{resumo(c.s)}{c.sit && c.sit !== "ativo" ? ` · ${SITUACAO_NOME[c.sit]}` : ""}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* busca, responsável e visão */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-3">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 pl-9" type="search" placeholder="Buscar atividade, código ou observação" aria-label="Buscar" value={q} onChange={ev => setQ(ev.target.value)} />
        </div>
        <Select value={respSel} onValueChange={setResp}>
          <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Responsável"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {opcoesResp.map(r => <SelectItem key={r} value={r}>Com {r}</SelectItem>)}
          </SelectContent>
        </Select>
        <div role="group" aria-label="Visão" className="flex rounded-lg border p-0.5">
          {VISOES.map(x => (
            <button key={x.v} type="button" aria-pressed={visao === x.v} onClick={() => setVisao(x.v)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${visao === x.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <x.icon className="h-4 w-4" />{x.l}
            </button>
          ))}
        </div>
      </div>

      {/* totais */}
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi icon={ListChecks} label="Atividades" value={s.total} caption="no painel" tone="bg-primary/10 text-primary"
            info="Atividades do cliente ou projeto aberto que passam na busca e no responsável. Removidas não entram na conta." />
          <Kpi icon={CheckCircle2} label="Concluídas" value={s.done} caption={s.total ? `${Math.round((s.done / s.total) * 100)}% do total` : "—"} tone="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            info="Atividades com status Concluído." />
          <Kpi icon={Activity} label="Em andamento" value={s.doing} caption="sendo feitas agora" tone="bg-sky-500/15 text-sky-700 dark:text-sky-300"
            info="Atividades com status Em andamento." />
          <Kpi icon={Hourglass} label="Em espera" value={s.wait} caption="ainda não começaram" tone="bg-amber-500/15 text-amber-800 dark:text-amber-200"
            info="Atividades com status Em espera." />
          <Kpi icon={TrendingUp} label="Progresso" value={`${s.pct}%`} caption={s.total ? `${s.done} de ${s.total}` : "sem atividades"} tone="bg-primary/10 text-primary"
            info="Concluídas sobre o total, sem contar as removidas." />
        </div>
        {nota && <p className="text-[12px] text-muted-foreground">{nota}</p>}
      </div>

      {visao === "quadro" && <QuadroGO dados={dados} visiveis={visiveis} act={act} onSelect={id => selecionar(id)} etapa={etapa} onEtapa={setEtapa} mostrarProjeto={!proj} rel={rel} />}
      {visao === "etapas" && <EtapasGO dados={dados} visiveis={visiveis} act={act} onSelect={id => selecionar(id)} umProjeto={!!proj} rel={rel} />}
      {visao === "gantt" && <GanttGO dados={dados} visiveis={visiveis} act={act} onSelect={id => setAct(id)} rel={rel} />}

      <DetalheGO ref={detalheRef} dados={dados} act={act} onSelect={id => selecionar(id)} />
    </div>
  );
}
