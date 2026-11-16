// Gerenciamento · módulo 04: entrega de cartões e equipamentos. Três etapas em sequência
// (cartões para AP → AP entrega para AT → despacho e entrega dos equipamentos), executadas por
// outras áreas e acompanhadas pelo GP. Cada etapa tem a sua situação, prazo, evidências e
// histórico (só de inclusão: nada é apagado nem sobrescrito).
import { supabase } from "@/integrations/supabase/client";
import type { Atividade, SituacaoAtividade } from "@/lib/gerenciamento";

export type EtapaId04 = "cartoesAp" | "apAt" | "equipamentos";
export const ETAPAS_04: EtapaId04[] = ["cartoesAp", "apAt", "equipamentos"];

/** Cores das situações: cinza (não iniciado), azul (em andamento), amarelo (aguardando ação ou
 * confirmação), verde (concluído) e vermelho (atrasado, problema ou pendência). */
export type Cor = "cinza" | "azul" | "amarelo" | "verde" | "vermelho";

export const MODULO_04 = {
  numero: "04",
  nome: "Entrega de cartões e equipamentos",
  resumo: "Os cartões vão para AP, AP entrega para AT e os equipamentos são despachados. Quem executa são as áreas; o GP acompanha os prazos, as pendências e as evidências.",
  atividades: [
    { id: "cartoesAp", titulo: "Entrega dos cartões para AP", descricao: "Controle a preparação e a entrega dos cartões para AP.", responsavel: "assistente" },
    { id: "apAt", titulo: "AP entrega os cartões para AT", descricao: "Confirme se AP entregou os cartões para AT, de preferência pelo Sistema de Pedidos.", responsavel: "area", executante: "AP" },
    { id: "equipamentos", titulo: "Acompanhar entrega dos equipamentos", descricao: "Acompanhe o despacho e a entrega dos equipamentos necessários à continuidade do projeto.", responsavel: "area", executante: "AT / despacho" },
  ] as Atividade<EtapaId04>[],
};
export const tituloEtapa = (id: EtapaId04) => MODULO_04.atividades.find(a => a.id === id)!.titulo;

/* ─── Situações de cada etapa ─── */

export interface StatusDef { id: string; nome: string; cor: Cor; concluido?: true }
export const STATUS_04: Record<EtapaId04, StatusDef[]> = {
  cartoesAp: [
    { id: "naoiniciado", nome: "Não iniciado", cor: "cinza" },
    { id: "preparacao", nome: "Em preparação", cor: "azul" },
    { id: "aguardandoEnvio", nome: "Aguardando envio", cor: "amarelo" },
    { id: "entregue", nome: "Entregue para AP", cor: "verde", concluido: true },
    { id: "pendencia", nome: "Pendência", cor: "vermelho" },
  ],
  apAt: [
    { id: "aguardandoAp", nome: "Aguardando AP", cor: "amarelo" },
    { id: "processamento", nome: "Em processamento", cor: "azul" },
    { id: "aguardandoConfirmacao", nome: "Aguardando confirmação", cor: "amarelo" },
    { id: "entregue", nome: "Entregue para AT", cor: "verde", concluido: true },
    { id: "pendencia", nome: "Pendência", cor: "vermelho" },
  ],
  equipamentos: [
    { id: "aguardandoSeparacao", nome: "Aguardando separação", cor: "amarelo" },
    { id: "preparacao", nome: "Em preparação", cor: "azul" },
    { id: "aguardandoDespacho", nome: "Aguardando despacho", cor: "amarelo" },
    { id: "despachado", nome: "Despachado", cor: "azul" },
    { id: "transporte", nome: "Em transporte", cor: "azul" },
    { id: "entregue", nome: "Entregue", cor: "verde", concluido: true },
    { id: "pendencia", nome: "Pendência na entrega", cor: "vermelho" },
    { id: "atrasado", nome: "Atrasado", cor: "vermelho" },
  ],
};
export const statusDef = (id: EtapaId04, s: string) => STATUS_04[id].find(x => x.id === s) ?? STATUS_04[id][0];
/** Situações do despacho em diante: a transportadora e o rastreio ficam em destaque. */
export const DESPACHADO = ["despachado", "transporte", "entregue"];

/* ─── Estado ─── */

