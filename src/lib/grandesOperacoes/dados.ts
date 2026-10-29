// Hub de Grandes Operações (Gestão Operacional): os dados e as consultas da tela, traduzidos do
// app.js do sistema original. Hierarquia: cliente → projeto → etapa → atividade.
import { supabase } from "@/integrations/supabase/client";
import { chaveCodigo } from "@/lib/grandesOperacoes/previsao";

export type GoStatus = "espera" | "andamento" | "concluido" | "removido";
export type GoSituacao = "ativo" | "pausado" | "encerrado";

export interface GoCliente { id: number; nome: string; local: string; ordem: number }
export interface GoProjeto {
  id: number; cliente_id: number; nome: string; curto: string; situacao: GoSituacao;
  sequenciar_automatico: boolean; ordem: number;
  /** Nomes individuais do projeto (Transdata, o cliente, um parceiro…), na ordem cadastrada. */
  responsaveis: string[];
}
export interface GoEtapa { id: number; projeto_id: number; nome: string; ordem: number }
export interface GoObservacao { id: number; data: string | null; texto: string; ordem: number }
export interface GoAtividade {
  id: number; projeto_id: number; etapa_id: number; codigo: string; titulo: string;
  /** Texto livre com combinações ("Transdata + Cliente", "Todos"): não normalizar. */
  responsavel: string; objetivo: string;
  /** Texto livre ("2 dias"); a previsão usa o primeiro número. */
  duracao: string;
  data_prevista: string | null; data_realizada: string | null; status: GoStatus; ordem: number; atualizado_em: string;
  predecessoras: number[];
  observacoes: GoObservacao[];
}

export const STATUS_NOME: Record<GoStatus, string> = { espera: "Em espera", andamento: "Em andamento", concluido: "Concluído", removido: "Removido" };
/** Ordem dos status no seletor, a mesma do sistema original. */
export const STATUS_ORDEM: GoStatus[] = ["espera", "andamento", "concluido", "removido"];
export const SITUACAO_NOME: Record<GoSituacao, string> = { ativo: "Ativo", pausado: "Pausado", encerrado: "Encerrado" };

/** Os dados do Hub, já ordenados e indexados. */
export interface GoDados {
  clientes: GoCliente[];
  /** Na ordem cadastrada: ordem do cliente, depois a do projeto. */
  projetos: GoProjeto[];
  etapas: GoEtapa[];
  /** Projetos pela ordem cadastrada; dentro do projeto, pelo código. */
  atividades: GoAtividade[];
  cli: Map<number, GoCliente>;
  proj: Map<number, GoProjeto>;
  etapa: Map<number, GoEtapa>;
  act: Map<number, GoAtividade>;
  /** Quem depende de cada atividade (sucessoras). */
  succ: Map<number, number[]>;
}

const porOrdem = <T extends { ordem: number; id: number }>(a: T, b: T) => a.ordem - b.ordem || a.id - b.id;

/** Ordena e indexa o que veio do banco (a mesma ordem do sistema original). */
export function indexar(clientes: GoCliente[], projetos: GoProjeto[], etapas: GoEtapa[], atividades: GoAtividade[]): GoDados {
  const cs = clientes.slice().sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  const ordemCli = new Map(cs.map((c, i) => [c.id, i]));
  const ps = projetos.slice().sort((a, b) => (ordemCli.get(a.cliente_id) ?? 1e9) - (ordemCli.get(b.cliente_id) ?? 1e9) || porOrdem(a, b));
  const rank = new Map(ps.map((p, i) => [p.id, i]));
  const as = atividades.slice().sort((a, b) =>
    (rank.get(a.projeto_id) ?? 1e9) - (rank.get(b.projeto_id) ?? 1e9) || chaveCodigo(a.codigo).localeCompare(chaveCodigo(b.codigo)));
  const succ = new Map<number, number[]>();
  as.forEach(a => a.predecessoras.forEach(p => succ.set(p, [...(succ.get(p) ?? []), a.id])));
  return {
    clientes: cs, projetos: ps, etapas, atividades: as,
    cli: new Map(cs.map(c => [c.id, c])), proj: new Map(ps.map(p => [p.id, p])),
    etapa: new Map(etapas.map(e => [e.id, e])), act: new Map(as.map(a => [a.id, a])), succ,
  };
}

