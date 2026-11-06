// Hub de Grandes Operações (Gestão Operacional): os dados e as consultas da tela, traduzidos do
// app.js do sistema original. Hierarquia: cliente → projeto → etapa → atividade.
import { supabase } from "@/integrations/supabase/client";
import { chaveCodigo } from "@/lib/grandesOperacoes/previsao";
import { errorMessage } from "@/lib/implantationScheduling";

export type GoStatus = "espera" | "andamento" | "concluido" | "removido";
export type GoSituacao = "ativo" | "pausado" | "encerrado";

export interface GoCliente { id: number; nome: string; local: string; ordem: number }
/** Pessoa do projeto (do cliente, da Transdata, de um parceiro): é quem pode ser responsável das atividades. */
export interface GoStakeholder { id: number; nome: string; empresa: string; ordem: number }
export interface GoProjeto {
  id: number; cliente_id: number; nome: string; curto: string; situacao: GoSituacao;
  sequenciar_automatico: boolean; ordem: number;
  /** Projeto do cadastro do portal que trouxe este para o Hub (null: projeto do Hub antigo). */
  project_id: string | null;
  /** Nomes individuais do projeto (Transdata, o cliente, um parceiro…), na ordem cadastrada. */
  responsaveis: string[];
  stakeholders: GoStakeholder[];
}
export interface GoEtapa { id: number; projeto_id: number; nome: string; ordem: number }
/** Observação da atividade; as da planilha antiga não têm hora nem autor (`criado_em` null). */
export interface GoObservacao { id: number; data: string | null; texto: string; ordem: number; criado_em: string | null; autor_nome: string }
/** Registro do acompanhamento de uma etapa (histórico: não muda depois de gravado). */
export interface GoObsEtapa { id: number; etapa_id: number; texto: string; criado_em: string; autor_nome: string }
export interface GoAtividade {
  id: number; projeto_id: number; etapa_id: number; codigo: string; titulo: string;
  /**
   * Texto livre com combinações ("Transdata + Cliente", "Todos"): não normalizar. Com stakeholders,
   * o banco monta o texto a partir deles ("Ana Lima (ENBI) + João (Transdata)").
   */
  responsavel: string; objetivo: string;
  /** Texto livre ("2 dias"); a previsão usa o primeiro número. */
  duracao: string;
  data_prevista: string | null; data_realizada: string | null; status: GoStatus; ordem: number; atualizado_em: string;
  predecessoras: number[];
  observacoes: GoObservacao[];
  /** Stakeholders responsáveis (ids); vazio nas atividades antigas, que só têm o texto. */
  stakeholders: number[];
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
  /** Acompanhamento de cada etapa, o mais recente primeiro. */
  obsEtapa: Map<number, GoObsEtapa[]>;
  /** Gerente de Projetos cujos projetos do portal entram no Hub (null: nenhum). */
  gerenteId: string | null;
}

const porOrdem = <T extends { ordem: number; id: number }>(a: T, b: T) => a.ordem - b.ordem || a.id - b.id;

/** Ordena e indexa o que veio do banco (a mesma ordem do sistema original). */
export function indexar(clientes: GoCliente[], projetos: GoProjeto[], etapas: GoEtapa[], atividades: GoAtividade[],
  extras: Partial<Pick<GoDados, "obsEtapa" | "gerenteId">> = {}): GoDados {
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
    obsEtapa: extras.obsEtapa ?? new Map(), gerenteId: extras.gerenteId ?? null,
  };
}

