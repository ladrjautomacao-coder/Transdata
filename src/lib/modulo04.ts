// Gerenciamento · módulo 04: entrega de cartões e equipamentos. Três etapas em sequência
// (cartões para a Silvana → a Silvana entrega para AT → acompanhamento dos equipamentos, em
// checklist), executadas por outras áreas e acompanhadas pelo GP. Cada etapa tem a sua situação,
// prazo, evidências e histórico (só de inclusão: até o "Desfazer" acrescenta uma linha).
import { supabase } from "@/integrations/supabase/client";
import type { Atividade, SituacaoAtividade } from "@/lib/gerenciamento";

export type EtapaId04 = "cartoesAp" | "apAt" | "equipamentos";
export const ETAPAS_04: EtapaId04[] = ["cartoesAp", "apAt", "equipamentos"];

/** Quem é "AP" no módulo: a Assistente de Projetos (troque aqui se mudar a pessoa). */
export const NOME_AP = "Silvana";

/** Cores das situações: cinza (não iniciado), azul (em andamento), amarelo (aguardando ação ou
 * confirmação), verde (concluído) e vermelho (atrasado, problema ou pendência). */
export type Cor = "cinza" | "azul" | "amarelo" | "verde" | "vermelho";

export const MODULO_04 = {
  numero: "04",
  nome: "Entrega de cartões e equipamentos",
  resumo: `Os cartões vão para a ${NOME_AP}, a ${NOME_AP} entrega para AT e os equipamentos são acompanhados até a entrega. Quem executa são as áreas; o GP acompanha os prazos, as pendências e as evidências.`,
  atividades: [
    { id: "cartoesAp", titulo: `Entrega de cartões para ${NOME_AP}`, descricao: `Controle a preparação e a entrega dos cartões para a ${NOME_AP}.`, responsavel: "assistente" },
    { id: "apAt", titulo: `${NOME_AP} entrega os cartões para AT`, descricao: `Confirme se a ${NOME_AP} entregou os cartões para AT, de preferência pelo Sistema de Pedidos.`, responsavel: "area", executante: NOME_AP },
    { id: "equipamentos", titulo: "Acompanhar entrega dos equipamentos", descricao: "Acompanhe, em checklist, o pedido, a separação, o despacho e a entrega dos equipamentos.", responsavel: "area", executante: "AT / despacho" },
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
    { id: "entregue", nome: `Entregue para ${NOME_AP}`, cor: "verde", concluido: true },
    { id: "pendencia", nome: "Pendência", cor: "vermelho" },
  ],
  apAt: [
    { id: "aguardandoAp", nome: `Aguardando ${NOME_AP}`, cor: "amarelo" },
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

/* ─── Etapa 3: checklist dos equipamentos ─── */

export type ItemEquip = "pedido" | "separados" | "despachados" | "entregues";
/** Os itens da etapa 3, na ordem; cada um leva a etapa para uma situação. */
export const ITENS_EQUIP: { id: ItemEquip; texto: string; status: string }[] = [
  { id: "pedido", texto: "Pedido dos equipamentos aberto", status: "preparacao" },
  { id: "separados", texto: "Equipamentos separados", status: "aguardandoDespacho" },
  { id: "despachados", texto: "Equipamentos despachados", status: "despachado" },
  { id: "entregues", texto: "Equipamentos entregues", status: "entregue" },
];
export interface MarcaItem { em: string; por: string }

/* ─── Estado ─── */

/** Consulta ao Sistema de Pedidos (automática, quando houver integração, ou registrada à mão). */
export interface ConsultaPedido {
  em: string; por: string; numero: string; status: string;
  /** Data da consulta (AAAA-MM-DD), informada na consulta manual. */
  data: string; observacao: string; fonte: "manual" | "sistema";
  /** Valores dos campos antes da consulta (para o "Desfazer" devolver). */
  antes?: Record<string, string>;
  /** Valores que a consulta gravou (o "Desfazer" só devolve o que ainda está igual). */
  depois?: Record<string, string>;
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
  /** A situação de antes da atual (o "Desfazer" da conclusão volta para ela). */
  statusAnterior: string;
  /** Quem marcou a conclusão, e quando. */
  concluidoEm: string | null; por: string;
}
export interface EtapaCartoesAp extends EtapaBase { quantidade: string; para: string; comunicacaoEm: string | null }
export interface EtapaApAt extends EtapaBase { pedido: string; quantidade: string; statusPedido: string; consultas: ConsultaPedido[] }
export interface EtapaEquipamentos extends EtapaBase {
  pedido: string; equipamento: string; quantidade: string; despachoPrevisto: string; despachoEfetivo: string;
  transportadora: string; rastreio: string; statusPedido: string; consultas: ConsultaPedido[];
  /** Checklist da etapa: quem marcou cada item, e quando (null = não marcado). */
  checklist: Record<ItemEquip, MarcaItem | null>;
}
export interface Modulo04Estado {
  cartoesAp: EtapaCartoesAp;
  apAt: EtapaApAt;
  equipamentos: EtapaEquipamentos;
  evidencias: Record<EtapaId04, Evidencia[]>;
  historico: Historico[];
}

const base = (status: string): EtapaBase => ({ status, prevista: "", efetiva: "", observacoes: "", statusDesde: null, statusAnterior: "", concluidoEm: null, por: "" });
const checklistVazio = (): Record<ItemEquip, MarcaItem | null> => ({ pedido: null, separados: null, despachados: null, entregues: null });
export const modulo04Vazio = (): Modulo04Estado => ({
  cartoesAp: { ...base("naoiniciado"), quantidade: "", para: "", comunicacaoEm: null },
  apAt: { ...base("aguardandoAp"), pedido: "", quantidade: "", statusPedido: "", consultas: [] },
  equipamentos: {
    ...base("aguardandoSeparacao"), pedido: "", equipamento: "", quantidade: "", despachoPrevisto: "", despachoEfetivo: "",
    transportadora: "", rastreio: "", statusPedido: "", consultas: [], checklist: checklistVazio(),
  },
  evidencias: { cartoesAp: [], apAt: [], equipamentos: [] },
  historico: [],
});

/**
 * Checklist da etapa 3 gravado antes de a etapa virar checklist: deduz os itens pela situação e
 * pelo número do pedido que já estavam preenchidos.
 */
function checklistDeduzido(q: Partial<EtapaEquipamentos>): Record<ItemEquip, MarcaItem | null> {
  const c = checklistVazio();
  const marca: MarcaItem = { em: q.concluidoEm ?? q.statusDesde ?? new Date(0).toISOString(), por: q.por || "registro anterior" };
  const s = q.status ?? "";
  const nivel = s === "entregue" ? 4 : ["despachado", "transporte"].includes(s) ? 3 : s === "aguardandoDespacho" ? 2 : 0;
  if (nivel >= 1 || q.pedido?.trim()) c.pedido = marca;
  if (nivel >= 2) c.separados = marca;
  if (nivel >= 3) c.despachados = marca;
  if (nivel >= 4) c.entregues = marca;
  return c;
}

/** Completa com o estado vazio o que faltar no que veio do banco (o formato cresce junto com o módulo). */
export function normalizarModulo04(raw: unknown): Modulo04Estado {
  const v = modulo04Vazio();
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Modulo04Estado>;
  return {
    cartoesAp: { ...v.cartoesAp, ...r.cartoesAp },
    apAt: { ...v.apAt, ...r.apAt, consultas: [...(r.apAt?.consultas ?? [])] },
    equipamentos: {
      ...v.equipamentos, ...r.equipamentos, consultas: [...(r.equipamentos?.consultas ?? [])],
      checklist: r.equipamentos?.checklist ? { ...checklistVazio(), ...r.equipamentos.checklist } : checklistDeduzido(r.equipamentos ?? {}),
    },
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
/** Data prevista que conta para o atraso (nos equipamentos, a previsão de entrega). */
export const previstaDe = (id: EtapaId04, e: Modulo04Estado) => e[id].prevista;
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
  if (s === "pendencia" || s === "atrasado") return id === "equipamentos" ? "Resolver a pendência na entrega com AT" : id === "apAt" ? `Resolver a pendência com a ${NOME_AP}` : "Resolver a pendência dos cartões";
  if (id === "cartoesAp") return s === "aguardandoEnvio" ? `Enviar os cartões e a comunicação para a ${NOME_AP}` : s === "preparacao" ? "Concluir a preparação dos cartões" : "Preparar os cartões e a comunicação de entrega";
  if (id === "apAt") return s === "aguardandoConfirmacao" ? "Confirmar a entrega no Sistema de Pedidos" : `Acompanhar o pedido da ${NOME_AP} no Sistema de Pedidos`;
  // etapa 3: o primeiro item do checklist ainda não marcado
  const falta = ITENS_EQUIP.find(i => !e.equipamentos.checklist[i.id])?.id;
  return falta === "pedido" ? "Abrir o pedido dos equipamentos" : falta === "separados" ? "Acompanhar a separação dos equipamentos"
    : falta === "despachados" ? "Acompanhar o despacho dos equipamentos" : "Acompanhar a entrega pela transportadora";
}

/** O que falta para marcar a etapa como concluída (as duas primeiras pedem evidência ou referência). */
export function faltaParaConcluir(id: EtapaId04, e: Modulo04Estado): string[] {
  const out: string[] = [];
  const ev = e.evidencias[id];
  if (id === "cartoesAp") {
    if (!e.cartoesAp.quantidade.trim()) out.push("quantidade de cartões");
    if (!ev.length) out.push("uma evidência (anexo ou a comunicação de entrega)");
  } else if (id === "apAt") {
    if (!e.apAt.pedido.trim() && !ev.length) out.push("número do pedido ou uma evidência");
  }
  // etapa 3: a conclusão é o último item do checklist (cada item pede só o seu dado)
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
    extra.statusAnterior = String(atual.status ?? "");
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

/* ─── Desfazer (sempre acrescenta ao histórico; nada some dele) ─── */

/** Desfaz a conclusão da etapa: volta à situação de antes e limpa a data efetiva. */
export function desfazerConclusao(e: Modulo04Estado, id: EtapaId04, por: string, agora = new Date().toISOString()): Modulo04Estado {
  if (!concluida(id, e)) return e;
  const antes = STATUS_04[id].some(s => s.id === e[id].statusAnterior && !s.concluido) ? e[id].statusAnterior : STATUS_04[id][0].id;
  const e2 = alterarEtapa(e, id, { status: antes, efetiva: "" } as never, por, agora);
  return registrar(e2, id, "Conclusão desfeita", `volta para ${statusDef(id, antes).nome}`, por, agora);
}

/** Desfaz a comunicação de entrega (etapa 1): tira a data e a evidência do e-mail. */
export function desfazerComunicacao(e: Modulo04Estado, por: string, agora = new Date().toISOString()): Modulo04Estado {
  if (!e.cartoesAp.comunicacaoEm && !e.evidencias.cartoesAp.some(x => x.tipo === "email")) return e;
  const e2: Modulo04Estado = {
    ...e, cartoesAp: { ...e.cartoesAp, comunicacaoEm: null },
    evidencias: { ...e.evidencias, cartoesAp: e.evidencias.cartoesAp.filter(x => x.tipo !== "email") },
  };
  return registrar(e2, "cartoesAp", "Comunicação de entrega desfeita", "o e-mail saiu das evidências", por, agora);
}

/**
 * Desfaz uma consulta ao Sistema de Pedidos: tira a consulta e a referência dela das evidências e
 * devolve os campos que ela mudou, só os que ainda estão com o valor que ela gravou.
 */
export function desfazerConsulta(e: Modulo04Estado, etapa: "apAt" | "equipamentos", em: string, por: string, agora = new Date().toISOString()): Modulo04Estado {
  const c = e[etapa].consultas.find(x => x.em === em);
  if (!c) return e;
  const atual = e[etapa] as unknown as Record<string, string>;
  const volta = Object.fromEntries(Object.entries(c.antes ?? {}).filter(([k]) => (atual[k] ?? "") === (c.depois?.[k] ?? "")));
  let e2 = alterarEtapa(e, etapa, volta as never, por, agora);
  e2 = {
    ...e2, [etapa]: { ...e2[etapa], consultas: e2[etapa].consultas.filter(x => x.em !== em) },
    evidencias: { ...e2.evidencias, [etapa]: e2.evidencias[etapa].filter(x => x.id !== `pedido-${em}`) },
  };
  return registrar(e2, etapa, "Consulta ao Sistema de Pedidos desfeita", `pedido ${c.numero}: ${c.status}`, por, agora);
}

/** Tira uma evidência da etapa (o arquivo, se houver, é apagado à parte: excluirArquivoEvidencia). */
export function removerEvidencia(e: Modulo04Estado, etapa: EtapaId04, evidenciaId: string, por: string, agora = new Date().toISOString()): Modulo04Estado {
  const x = e.evidencias[etapa].find(v => v.id === evidenciaId);
  if (!x) return e;
  const e2 = { ...e, evidencias: { ...e.evidencias, [etapa]: e.evidencias[etapa].filter(v => v.id !== evidenciaId) } };
  return registrar(e2, etapa, "Evidência excluída", x.nome, por, agora);
}

/* ─── Etapa 3: marcar e desfazer os itens do checklist ─── */

/** Situação da etapa 3 pelo checklist: a do item mais adiantado marcado. */
export function statusDoChecklist(c: Record<ItemEquip, MarcaItem | null>): string {
  return [...ITENS_EQUIP].reverse().find(i => c[i.id])?.status ?? STATUS_04.equipamentos[0].id;
}

/** Marca um item do checklist; a situação da etapa acompanha (e "entregues" conclui, com a data). */
export function marcarItemEquip(
  e: Modulo04Estado, item: ItemEquip, por: string, campos: Partial<Record<"pedido" | "transportadora" | "rastreio" | "efetiva", string>> = {}, agora = new Date().toISOString(),
): Modulo04Estado {
  if (e.equipamentos.checklist[item]) return e;
  const checklist = { ...e.equipamentos.checklist, [item]: { em: agora, por } };
  const patch = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined)) as Record<string, string>;
  const status = statusDoChecklist(checklist);
  let e2 = alterarEtapa(e, "equipamentos", { ...patch, ...(status !== e.equipamentos.status ? { status } : {}) } as never, por, agora);
  e2 = { ...e2, equipamentos: { ...e2.equipamentos, checklist } };
  return registrar(e2, "equipamentos", `Checklist: ${ITENS_EQUIP.find(i => i.id === item)!.texto}`, "ok", por, agora);
}

/** Desfaz um item do checklist; a situação volta para a do item mais adiantado que continua marcado. */
export function desfazerItemEquip(e: Modulo04Estado, item: ItemEquip, por: string, agora = new Date().toISOString()): Modulo04Estado {
  if (!e.equipamentos.checklist[item]) return e;
  const checklist = { ...e.equipamentos.checklist, [item]: null };
  const status = statusDoChecklist(checklist);
  let e2 = alterarEtapa(e, "equipamentos", { ...(status !== e.equipamentos.status ? { status } : {}), ...(item === "entregues" ? { efetiva: "" } : {}) } as never, por, agora);
  e2 = { ...e2, equipamentos: { ...e2.equipamentos, checklist } };
  return registrar(e2, "equipamentos", `Checklist: ${ITENS_EQUIP.find(i => i.id === item)!.texto}`, "desfeito", por, agora);
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
    // a etapa 3 é acompanhamento em checklist: o próprio item do pedido pede o número
    const andando = s !== STATUS_04[id][0].id || concluida(id, e);
    if (id !== "equipamentos" && andando && !e.evidencias[id].length && !(id !== "cartoesAp" && e[id].pedido.trim())) {
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

/**
 * Apaga o arquivo da evidência do armazenamento e dos anexos do projeto. Só quem enviou ou um
 * admin consegue (regra do banco); devolve false quando o arquivo não pôde ser apagado.
 */
export async function excluirArquivoEvidencia(caminho: string): Promise<boolean> {
  const { data, error } = await db.from("project_attachments").delete().eq("file_path", caminho).select("id");
  if (error || !data?.length) return false;
  await supabase.storage.from("project-attachments").remove([caminho]);
  return true;
}

/** Link temporário para abrir o anexo. */
export async function linkEvidencia(caminho: string): Promise<string | null> {
  const { data } = await supabase.storage.from("project-attachments").createSignedUrl(caminho, 300);
  return data?.signedUrl ?? null;
}