// tabelas go_ ainda fora do types.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Lê tudo o que a tela usa (o volume é pequeno: dezenas de projetos, centenas de atividades). */
export async function fetchGoDados(): Promise<GoDados> {
  const [c, p, e, a] = await Promise.all([
    db.from("go_clientes").select("id, nome, local, ordem"),
    db.from("go_projetos").select("id, cliente_id, nome, curto, situacao, sequenciar_automatico, ordem, go_projeto_responsaveis(nome, ordem)"),
    db.from("go_etapas").select("id, projeto_id, nome, ordem"),
    db.from("go_atividades").select(
      "id, projeto_id, etapa_id, codigo, titulo, responsavel, objetivo, duracao, data_prevista, data_realizada, status, ordem, atualizado_em, "
      + "go_predecessoras!atividade_id(predecessora_id), go_observacoes(id, data, texto, ordem)"),
  ]);
  const erro = c.error ?? p.error ?? e.error ?? a.error;
  if (erro) throw erro;
  type ProjetoBanco = Omit<GoProjeto, "responsaveis"> & { go_projeto_responsaveis?: { nome: string; ordem: number }[] };
  type AtividadeBanco = Omit<GoAtividade, "predecessoras" | "observacoes"> & {
    go_predecessoras?: { predecessora_id: number }[]; go_observacoes?: GoObservacao[];
  };
  const projetos = ((p.data ?? []) as ProjetoBanco[]).map(({ go_projeto_responsaveis: rs, ...x }) => ({
    ...x, responsaveis: (rs ?? []).slice().sort((r1, r2) => r1.ordem - r2.ordem).map(r => r.nome),
  }));
  const atividades = ((a.data ?? []) as AtividadeBanco[]).map(({ go_predecessoras: ps, go_observacoes: os, ...x }) => ({
    ...x, predecessoras: (ps ?? []).map(r => r.predecessora_id),
    observacoes: (os ?? []).slice().sort((o1, o2) => o1.ordem - o2.ordem || o1.id - o2.id),
  }));
  return indexar(c.data ?? [], projetos, e.data ?? [], atividades);
}

/** Quem pode gravar no Hub: a mesma função do banco que protege as tabelas (RLS). */
export async function fetchPodeEditar(): Promise<boolean> {
  const { data, error } = await db.rpc("go_pode", { _acao: "edit" });
  return !error && data === true;
}

/* ─── Troca de status ─── */

/** O que a troca de status muda na atividade. */
export type GoCamposStatus = Pick<GoAtividade, "status" | "data_realizada">;

/** Como no original: concluir sem "Realizado em" grava a data de hoje; os outros status mantêm a data. */
export const camposParaStatus = (a: GoCamposStatus, status: GoStatus, hoje = hojeTexto()): GoCamposStatus =>
  ({ status, data_realizada: status === "concluido" && !a.data_realizada ? hoje : a.data_realizada });

/** Os dados com uma atividade alterada (a tela troca o status antes de o banco responder). */
export const comAtividade = (d: GoDados, id: number, campos: Partial<GoAtividade>): GoDados =>
  indexar(d.clientes, d.projetos, d.etapas, d.atividades.map(a => (a.id === id ? { ...a, ...campos } : a)));

export type ResultadoStatus =
  | { ok: true; campos: GoCamposStatus & { atualizado_em: string } }
  /** conflito: outra pessoa mudou antes (`atual` é o que está gravado); sem-permissao: o banco recusou */
  | { ok: false; motivo: "conflito" | "sem-permissao"; atual: GoCamposStatus | null };

/**
 * Troca o status "de → para", como no sistema original: só grava se no banco ainda estiver o que a
 * tela mostrava (o status e, quando muda junto, o "Realizado em").
 */
export async function gravarStatus(id: number, de: GoCamposStatus, para: GoCamposStatus): Promise<ResultadoStatus> {
  const mudaData = (para.data_realizada ?? null) !== (de.data_realizada ?? null);
  let q = db.from("go_atividades").update(mudaData ? para : { status: para.status }).eq("id", id).eq("status", de.status);
  if (mudaData) q = de.data_realizada ? q.eq("data_realizada", de.data_realizada) : q.is("data_realizada", null);
  const { data, error } = await q.select("status, data_realizada, atualizado_em");
  if (error) throw error;
  if (data?.length) return { ok: true, campos: data[0] };
  // nada gravado: ou mudou no banco, ou a pessoa não pode editar (o RLS só não acha a linha)
  const { data: atual, error: e2 } = await db.from("go_atividades").select("status, data_realizada").eq("id", id).maybeSingle();
  if (e2) throw e2;
  const mudou = !atual || atual.status !== de.status || (mudaData && (atual.data_realizada ?? null) !== (de.data_realizada ?? null));
  return { ok: false, motivo: mudou ? "conflito" : "sem-permissao", atual: atual ?? null };
}