/** Consulta ao Sistema de Pedidos (automática, quando houver integração, ou registrada à mão). */
export interface ConsultaPedido {
  em: string; por: string; numero: string; status: string;
  /** Data da consulta (AAAA-MM-DD), informada na consulta manual. */
  data: string; observacao: string; fonte: "manual" | "sistema";
}
export interface Evidencia {
  id: string;
  /** "arquivo": anexo do projeto; "email": comunicação preparada no portal; "pedido": referência ao Sistema de Pedidos. */
  tipo: "arquivo" | "email" | "pedido";
  nome: string;
  /** Caminho do anexo (bucket project-attachments), só no tipo "arquivo". */
  caminho?: string;
  em: string; por: string;
}
/** Uma linha do histórico: nunca é apagada nem alterada (o banco também barra). */
export interface Historico { em: string; por: string; etapa: EtapaId04; campo: string; de: string; para: string }

interface EtapaBase {
  status: string;
  /** Data prevista e efetiva (AAAA-MM-DD); nos equipamentos, as da entrega. */
  prevista: string; efetiva: string;
  observacoes: string;
  /** Desde quando está na situação atual (dias em aberto das pendências). */
  statusDesde: string | null;
  /** Quem marcou a conclusão, e quando. */
  concluidoEm: string | null; por: string;
}
export interface EtapaCartoesAp extends EtapaBase { quantidade: string; para: string; comunicacaoEm: string | null }
export interface EtapaApAt extends EtapaBase { pedido: string; quantidade: string; statusPedido: string; consultas: ConsultaPedido[] }
export interface EtapaEquipamentos extends EtapaBase {
  pedido: string; equipamento: string; quantidade: string; despachoPrevisto: string; despachoEfetivo: string;
  transportadora: string; rastreio: string; statusPedido: string; consultas: ConsultaPedido[];
}
export interface Modulo04Estado {
  cartoesAp: EtapaCartoesAp;
  apAt: EtapaApAt;
  equipamentos: EtapaEquipamentos;
  evidencias: Record<EtapaId04, Evidencia[]>;
  historico: Historico[];
}

const base = (status: string): EtapaBase => ({ status, prevista: "", efetiva: "", observacoes: "", statusDesde: null, concluidoEm: null, por: "" });
export const modulo04Vazio = (): Modulo04Estado => ({
  cartoesAp: { ...base("naoiniciado"), quantidade: "", para: "", comunicacaoEm: null },
  apAt: { ...base("aguardandoAp"), pedido: "", quantidade: "", statusPedido: "", consultas: [] },
  equipamentos: {
    ...base("aguardandoSeparacao"), pedido: "", equipamento: "", quantidade: "", despachoPrevisto: "", despachoEfetivo: "",
    transportadora: "", rastreio: "", statusPedido: "", consultas: [],
  },
  evidencias: { cartoesAp: [], apAt: [], equipamentos: [] },
  historico: [],
});

/** Completa com o estado vazio o que faltar no que veio do banco (o formato cresce junto com o módulo). */
export function normalizarModulo04(raw: unknown): Modulo04Estado {
  const v = modulo04Vazio();
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Modulo04Estado>;
  return {
    cartoesAp: { ...v.cartoesAp, ...r.cartoesAp },
    apAt: { ...v.apAt, ...r.apAt, consultas: [...(r.apAt?.consultas ?? [])] },
    equipamentos: { ...v.equipamentos, ...r.equipamentos, consultas: [...(r.equipamentos?.consultas ?? [])] },
    evidencias: { ...v.evidencias, ...r.evidencias },
    historico: Array.isArray(r.historico) ? r.historico : [],
  };
}

// gerenciamento_modulo04 ainda fora do types.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function fetchModulo04(projectId: string): Promise<{ estado: Modulo04Estado; salvoEm: string | null }> {
  const { data, error } = await db.from("gerenciamento_modulo04").select("estado, updated_at").eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  return { estado: normalizarModulo04(data?.estado), salvoEm: data?.updated_at ?? null };
}
export async function salvarModulo04(projectId: string, estado: Modulo04Estado): Promise<string> {
  const { data, error } = await db.from("gerenciamento_modulo04")
    .upsert({ project_id: projectId, estado }, { onConflict: "project_id" })
    .select("updated_at").single();
  if (error) throw error;
  return data.updated_at as string;
}

