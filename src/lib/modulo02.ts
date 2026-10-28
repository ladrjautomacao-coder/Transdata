// Gerenciamento · módulo 02: a preparação da visita de PE (reunião de Projeto Executivo), do
// primeiro contato com o cliente até os cartões, as leitoras e o notebook prontos para a viagem.
import { supabase } from "@/integrations/supabase/client";
import type { Atividade, SituacaoAtividade } from "@/lib/gerenciamento";

export type AtividadeId02 =
  | "contato" | "custos" | "aprovacao" | "reservas" | "financeiro" | "adiantamento" | "cartoes" | "termo" | "leitoras" | "software";

/** Nome provisório, como o do módulo 01. */
export const MODULO_02 = {
  numero: "02",
  nome: "Preparação da visita de PE",
  resumo: "Do primeiro contato com o cliente até a viagem para a reunião de Projeto Executivo: custos aprovados, reservas feitas e o material da gravação dos cartões na mala.",
  atividades: [
    { id: "contato", titulo: "Contato com o cliente e agendamento do PE", descricao: "Contate o cliente, apresente-se como GP do projeto e agende a visita de PE (reunião de Projeto Executivo).", responsavel: "gp" },
    { id: "custos", titulo: "Custos de deslocamento e hospedagem", descricao: "Levante os custos da viagem, simulando na Onfly quando possível.", responsavel: "gp" },
    { id: "aprovacao", titulo: "Aprovação dos custos pelo cliente", descricao: "Envie os custos ao cliente e aguarde a aprovação.", responsavel: "gp" },
    { id: "reservas", titulo: "Reservas de deslocamento e hospedagem", descricao: "Com os custos aprovados, faça as reservas da viagem.", responsavel: "gp" },
    { id: "financeiro", titulo: "Comprovantes ao Financeiro", descricao: "Encaminhe os comprovantes das reservas ao Financeiro da Transdata.", responsavel: "gp" },
    { id: "adiantamento", titulo: "Adiantamento de verba na Onfly", descricao: "Solicite o adiantamento de verba na Onfly, quando necessário.", responsavel: "gp" },
    { id: "cartoes", titulo: "Cartões-chave e senhas", descricao: "Prepare os cartões-chave e as respectivas senhas para levar na reunião de PE.", responsavel: "gp" },
    { id: "termo", titulo: "Termo de Recebimento dos Cartões", descricao: "Gere o Termo de Recebimento dos Cartões em PDF.", responsavel: "gp" },
    { id: "leitoras", titulo: "Leitoras inteligentes", descricao: "Leve as duas leitoras inteligentes para a gravação dos cartões.", responsavel: "gp" },
    { id: "software", titulo: "SAMINIT e SASM CHAVE no notebook", descricao: "Garanta que os softwares de gravação estejam instalados e funcionando no notebook.", responsavel: "gp" },
  ] as Atividade<AtividadeId02>[],
};

export type MeioDeslocamento = "aereo" | "rodoviario" | "carro";
export const MEIO_LABEL: Record<MeioDeslocamento, string> = { aereo: "Aéreo", rodoviario: "Rodoviário", carro: "Carro" };

/** Estado do módulo 02 de um projeto (gravado inteiro em gerenciamento_modulo02.estado). */
export interface Modulo02Estado {
  /**
   * `reuniaoPe`: data e hora da reunião de PE (AAAA-MM-DDThh:mm, hora local). Agendada (com
   * `registradoEm`), o banco a copia para gerenciamento_modulo02.reuniao_pe_em, para os alertas do PE.
   */
  contato: { com: string; reuniaoPe: string; local: string; registradoEm: string | null; por: string };
  /** Datas AAAA-MM-DD; valores como o GP digita ("1.250,00") — a conta usa valorBr. */
  custos: {
    ida: string; volta: string; viajantes: string;
    meio: MeioDeslocamento | ""; deslocamento: string;
    /** Valor de cada diária de hospedagem (todos os viajantes); as diárias são as noites entre a ida e a volta. */
    diaria: string;
    outrosDescricao: string; outros: string;
    /** Valores simulados na Onfly. */
    onfly: boolean;
    registradoEm: string | null; por: string;
  };
  /** `para`: e-mail do cliente; `enviadoEm`: o e-mail dos custos foi copiado; `aprovadoEm`: AAAA-MM-DD. */
  aprovacao: { para: string; enviadoEm: string | null; aprovadoPor: string; aprovadoEm: string; registradoEm: string | null };
  /** Localizador / empresa do deslocamento e hotel da hospedagem (opcionais). */
  reservas: { deslocamento: string; hospedagem: string; registradoEm: string | null; por: string };
  /** `para`: e-mail do Financeiro; `enviadoEm`: o e-mail com os comprovantes foi copiado (ou enviado por fora). */
  financeiro: { para: string; enviadoEm: string | null; por: string };
  /** `necessario` false: não precisa de adiantamento (a atividade sai da conta). */
  adiantamento: { necessario: boolean | null; valor: string; registradoEm: string | null; por: string };
  /** Só o lembrete: as senhas não entram no portal. */
  cartoes: { registradoEm: string | null; por: string };
  termo: { registradoEm: string | null; por: string };
  leitoras: { registradoEm: string | null; por: string };
  /** Quando cada software foi conferido (instalado e funcionando). */
  software: { saminit: string | null; sasm: string | null; por: string };
}

