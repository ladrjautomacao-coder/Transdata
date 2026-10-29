import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarRange, Columns3, Eye, ListTree, Pencil, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DetalheGO } from "@/components/grandes-operacoes/DetalheGO";
import { EtapasGO } from "@/components/grandes-operacoes/EtapasGO";
import { GanttGO } from "@/components/grandes-operacoes/GanttGO";
import { GoCabecalho, GoErro, SituacaoPill } from "@/components/grandes-operacoes/GoShared";
import { LateralGO } from "@/components/grandes-operacoes/LateralGO";
import { QuadroGO } from "@/components/grandes-operacoes/QuadroGO";
import { SaudeGO } from "@/components/grandes-operacoes/SaudeGO";
import { useGoDados } from "@/components/grandes-operacoes/useGoDados";
import { errorMessage } from "@/lib/implantationScheduling";
import {
  STATUS_NOME, atvsDe, camposParaStatus, comAtividade, fmtD, gravarStatus, hojeTexto, matchQ, matchResp, nomeCurto, predsAbertas,
  projsDoCliente, relDe, respOptions, type GoCamposStatus, type GoStatus, type ResultadoStatus,
} from "@/lib/grandesOperacoes/dados";
import { calcularPrevisao } from "@/lib/grandesOperacoes/previsao";
import { GO_BASE, urlCliente } from "@/lib/grandesOperacoes/ui";

type Visao = "quadro" | "etapas" | "gantt";
const VISAO_KEY = "go-visao";
const VISOES: { v: Visao; l: string; icon: typeof Columns3 }[] = [
  { v: "quadro", l: "Quadro", icon: Columns3 }, { v: "etapas", l: "Etapas", icon: ListTree }, { v: "gantt", l: "Gantt", icon: CalendarRange },
];
const lerVisao = (): Visao => { try { const v = localStorage.getItem(VISAO_KEY); return v === "etapas" || v === "gantt" ? v : "quadro"; } catch { return "quadro"; } };

/**
 * Painel de acompanhamento do Hub de Grandes Operações: um projeto (…/projeto/<id>) ou todos os
 * projetos de um cliente (…/cliente/<id>, "todos" = todos os clientes). No desenho do
 * Gerenciamento: projetos na lateral, a saúde com o medidor e as trilhas das etapas, e as visões
 * Quadro, Etapas e Gantt. Quem pode editar troca o status (arrastando no quadro ou no selo).
 */