/* ─── Datas ─── */

const p2 = (n: number) => String(n).padStart(2, "0");
/** Hoje em AAAA-MM-DD (data local). */
export const hoje04 = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const diaUtc = (v: string) => { const [a, m, d] = v.slice(0, 10).split("-").map(Number); return Date.UTC(a, m - 1, d); };
/** Dias corridos de `de` até `ate` (AAAA-MM-DD ou ISO). */
export const diasEntre = (de: string, ate: string) => Math.round((diaUtc(ate) - diaUtc(de)) / 86_400_000);
/** "2026-11-15" → "15/11/2026" */
export const dataBr04 = (v: string | null | undefined) => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : "—");

/* ─── Regras ─── */

export const concluida = (id: EtapaId04, e: Modulo04Estado) => !!statusDef(id, e[id].status).concluido;
const anterior = (id: EtapaId04): EtapaId04 | null => ETAPAS_04[ETAPAS_04.indexOf(id) - 1] ?? null;
/** A etapa de antes ainda não terminou e esta nem começou: aparece como "Aguardando etapa anterior" (sem bloquear). */
export function aguardandoAnterior(id: EtapaId04, e: Modulo04Estado): boolean {
  const ant = anterior(id);
  return !!ant && !concluida(ant, e) && e[id].status === STATUS_04[id][0].id;
}
/** Data prevista que conta para o atraso (nos equipamentos: a entrega; sem ela, o despacho). */
export const previstaDe = (id: EtapaId04, e: Modulo04Estado) =>
  id === "equipamentos" ? e.equipamentos.prevista || e.equipamentos.despachoPrevisto : e[id].prevista;
/** Dias de atraso: hoje depois da data prevista e a etapa ainda não entregue (0 = em dia). */
export function diasAtraso(id: EtapaId04, e: Modulo04Estado, hoje = hoje04()): number {
  const p = previstaDe(id, e);
  if (!p || concluida(id, e)) return 0;
  return Math.max(0, diasEntre(p, hoje));
}

/** Situação para o progresso do projeto (trilha, cabeçalho e próximos passos). */
export function situacao04(id: EtapaId04, e: Modulo04Estado): SituacaoAtividade {
  const s = statusDef(id, e[id].status);
  if (s.concluido) return "feito";
  if (aguardandoAnterior(id, e)) return "bloqueado";
  if (s.cor === "amarelo") return "aguardando";
  return "afazer";
}

/** Cor do indicador da etapa: o atraso (vermelho) passa na frente da cor da situação. */
export function corDaEtapa(id: EtapaId04, e: Modulo04Estado, hoje = hoje04()): Cor {
  if (diasAtraso(id, e, hoje) > 0) return "vermelho";
  if (aguardandoAnterior(id, e)) return "cinza";
  return statusDef(id, e[id].status).cor;
}

/** O que fazer agora em cada etapa, pela situação. */
export function proximaAcao(id: EtapaId04, e: Modulo04Estado): string {
  const s = e[id].status;
  if (concluida(id, e)) return "Nada a fazer: etapa concluída";
  if (s === "pendencia" || s === "atrasado") return id === "equipamentos" ? "Resolver a pendência na entrega com AT" : id === "apAt" ? "Resolver a pendência com AP" : "Resolver a pendência dos cartões";
  if (id === "cartoesAp") return s === "aguardandoEnvio" ? "Enviar os cartões e a comunicação para AP" : s === "preparacao" ? "Concluir a preparação dos cartões" : "Preparar os cartões e a comunicação de entrega";
  if (id === "apAt") return s === "aguardandoConfirmacao" ? "Confirmar a entrega no Sistema de Pedidos" : "Acompanhar o pedido de AP no Sistema de Pedidos";
  if (DESPACHADO.includes(s)) return "Acompanhar a entrega pela transportadora";
  return s === "aguardandoDespacho" ? "Acompanhar despacho dos equipamentos" : "Acompanhar a separação dos equipamentos";
}