export const modulo02Vazio = (): Modulo02Estado => ({
  contato: { com: "", reuniaoPe: "", local: "", registradoEm: null, por: "" },
  custos: { ida: "", volta: "", viajantes: "", meio: "", deslocamento: "", diaria: "", outrosDescricao: "", outros: "", onfly: false, registradoEm: null, por: "" },
  aprovacao: { para: "", enviadoEm: null, aprovadoPor: "", aprovadoEm: "", registradoEm: null },
  reservas: { deslocamento: "", hospedagem: "", registradoEm: null, por: "" },
  financeiro: { para: "", enviadoEm: null, por: "" },
  adiantamento: { necessario: null, valor: "", registradoEm: null, por: "" },
  cartoes: { registradoEm: null, por: "" },
  termo: { registradoEm: null, por: "" },
  leitoras: { registradoEm: null, por: "" },
  software: { saminit: null, sasm: null, por: "" },
});

/** Completa com o estado vazio o que faltar no que veio do banco (o formato cresce junto com o módulo). */
export function normalizarModulo02(raw: unknown): Modulo02Estado {
  const v = modulo02Vazio();
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Modulo02Estado>;
  const out = { ...v } as Record<keyof Modulo02Estado, unknown>;
  for (const k of Object.keys(v) as (keyof Modulo02Estado)[]) out[k] = { ...v[k], ...(r[k] as object | undefined) };
  return out as Modulo02Estado;
}

// gerenciamento_modulo02 ainda fora do types.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** O módulo 02 gravado do projeto (vazio se o GP ainda não marcou nada) e quando foi salvo. */
export async function fetchModulo02(projectId: string): Promise<{ estado: Modulo02Estado; salvoEm: string | null }> {
  const { data, error } = await db.from("gerenciamento_modulo02").select("estado, updated_at").eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  return { estado: normalizarModulo02(data?.estado), salvoEm: data?.updated_at ?? null };
}

/** Grava o módulo 02 do projeto inteiro; devolve quando foi salvo. */
export async function salvarModulo02(projectId: string, estado: Modulo02Estado): Promise<string> {
  const { data, error } = await db.from("gerenciamento_modulo02")
    .upsert({ project_id: projectId, estado }, { onConflict: "project_id" })
    .select("updated_at").single();
  if (error) throw error;
  return data.updated_at as string;
}

/* ─── Valores e datas ─── */