export default function GrandesOperacoesPainel() {
  const { cli: cliParam, proj: projParam } = useParams();
  const navigate = useNavigate();
  const { dados, erro, recarregar, podeEditar, atualizar } = useGoDados();
  const [visao, setVisao] = useState<Visao>(lerVisao);
  const [q, setQ] = useState("");
  const [resp, setResp] = useState("all");
  const [act, setAct] = useState<number | null>(null);
  const [etapa, setEtapa] = useState<number | null>(null);
  useEffect(() => { try { localStorage.setItem(VISAO_KEY, visao); } catch { /* ignore */ } }, [visao]);
  // trocou de cliente ou de projeto: a seleção recomeça
  useEffect(() => { setAct(null); setEtapa(null); window.scrollTo(0, 0); }, [cliParam, projParam]);
  const fechar = useCallback(() => setAct(null), []);
  // a previsão é calculada sobre todas as atividades, como no original
  const previsao = useMemo(() => (dados ? calcularPrevisao(dados.atividades, dados.projetos, hojeTexto()) : {}), [dados]);

  const proj = projParam && dados ? dados.proj.get(Number(projParam)) : undefined;
  const cliId: number | "todos" = proj ? proj.cliente_id : !cliParam || cliParam === "todos" ? "todos" : Number(cliParam);
  const cli = cliId !== "todos" && dados ? dados.cli.get(cliId) : undefined;
  const naoAchou = !!dados && ((!!projParam && !proj) || (cliId !== "todos" && !cli));
  useEffect(() => { if (naoAchou) toast.error(projParam ? `Projeto ${projParam} não encontrado` : `Cliente ${cliParam} não encontrado`); }, [naoAchou, projParam, cliParam]);
  if (naoAchou) return <Navigate to={GO_BASE} replace />;

  const pc = proj ? dados?.cli.get(proj.cliente_id) : undefined;
  const titulo = proj ? nomeCurto(proj) : cli ? cli.nome : "Todos os projetos";
  const sub = proj ? [proj.nome !== titulo && proj.nome, pc?.nome, pc?.local].filter(Boolean).join(" · ")
    : cli ? `${cli.local ? `${cli.local} · ` : ""}Todos os projetos do cliente` : "Painel de acompanhamento de todos os clientes";
  const meta = dados && (
    <>
      {proj && <SituacaoPill situacao={proj.situacao} />}
      {proj?.responsaveis.map(r => <span key={r} className="rounded-full border border-border/70 bg-card px-2 py-0.5 text-[11px] font-medium">{r}</span>)}
      {podeEditar
        ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><Pencil className="h-3 w-3" />Você pode mudar o status</span>
        : <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"><Eye className="h-3 w-3" />Somente leitura</span>}
    </>
  );
  const cabecalho = <GoCabecalho voltar={{ to: GO_BASE, label: "Hub de Grandes Operações" }} titulo={dados ? titulo : "Grandes Operações"} sub={dados ? sub : "Carregando…"} meta={meta} />;

  if (!dados) {
    return (
      <div className="flex flex-col gap-5">
        {cabecalho}
        {erro ? <GoErro erro={erro} onTentar={recarregar} /> : (
          <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[76px] rounded-xl" />)}</div>
            <div className="flex flex-col gap-4"><Skeleton className="h-80 rounded-2xl" /><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></div>
          </div>
        )}
      </div>
    );
  }

  const projsEscopo = cliId === "todos" ? dados.projetos : projsDoCliente(dados, cliId);
  const escopo = atvsDe(dados, proj ? [proj.id] : projsEscopo.map(p => p.id));
  const opcoesResp = respOptions(dados, proj ? [proj] : projsEscopo);
  const respSel = opcoesResp.includes(resp) ? resp : "all";
  const visiveis = escopo.filter(a => matchResp(a, respSel) && matchQ(dados, a, q.trim()));
  const rel = relDe(dados, act);
  const filtrando = respSel !== "all" || !!q.trim();

  /** Grava "de → para" (a tela já mostra o novo status); dá para desfazer pelo aviso. */
  const trocar = (id: number, codigo: string, de: GoCamposStatus, para: GoCamposStatus, aviso?: { texto: string; atencao: boolean }, desfazivel = true) => {
    atualizar(d => comAtividade(d, id, para));
    gravarStatus(id, de, para).then(r => {
      if (r.ok) {
        atualizar(d => comAtividade(d, id, r.campos));
        if (!desfazivel) { toast.success(`Desfeito: ${codigo} voltou para ${STATUS_NOME[para.status]}`); return; }
        const opcoes = { description: aviso?.texto, action: { label: "Desfazer", onClick: () => trocar(id, codigo, { status: r.campos.status, data_realizada: r.campos.data_realizada }, de, undefined, false) } };
        if (aviso?.atencao) toast.warning(`${codigo} · ${STATUS_NOME[para.status]}`, opcoes); else toast.success(`${codigo} · ${STATUS_NOME[para.status]}`, opcoes);
        return;
      }
      // sem strictNullChecks o `ok` não separa os dois lados sozinho
      const falha = r as Extract<ResultadoStatus, { ok: false }>;
      atualizar(d => comAtividade(d, id, falha.atual ?? de));
      if (falha.motivo === "conflito") {
        toast.error("Outra pessoa mudou esta atividade antes. Sua alteração não foi gravada.", {
          description: falha.atual ? `${codigo} está ${STATUS_NOME[falha.atual.status]} agora. Confira e refaça se ainda quiser.` : `${codigo} não existe mais.`,
        });
      } else toast.error("O banco não aceitou a mudança: seu acesso não permite editar o Hub.");
    }).catch(err => {
      atualizar(d => comAtividade(d, id, de));
      toast.error(`Não foi possível mudar o status de ${codigo}.`, { description: errorMessage(err) });
    });
  };
  const mudarStatus = (id: number, status: GoStatus) => {
    const a = dados.act.get(id);
    if (!a || a.status === status || !podeEditar) return;
    const de: GoCamposStatus = { status: a.status, data_realizada: a.data_realizada }, para = camposParaStatus(de, status);
    const abertas = status === "concluido" ? predsAbertas(dados, a) : [];
    const aviso = abertas.length ? { texto: `Concluída antes de ${abertas.map(p => p.codigo).join(", ")}, que vem antes. Confira a ligação.`, atencao: true }
      : status === "removido" ? { texto: "Ela sai da conta do progresso.", atencao: false }
      : para.data_realizada !== de.data_realizada ? { texto: `Realizado em ${fmtD(para.data_realizada)}.`, atencao: false } : undefined;
    trocar(id, a.codigo, de, para, aviso);
  };
  const selecionar = (id: number) => setAct(cur => (cur === id ? null : id));

  return (
    <div className="flex flex-col gap-5">
      {cabecalho}

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <LateralGO dados={dados} cliId={cliId} projetos={projsEscopo} projAtual={proj} onCliente={v => navigate(urlCliente(v === "todos" ? "todos" : Number(v)))} />

        <div className="flex min-w-0 flex-col gap-4">
          <SaudeGO dados={dados} escopo={escopo} projetos={proj ? [proj] : projsEscopo} umProjeto={!!proj} onSelect={id => setAct(id)} etapa={etapa} onEtapa={setEtapa} />

          {/* busca, responsável e visão */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
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
          {filtrando && (
            <p className="-mt-2 text-[12px] text-muted-foreground">
              Filtro ativo: mostrando {visiveis.length} de {escopo.length} atividades. <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setQ(""); setResp("all"); }}>Limpar</button>
            </p>
          )}

          {visao === "quadro" && <QuadroGO dados={dados} visiveis={visiveis} act={act} onSelect={selecionar} etapa={etapa} onEtapa={setEtapa} mostrarProjeto={!proj} rel={rel}
            podeEditar={podeEditar} onStatus={mudarStatus} previsao={previsao} />}
          {visao === "etapas" && <EtapasGO dados={dados} visiveis={visiveis} act={act} onSelect={selecionar} umProjeto={!!proj} rel={rel} podeEditar={podeEditar} onStatus={mudarStatus} />}
          {visao === "gantt" && <GanttGO dados={dados} visiveis={visiveis} act={act} onSelect={id => setAct(id)} rel={rel} />}
        </div>
      </div>

      <DetalheGO dados={dados} act={act} onSelect={id => setAct(id)} onFechar={fechar} podeEditar={podeEditar} onStatus={mudarStatus} />
    </div>
  );
}