/** O que falta para marcar a etapa como concluída (as três são críticas: pedem evidência ou referência). */
export function faltaParaConcluir(id: EtapaId04, e: Modulo04Estado): string[] {
  const out: string[] = [];
  const ev = e.evidencias[id];
  if (id === "cartoesAp") {
    if (!e.cartoesAp.quantidade.trim()) out.push("quantidade de cartões");
    if (!ev.length) out.push("uma evidência (anexo ou a comunicação de entrega)");
  } else {
    if (!e[id].pedido.trim() && !ev.length) out.push("número do pedido ou uma evidência");
  }
  return out;
}

/** Nome de cada campo no histórico. */
export const CAMPOS_04: Record<string, string> = {
  status: "Situação", prevista: "Data prevista", efetiva: "Data efetiva", observacoes: "Observações", quantidade: "Quantidade",
  para: "Para (e-mail)", pedido: "Número do pedido", statusPedido: "Status do pedido", equipamento: "Equipamento",
  despachoPrevisto: "Data prevista de despacho", despachoEfetivo: "Data efetiva de despacho", transportadora: "Transportadora", rastreio: "Código de rastreamento",
};
const DATAS = ["prevista", "efetiva", "despachoPrevisto", "despachoEfetivo"];
const valorDe = (id: EtapaId04, campo: string, v: unknown) =>
  v == null || v === "" ? "—" : campo === "status" ? statusDef(id, String(v)).nome : DATAS.includes(campo) ? dataBr04(String(v)) : String(v);

/**
 * Altera campos de uma etapa e registra no histórico cada campo que mudou (de → para). Mudar a
 * situação guarda desde quando ela vale; concluir guarda quem e quando.
 */
export function alterarEtapa<K extends EtapaId04>(
  e: Modulo04Estado, id: K, patch: Partial<Modulo04Estado[K]>, por: string, agora = new Date().toISOString(),
): Modulo04Estado {
  const atual = e[id] as unknown as Record<string, unknown>;
  const linhas: Historico[] = [];
  for (const [campo, novo] of Object.entries(patch)) {
    if (!(campo in CAMPOS_04) || (atual[campo] ?? "") === (novo ?? "")) continue;
    linhas.push({ em: agora, por, etapa: id, campo: CAMPOS_04[campo], de: valorDe(id, campo, atual[campo]), para: valorDe(id, campo, novo) });
  }
  if (!linhas.length) return e;
  const extra: Partial<EtapaBase> = {};
  const novoStatus = (patch as Partial<EtapaBase>).status;
  if (novoStatus && novoStatus !== atual.status) {
    extra.statusDesde = agora;
    const fim = !!statusDef(id, novoStatus).concluido;
    extra.concluidoEm = fim ? agora : null;
    extra.por = fim ? por : "";
  }
  return { ...e, [id]: { ...e[id], ...patch, ...extra }, historico: [...e.historico, ...linhas] };
}

/** Registra no histórico um acontecimento que não é campo (evidência, comunicação, consulta). */
export function registrar(e: Modulo04Estado, id: EtapaId04, campo: string, para: string, por: string, agora = new Date().toISOString()): Modulo04Estado {
  return { ...e, historico: [...e.historico, { em: agora, por, etapa: id, campo, de: "—", para }] };
}

/* ─── Resumo, pendências ─── */

export interface Pendencia { etapa: EtapaId04; motivo: string; dias: number; acao: string; grave: boolean }