// tabelas go_ ainda fora do types.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Lê tudo o que a tela usa (o volume é pequeno: dezenas de projetos, centenas de atividades). */
export async function fetchGoDados(): Promise<GoDados> {
  const [c, p, e, a, o, cfg] = await Promise.all([
    db.from("go_clientes").select("id, nome, local, ordem"),
    db.from("go_projetos").select(
      "id, cliente_id, nome, curto, situacao, sequenciar_automatico, ordem, project_id, go_projeto_responsaveis(nome, ordem), go_stakeholders(id, nome, empresa, ordem)"),
    db.from("go_etapas").select("id, projeto_id, nome, ordem"),
    db.from("go_atividades").select(
      "id, projeto_id, etapa_id, codigo, titulo, responsavel, objetivo, duracao, data_prevista, data_realizada, status, ordem, atualizado_em, "
      + "go_predecessoras!atividade_id(predecessora_id), go_observacoes(id, data, texto, ordem, criado_em, autor_nome), go_atividade_stakeholders(stakeholder_id)"),
    db.from("go_etapa_observacoes").select("id, etapa_id, texto, criado_em, autor_nome").order("criado_em", { ascending: false }).order("id", { ascending: false }),
    db.from("go_config").select("gerente_id").maybeSingle(),
  ]);
  const erro = c.error ?? p.error ?? e.error ?? a.error ?? o.error ?? cfg.error;
  if (erro) throw erro;
  type ProjetoBanco = Omit<GoProjeto, "responsaveis" | "stakeholders"> & {
    go_projeto_responsaveis?: { nome: string; ordem: number }[]; go_stakeholders?: GoStakeholder[];
  };
  type AtividadeBanco = Omit<GoAtividade, "predecessoras" | "observacoes" | "stakeholders"> & {
    go_predecessoras?: { predecessora_id: number }[]; go_observacoes?: GoObservacao[]; go_atividade_stakeholders?: { stakeholder_id: number }[];
  };
  const projetos = ((p.data ?? []) as ProjetoBanco[]).map(({ go_projeto_responsaveis: rs, go_stakeholders: ss, ...x }) => ({
    ...x, responsaveis: (rs ?? []).slice().sort((r1, r2) => r1.ordem - r2.ordem).map(r => r.nome),
    stakeholders: (ss ?? []).slice().sort(porOrdem),
  }));
  const atividades = ((a.data ?? []) as AtividadeBanco[]).map(({ go_predecessoras: ps, go_observacoes: os, go_atividade_stakeholders: ls, ...x }) => ({
    ...x, predecessoras: (ps ?? []).map(r => r.predecessora_id),
    observacoes: (os ?? []).slice().sort((o1, o2) => o1.ordem - o2.ordem || o1.id - o2.id),
    stakeholders: (ls ?? []).map(l => l.stakeholder_id),
  }));
  const obsEtapa = new Map<number, GoObsEtapa[]>();
  ((o.data ?? []) as GoObsEtapa[]).forEach(x => obsEtapa.set(x.etapa_id, [...(obsEtapa.get(x.etapa_id) ?? []), x]));
  return indexar(c.data ?? [], projetos, e.data ?? [], atividades, { obsEtapa, gerenteId: cfg.data?.gerente_id ?? null });
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
  indexar(d.clientes, d.projetos, d.etapas, d.atividades.map(a => (a.id === id ? { ...a, ...campos } : a)), d);

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

/* ─── Cadastros pela tela ─── */

/** O que a tela manda para criar (sem id) ou editar uma atividade. */
export interface GoAtividadeForm {
  id?: number; projeto_id: number;
  /** Etapa existente ou, com `etapa_nova`, uma etapa criada junto. */
  etapa_id: number | null; etapa_nova?: string;
  codigo: string; titulo: string; objetivo: string; duracao: string; data_prevista: string | null;
  predecessoras: number[]; dependentes: number[];
  /** Sem a lista, a atividade antiga mantém o texto de responsável da planilha. */
  responsaveis?: number[];
}

/** Cria ou edita a atividade numa gravação só (etapa nova, responsáveis, predecessoras e dependentes). */
export async function salvarAtividade(f: GoAtividadeForm): Promise<number> {
  const { data, error } = await db.rpc("go_salvar_atividade", { _a: f });
  if (error) throw error;
  return data as number;
}

export async function registrarAcompanhamento(etapaId: number, texto: string): Promise<GoObsEtapa> {
  // data, hora e autor o banco preenche
  const { data, error } = await db.from("go_etapa_observacoes").insert({ etapa_id: etapaId, texto: texto.trim() })
    .select("id, etapa_id, texto, criado_em, autor_nome").single();
  if (error) throw error;
  return data as GoObsEtapa;
}
/** Os dados com um registro novo no acompanhamento da etapa (no topo). */
export const comObsEtapa = (d: GoDados, o: GoObsEtapa): GoDados =>
  ({ ...d, obsEtapa: new Map(d.obsEtapa).set(o.etapa_id, [o, ...(d.obsEtapa.get(o.etapa_id) ?? [])]) });

export async function registrarObservacao(atividadeId: number, texto: string): Promise<GoObservacao> {
  // data, hora, autor e posição o banco preenche
  const { data, error } = await db.from("go_observacoes").insert({ atividade_id: atividadeId, texto: texto.trim() })
    .select("id, data, texto, ordem, criado_em, autor_nome").single();
  if (error) throw error;
  return data as GoObservacao;
}
/** Os dados com uma observação nova na atividade (no fim, como a ordem do banco). */
export const comObservacao = (d: GoDados, atividadeId: number, o: GoObservacao): GoDados =>
  comAtividade(d, atividadeId, { observacoes: [...(d.act.get(atividadeId)?.observacoes ?? []), o] });

/** "06/11/2026 às 15:20" no horário de quem está vendo. */
export const quandoGo = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

export async function salvarStakeholder(projetoId: number, s: { id?: number; nome: string; empresa: string; ordem: number }): Promise<void> {
  const campos = { nome: s.nome.trim(), empresa: s.empresa.trim(), ordem: s.ordem };
  const { error } = s.id
    ? await db.from("go_stakeholders").update(campos).eq("id", s.id)
    : await db.from("go_stakeholders").insert({ ...campos, projeto_id: projetoId });
  if (error) throw error;
}
export async function removerStakeholder(id: number): Promise<void> {
  const { error } = await db.from("go_stakeholders").delete().eq("id", id);
  if (error) throw error;
}

export async function salvarNomeProjeto(id: number, nome: string, curto: string): Promise<void> {
  const { error } = await db.from("go_projetos").update({ nome: nome.trim(), curto: curto.trim() }).eq("id", id);
  if (error) throw error;
}

/** Gerentes de Projetos ativos na Equipe (para escolher o de Grandes Operações). */
export async function fetchGerentesProjetos(): Promise<{ id: string; full_name: string }[]> {
  const { data, error } = await supabase.from("team_members").select("id, full_name").eq("role", "gerente_projetos").eq("active", true).order("full_name");
  if (error) throw error;
  return data ?? [];
}
/** Escolhe o gerente de Grandes Operações; devolve quantos projetos do portal ficaram no Hub. */
export async function definirGerente(id: string | null): Promise<number> {
  const { data, error } = await db.rpc("go_definir_gerente", { _gerente: id });
  if (error) throw error;
  return data as number;
}

/** Erro do banco numa frase para a tela (as regras do banco já escrevem em português). */
export function mensagemGo(err: unknown): string {
  const m = errorMessage(err);
  if (m.includes("go_uq_atividades_codigo")) return "Já existe uma atividade com esse código neste projeto.";
  if (m.includes("go_uq_etapas_projeto_nome")) return "Já existe uma etapa com esse nome neste projeto.";
  if (m.includes("go_uq_stakeholders_nome")) return "Já existe um stakeholder com esse nome neste projeto.";
  if (m.includes("go_ck_atividades_codigo")) return "O código precisa ser números separados por ponto (ex.: 1.2.3).";
  if (m.includes("row-level security") || m.includes("permission denied")) return "Seu acesso não permite editar o Hub.";
  return m;
}

/**
 * Código sugerido para uma atividade nova: o próximo da etapa (1.4.6 → 1.4.7) ou, numa etapa sem
 * atividades, o primeiro de uma etapa nova do projeto (1.5.1).
 */
export function sugerirCodigo(d: GoDados, projetoId: number, etapaId: number | null): string {
  const doProj = d.atividades.filter(a => a.projeto_id === projetoId);
  const segs = (c: string) => c.split(".").map(Number);
  const daEtapa = etapaId != null ? doProj.filter(a => a.etapa_id === etapaId) : [];
  if (daEtapa.length) {
    const num = etapaNum(daEtapa[0].codigo);
    const ult = Math.max(0, ...daEtapa.filter(a => etapaNum(a.codigo) === num).map(a => segs(a.codigo)[2] || 0));
    return `${num}.${ult + 1}`;
  }
  const primeiro = doProj.length ? segs(doProj[0].codigo)[0] || 1 : 1;
  const ultEtapa = Math.max(0, ...doProj.filter(a => segs(a.codigo)[0] === primeiro).map(a => segs(a.codigo)[1] || 0));
  return `${primeiro}.${ultEtapa + 1}.1`;
}
export const CODIGO_VALIDO = /^[0-9]+(\.[0-9]+)*$/;

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

/**
 * Filtro de responsável: a lista cadastrada nos projetos, as empresas e os nomes dos stakeholders, e
 * os textos das atividades antigas (sem stakeholders).
 */
export function respOptions(d: GoDados, ps: GoProjeto[]): string[] {
  const out: string[] = [];
  const add = (x: string) => { if (x && !out.includes(x)) out.push(x); };
  ps.forEach(p => p.responsaveis.forEach(add));
  ps.forEach(p => p.stakeholders.forEach(s => add(s.empresa.trim())));
  ps.forEach(p => p.stakeholders.forEach(s => add(s.nome)));
  ps.forEach(p => Array.from(new Set(atvsDe(d, [p.id]).filter(a => !a.stakeholders.length).map(a => a.responsavel).filter(Boolean)))
    .sort((x, y) => x.localeCompare(y)).forEach(add));
  return out;
}
/** Stakeholders responsáveis pela atividade, na ordem do projeto. */
export const responsaveisDe = (d: GoDados, a: GoAtividade): GoStakeholder[] =>
  (d.proj.get(a.projeto_id)?.stakeholders ?? []).filter(s => a.stakeholders.includes(s.id));
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