/* ─── Consultas sobre os dados carregados ─── */

/** Busca que ignora acento e maiúscula ("integracao" acha "Integração"). */
export const norm = (s: string | null | undefined) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** "AAAA-MM-DD" → dd/mm/aaaa */
export const fmtD = (s: string | null | undefined) => { const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (s ?? ""); };
/** Número da etapa pelo código da atividade (1.4.6 → 1.4). */
export const etapaNum = (cod: string) => String(cod || "").split(".").slice(0, 2).join(".");
/** Nível de subatividade (1.4.6.1 → 1). */
export const subLevel = (cod: string) => Math.max(0, String(cod || "").split(".").length - 3);
export const nomeCurto = (p: GoProjeto | undefined) => (p && (p.curto || p.nome)) || "";
export const hojeTexto = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export const projsDoCliente = (d: GoDados, id: number) => d.projetos.filter(p => p.cliente_id === id);
export const atvsDe = (d: GoDados, projIds: number[]) => { const s = new Set(projIds); return d.atividades.filter(a => s.has(a.projeto_id)); };
export const etapaNome = (d: GoDados, a: GoAtividade) => d.etapa.get(a.etapa_id)?.nome ?? "";

export interface GoStats { total: number; done: number; doing: number; wait: number; removed: number; pct: number }
/** Removidas não entram na conta. */
export function stats(list: GoAtividade[]): GoStats {
  const act = list.filter(a => a.status !== "removido");
  const done = act.filter(a => a.status === "concluido").length, doing = act.filter(a => a.status === "andamento").length;
  return { total: act.length, done, doing, wait: act.length - done - doing, removed: list.length - act.length, pct: act.length ? Math.round((done / act.length) * 100) : 0 };
}
export const resumo = (s: GoStats) => (s.total ? `${s.done} de ${s.total} concluídas${s.doing ? ` · ${s.doing} em andamento` : ""}` : "sem atividades ainda");

export interface GoEtapaLista { key: number; nome: string; projeto_id: number; num: string; acts: GoAtividade[] }
/** Etapas na ordem em que aparecem na lista (que já vem ordenada pelo código). */
export function etapasOf(d: GoDados, list: GoAtividade[]): GoEtapaLista[] {
  const map = new Map<number, GoEtapaLista>();
  list.forEach(a => {
    if (!map.has(a.etapa_id)) map.set(a.etapa_id, { key: a.etapa_id, nome: etapaNome(d, a), projeto_id: a.projeto_id, num: etapaNum(a.codigo), acts: [] });
    map.get(a.etapa_id)!.acts.push(a);
  });
  return Array.from(map.values());
}
export function etapaStatus(acts: GoAtividade[]): GoStatus {
  const l = acts.filter(a => a.status !== "removido");
  if (!l.length) return "removido";
  if (l.every(a => a.status === "concluido")) return "concluido";
  if (l.some(a => a.status === "andamento" || a.status === "concluido")) return "andamento";
  return "espera";
}

const porCodigo = (x: GoAtividade, y: GoAtividade) => chaveCodigo(x.codigo).localeCompare(chaveCodigo(y.codigo));
export const predOf = (d: GoDados, a: GoAtividade) => a.predecessoras.map(id => d.act.get(id)).filter((x): x is GoAtividade => !!x).sort(porCodigo);
export const succOf = (d: GoDados, a: GoAtividade) => (d.succ.get(a.id) ?? []).map(id => d.act.get(id)).filter((x): x is GoAtividade => !!x);
/** Tudo o que vem antes (em cadeia) e ainda não foi concluído. */
export function openUpstream(d: GoDados, a: GoAtividade): GoAtividade[] {
  const out: GoAtividade[] = [], seen = new Set<number>();
  const walk = (x: GoAtividade) => predOf(d, x).forEach(p => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    if (p.status !== "concluido" && p.status !== "removido") out.push(p);
    walk(p);
  });
  walk(a);
  return out.sort(porCodigo);
}