/** Pendências do módulo: atrasos, pendências registradas, entrega aguardando confirmação e falta de evidência. */
export function pendencias04(e: Modulo04Estado, hoje = hoje04()): Pendencia[] {
  const out: Pendencia[] = [];
  const desde = (id: EtapaId04) => (e[id].statusDesde ? Math.max(0, diasEntre(e[id].statusDesde!, hoje)) : 0);
  for (const id of ETAPAS_04) {
    const s = e[id].status;
    const atraso = diasAtraso(id, e, hoje);
    if (atraso > 0) out.push({ etapa: id, motivo: `Prazo vencido em ${dataBr04(previstaDe(id, e))}`, dias: atraso, acao: "Cobrar o executante e combinar uma nova data", grave: true });
    if (s === "pendencia" || s === "atrasado") out.push({ etapa: id, motivo: statusDef(id, s).nome + (e[id].observacoes.trim() ? `: ${e[id].observacoes.trim()}` : ""), dias: desde(id), acao: proximaAcao(id, e), grave: true });
    if (s === "aguardandoConfirmacao") out.push({ etapa: id, motivo: "Entrega aguardando confirmação", dias: desde(id), acao: "Verificar no Sistema de Pedidos", grave: false });
    if (id === "equipamentos" && e.equipamentos.despachoPrevisto && !DESPACHADO.includes(s) && diasEntre(e.equipamentos.despachoPrevisto, hoje) > 0 && !(atraso > 0)) {
      out.push({ etapa: id, motivo: `Despacho previsto para ${dataBr04(e.equipamentos.despachoPrevisto)} ainda não aconteceu`, dias: diasEntre(e.equipamentos.despachoPrevisto, hoje), acao: "Consultar o despacho", grave: true });
    }
    const andando = s !== STATUS_04[id][0].id || concluida(id, e);
    if (andando && !e.evidencias[id].length && !(id !== "cartoesAp" && e[id].pedido.trim())) {
      out.push({ etapa: id, motivo: concluida(id, e) ? "Concluída sem evidência" : "Sem evidência nem número do pedido", dias: desde(id), acao: "Anexar a evidência ou informar o pedido", grave: false });
    }
  }
  return out;
}

export interface Resumo04 {
  concluidas: number; total: number; pendentes: number; atrasadas: number; pct: number;
  proxima: EtapaId04 | null; proximaAcao: string | null;
  /** Data prevista mais distante entre as etapas (a conclusão do módulo). */
  previsao: string | null;
  situacao: "Não iniciado" | "Em andamento" | "Atrasado" | "Concluído";
}
export function resumo04(e: Modulo04Estado, hoje = hoje04()): Resumo04 {
  const concluidas = ETAPAS_04.filter(id => concluida(id, e)).length;
  const atrasadas = ETAPAS_04.filter(id => diasAtraso(id, e, hoje) > 0).length;
  const proxima = ETAPAS_04.find(id => !concluida(id, e)) ?? null;
  const previstas = ETAPAS_04.map(id => previstaDe(id, e)).filter(Boolean).sort();
  const comecou = ETAPAS_04.some(id => e[id].status !== STATUS_04[id][0].id) || e.historico.length > 0;
  return {
    concluidas, total: ETAPAS_04.length, pendentes: ETAPAS_04.length - concluidas, atrasadas,
    pct: Math.round((concluidas / ETAPAS_04.length) * 100),
    proxima, proximaAcao: proxima ? proximaAcao(proxima, e) : null,
    previsao: previstas.at(-1) ?? null,
    situacao: concluidas === ETAPAS_04.length ? "Concluído" : atrasadas ? "Atrasado" : comecou ? "Em andamento" : "Não iniciado",
  };
}

/* ─── Evidências (anexos do projeto) ─── */

export const EVIDENCIA_MAX_BYTES = 15 * 1024 * 1024;
export const EVIDENCIA_ACEITA = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.eml,.msg,.txt";

/** Sobe o arquivo para os anexos do projeto (aparece também na tela do projeto). */
export async function enviarEvidencia(projectId: string, etapa: EtapaId04, arquivo: File, userId: string | null, por: string): Promise<Evidencia> {
  if (arquivo.size > EVIDENCIA_MAX_BYTES) throw new Error(`O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB; o limite é 15 MB.`);
  const caminho = `${projectId}/modulo04/${etapa}/${Date.now()}-${arquivo.name.replace(/[^\w.-]+/g, "_")}`;
  const up = await supabase.storage.from("project-attachments").upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false });
  if (up.error) throw up.error;
  const { data, error } = await db.from("project_attachments").insert({
    project_id: projectId, file_name: `[Módulo 04] ${arquivo.name}`, file_path: caminho, file_size: arquivo.size,
    content_type: arquivo.type || null, uploaded_by: userId,
  }).select("id").single();
  if (error) throw error;
  return { id: String(data?.id ?? caminho), tipo: "arquivo", nome: arquivo.name, caminho, em: new Date().toISOString(), por };
}

/** Link temporário para abrir o anexo. */
export async function linkEvidencia(caminho: string): Promise<string | null> {
  const { data } = await supabase.storage.from("project-attachments").createSignedUrl(caminho, 300);
  return data?.signedUrl ?? null;
}