/** "1.250,00", "1250,5", "1250.50", "R$ 1.250" → número; vazio ou inválido: null. */
export function valorBr(s: string | null | undefined): number | null {
  const t = (s ?? "").replace(/R\$|\s/g, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  if (!/^\d+(\.\d+)?$/.test(normal)) return null;
  return Math.round(Number(normal) * 100) / 100;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** 1250.5 → "R$ 1.250,50" */
export const moeda = (n: number) => BRL.format(n).replace(/\s/g, " ");

const diaUtc = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
};
/** Noites entre a ida e a volta (AAAA-MM-DD); 0 se faltar data ou a volta for antes da ida. */
export function noitesEntre(ida: string, volta: string): number {
  const n = Math.round((diaUtc(volta) - diaUtc(ida)) / 86_400_000);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Dias de hoje até a reunião de PE (0 = hoje, negativo = já passou); null sem data. */
export function diasAtePe(reuniaoPe: string, hoje = new Date()): number | null {
  const d = diaUtc(reuniaoPe);
  if (Number.isNaN(d)) return null;
  return Math.round((d - Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86_400_000);
}
/** "hoje", "amanhã", "em 12 dias", "há 3 dias" */
export function prazoPe(dias: number): string {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  return dias > 0 ? `em ${dias} dias` : `há ${-dias} dias`;
}

/** A conta dos custos da visita. */
export function contaCustos(c: Modulo02Estado["custos"]) {
  const noites = noitesEntre(c.ida, c.volta);
  const deslocamento = valorBr(c.deslocamento) ?? 0;
  const diaria = valorBr(c.diaria) ?? 0;
  const hospedagem = Math.round(noites * diaria * 100) / 100;
  const outros = valorBr(c.outros) ?? 0;
  return { noites, deslocamento, diaria, hospedagem, outros, total: Math.round((deslocamento + hospedagem + outros) * 100) / 100 };
}

/** O que ainda falta para salvar os custos. */
export function faltandoCustos(c: Modulo02Estado["custos"]): string[] {
  const out: string[] = [];
  if (!c.ida || !c.volta) out.push("datas de ida e volta");
  else if (diaUtc(c.volta) < diaUtc(c.ida)) out.push("volta depois da ida");
  if (!c.meio) out.push("meio de deslocamento");
  if (!valorBr(c.deslocamento)) out.push("valor do deslocamento");
  if (noitesEntre(c.ida, c.volta) > 0 && !valorBr(c.diaria)) out.push("valor da diária");
  if (c.outros.trim() && valorBr(c.outros) === null) out.push("valor de outros custos");
  if (valorBr(c.outros) && !c.outrosDescricao.trim()) out.push("o que são os outros custos");
  return out;
}

/** Linhas de custo da visita, para a tela e os e-mails (outros só se houver). */
export function linhasCustos(c: Modulo02Estado["custos"]): { item: string; detalhe: string; valor: number }[] {
  const k = contaCustos(c);
  const out = [{ item: "Deslocamento", detalhe: c.meio ? MEIO_LABEL[c.meio] : "—", valor: k.deslocamento }];
  if (k.noites > 0) out.push({ item: "Hospedagem", detalhe: `${k.noites} ${k.noites === 1 ? "diária" : "diárias"} × ${moeda(k.diaria)}`, valor: k.hospedagem });
  if (k.outros > 0) out.push({ item: "Outros", detalhe: c.outrosDescricao.trim() || "—", valor: k.outros });
  return out;
}

/* ─── Situação das atividades ─── */

const aprovado = (e: Modulo02Estado) => !!e.aprovacao.registradoEm;

/** Atividade feita. */
export function feito02(a: AtividadeId02, e: Modulo02Estado): boolean {
  switch (a) {
    case "contato": return !!e.contato.registradoEm;
    case "custos": return !!e.custos.registradoEm;
    case "aprovacao": return aprovado(e);
    case "reservas": return !!e.reservas.registradoEm;
    case "financeiro": return !!e.financeiro.enviadoEm;
    case "adiantamento": return !!e.adiantamento.registradoEm && e.adiantamento.necessario === true;
    case "cartoes": return !!e.cartoes.registradoEm;
    case "termo": return !!e.termo.registradoEm;
    case "leitoras": return !!e.leitoras.registradoEm;
    case "software": return !!e.software.saminit && !!e.software.sasm;
  }
}

/** Por que a atividade ainda não pode ser feita: `pill` no selo, `texto` no cartão; null se liberada. */
export function bloqueio02(a: AtividadeId02, e: Modulo02Estado): { pill: string; texto: string } | null {
  const semAprovacao = { pill: "Aguarda a aprovação", texto: "Liberada quando o cliente aprovar os custos da visita." };
  switch (a) {
    case "aprovacao": return e.custos.registradoEm ? null : { pill: "Aguarda os custos", texto: "Liberada quando os custos de deslocamento e hospedagem forem salvos." };
    case "reservas": case "adiantamento": return aprovado(e) ? null : semAprovacao;
    case "financeiro":
      if (!aprovado(e)) return semAprovacao;
      return e.reservas.registradoEm ? null : { pill: "Aguarda as reservas", texto: "Liberada quando as reservas de deslocamento e hospedagem estiverem feitas." };
    case "termo": return e.cartoes.registradoEm ? null : { pill: "Aguarda os cartões", texto: "Liberado quando os cartões-chave e as senhas estiverem preparados." };
    default: return null;
  }
}

/** Situação da atividade do módulo 02. */
export function situacao02(a: AtividadeId02, e: Modulo02Estado): SituacaoAtividade {
  if (feito02(a, e)) return "feito";
  if (a === "adiantamento" && e.adiantamento.necessario === false && e.adiantamento.registradoEm) return "naoaplica";
  if (bloqueio02(a, e)) return "bloqueado";
  // e-mail dos custos copiado: falta o cliente aprovar
  if (a === "aprovacao" && e.aprovacao.enviadoEm) return "aguardando";
  return "afazer";
}