/** Predecessoras diretas que ainda não foram concluídas (nem removidas). */
export const predsAbertas = (d: GoDados, a: GoAtividade) => predOf(d, a).filter(p => p.status !== "concluido" && p.status !== "removido");
/** Em espera e sem nada pendente antes dela: pode começar. */
export const podeComecar = (d: GoDados, a: GoAtividade) => a.status === "espera" && !predsAbertas(d, a).length;

/** O que vem antes (pred) e depois (succ) da atividade selecionada, e as etapas delas (para destacar). */
export interface GoRel { pred: Set<number>; succ: Set<number>; etHl: Set<number> }
export function relDe(d: GoDados, actId: number | null): GoRel {
  const pred = new Set<number>(), succ = new Set<number>(), etHl = new Set<number>();
  const a = actId != null ? d.act.get(actId) : undefined;
  if (a) {
    predOf(d, a).forEach(p => { pred.add(p.id); etHl.add(p.etapa_id); });
    succOf(d, a).forEach(s => { succ.add(s.id); etHl.add(s.etapa_id); });
  }
  return { pred, succ, etHl };
}

/** Filtro de responsável: a lista cadastrada nos projetos, mais os valores já usados nas atividades deles. */
export function respOptions(d: GoDados, ps: GoProjeto[]): string[] {
  const out: string[] = [];
  const add = (x: string) => { if (x && !out.includes(x)) out.push(x); };
  ps.forEach(p => p.responsaveis.forEach(add));
  ps.forEach(p => Array.from(new Set(atvsDe(d, [p.id]).map(a => a.responsavel).filter(Boolean))).sort((x, y) => x.localeCompare(y)).forEach(add));
  return out;
}
/** "Com Cliente" pega "Transdata + Cliente" e também as atividades de "Todos". */
export const matchResp = (a: GoAtividade, resp: string) => {
  if (resp === "all") return true;
  const r = norm(a.responsavel);
  return r.includes(norm(resp)) || r === "todos";
};
export const matchQ = (d: GoDados, a: GoAtividade, q: string) => {
  if (!q) return true;
  return norm([a.codigo, a.titulo, a.objetivo, a.responsavel, etapaNome(d, a), ...a.observacoes.map(o => o.texto)].join(" ")).includes(norm(q));
};

/* ─── Hub ─── */

/** ativos = ativos e pausados (o padrão). */
export type FiltroSituacao = "ativos" | "ativo" | "pausado" | "encerrado" | "todos";
export interface FiltrosHub { q: string; cli: string; loc: string; sit: FiltroSituacao }
export const FILTROS_HUB_PADRAO: FiltrosHub = { q: "", cli: "all", loc: "all", sit: "ativos" };

export function hubProjects(d: GoDados, f: FiltrosHub): GoProjeto[] {
  const q = norm(f.q);
  return d.projetos.filter(p => {
    const c = d.cli.get(p.cliente_id);
    if (f.cli !== "all" && String(p.cliente_id) !== f.cli) return false;
    if (f.loc !== "all" && (c?.local || "") !== f.loc) return false;
    if (f.sit === "ativos" && p.situacao === "encerrado") return false;
    if (f.sit !== "ativos" && f.sit !== "todos" && p.situacao !== f.sit) return false;
    if (q && !norm([p.nome, p.curto, c?.nome, c?.local].join(" ")).includes(q)) return false;
    return true;
  });
}

/** Clientes com os projetos que passam nos filtros (cliente sem projeto aparece sem busca nem situação específica). */
export function hubGrupos(d: GoDados, f: FiltrosHub) {
  const ps = hubProjects(d, f);
  const showEmpty = !f.q && (f.sit === "ativos" || f.sit === "todos");
  const grupos = d.clientes
    .filter(c => (f.cli === "all" || f.cli === String(c.id)) && (f.loc === "all" || c.local === f.loc))
    .map(c => ({ c, ps: ps.filter(p => p.cliente_id === c.id) }))
    .filter(g => g.ps.length || (showEmpty && !projsDoCliente(d, g.c.id).length));
  return { ps, grupos };
}
