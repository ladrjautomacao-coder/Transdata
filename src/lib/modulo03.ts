// Gerenciamento · módulo 03: as atividades presenciais (in loco), na visita ao cliente. Da
// apresentação da solução até o encerramento da visita técnica, com pendências e próximos passos.
import { supabase } from "@/integrations/supabase/client";
import type { Atividade, SituacaoAtividade } from "@/lib/gerenciamento";

export type AtividadeId03 = "apresentacao" | "cartoes" | "cronograma" | "visitas" | "regras" | "encerramento";

/** Nome provisório, como o dos módulos 01 e 02. */
export const MODULO_03 = {
  numero: "03",
  nome: "Atividades presenciais (in loco)",
  resumo: "Na visita ao cliente: a apresentação da solução, a gravação dos cartões, as visitas técnicas e as regras de negócio da operação, até o encerramento com as pendências e os próximos passos.",
  atividades: [
    { id: "apresentacao", titulo: "Apresentação da solução", descricao: "Faça a apresentação padrão da solução contratada, com os principais módulos, funcionalidades e fluxos operacionais.", responsavel: "gp" },
    { id: "cartoes", titulo: "Gravação dos cartões operacionais", descricao: "Grave e configure os cartões operacionais, incluindo chave, senha e SAM.", responsavel: "gp" },
    { id: "cronograma", titulo: "Cronograma das visitas técnicas", descricao: "Planeje e defina o cronograma das visitas técnicas previstas para esta etapa da implantação.", responsavel: "gp" },
    { id: "visitas", titulo: "Visitas técnicas", descricao: "Visite as garagens, os pontos de venda e os pontos de coleta, conforme o escopo do projeto.", responsavel: "gp" },
    { id: "regras", titulo: "Regras de negócio da operação", descricao: "Levante e documente as regras de negócio da operação: particularidades, processos e necessidades específicas do cliente.", responsavel: "gp" },
    { id: "encerramento", titulo: "Encerramento da visita técnica", descricao: "Ao fim da etapa presencial, registre as observações, as pendências, as definições e os próximos passos.", responsavel: "gp" },
  ] as Atividade<AtividadeId03>[],
};

/* ─── Cartões operacionais ─── */
export type CartaoOperacionalId = "chave" | "senha" | "sam";
export const CARTOES_OPERACIONAIS: { id: CartaoOperacionalId; nome: string; texto: string }[] = [
  { id: "chave", nome: "Chave", texto: "cartões-chave gravados e configurados" },
  { id: "senha", nome: "Senha", texto: "cartões de senha gravados e configurados" },
  { id: "sam", nome: "SAM", texto: "SAM gravado e configurado" },
];

/* ─── Visitas técnicas ─── */
export type TipoVisita = "garagem" | "venda" | "coleta";
export const TIPOS_VISITA: { id: TipoVisita; nome: string }[] = [
  { id: "garagem", nome: "Garagem" },
  { id: "venda", nome: "Ponto de venda" },
  { id: "coleta", nome: "Ponto de coleta" },
];
export const nomeTipoVisita = (t: TipoVisita) => TIPOS_VISITA.find(x => x.id === t)?.nome ?? t;

/** Uma visita do cronograma. `data`: AAAA-MM-DD; `feitaEm`: quando o GP marcou a visita como feita. */
export interface VisitaTecnica { id: string; tipo: TipoVisita; local: string; data: string; feitaEm: string | null }

/** Campos do encerramento da visita técnica: todos obrigatórios ("Nenhuma." também vale). */
export const CAMPOS_ENCERRAMENTO = [
  { k: "observacoes", label: "Observações", placeholder: "O que chamou a atenção na visita" },
  { k: "pendencias", label: "Pendências", placeholder: "O que ficou para resolver, e com quem" },
  { k: "definicoes", label: "Definições", placeholder: "O que foi decidido com o cliente" },
  { k: "proximos", label: "Próximos passos", placeholder: "O que vem agora, com responsável e prazo" },
] as const;
export type CampoEncerramento = (typeof CAMPOS_ENCERRAMENTO)[number]["k"];

/** Estado do módulo 03 de um projeto (gravado inteiro em gerenciamento_modulo03.estado). */
export interface Modulo03Estado {
  /** `data`: AAAA-MM-DD da apresentação; `participantes`: quem assistiu, do lado do cliente. */
  apresentacao: { data: string; participantes: string; registradoEm: string | null; por: string };
  /** Quando cada cartão operacional foi gravado e configurado. */
  cartoes: Record<CartaoOperacionalId, string | null> & { por: string };
  /** As visitas planejadas; `registradoEm`: cronograma definido (libera as visitas). */
  cronograma: { visitas: VisitaTecnica[]; registradoEm: string | null; por: string };
  /** `regras` obrigatório; particularidades/processos e necessidades do cliente opcionais. */
  regras: { regras: string; particularidades: string; necessidades: string; registradoEm: string | null; por: string };
  /** `data`: AAAA-MM-DD do encerramento. */
  encerramento: Record<CampoEncerramento, string> & { data: string; registradoEm: string | null; por: string };
}

export const modulo03Vazio = (): Modulo03Estado => ({
  apresentacao: { data: "", participantes: "", registradoEm: null, por: "" },
  cartoes: { chave: null, senha: null, sam: null, por: "" },
  cronograma: { visitas: [], registradoEm: null, por: "" },
  regras: { regras: "", particularidades: "", necessidades: "", registradoEm: null, por: "" },
  encerramento: { data: "", observacoes: "", pendencias: "", definicoes: "", proximos: "", registradoEm: null, por: "" },
});

/** Completa com o estado vazio o que faltar no que veio do banco (o formato cresce junto com o módulo). */
export function normalizarModulo03(raw: unknown): Modulo03Estado {
  const v = modulo03Vazio();
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Modulo03Estado>;
  const out = { ...v } as Record<keyof Modulo03Estado, unknown>;
  for (const k of Object.keys(v) as (keyof Modulo03Estado)[]) out[k] = { ...v[k], ...(r[k] as object | undefined) };
  const e = out as Modulo03Estado;
  if (!Array.isArray(e.cronograma.visitas)) e.cronograma = { ...e.cronograma, visitas: [] };
  return e;
}

// gerenciamento_modulo03 ainda fora do types.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** O módulo 03 gravado do projeto (vazio se o GP ainda não marcou nada) e quando foi salvo. */
export async function fetchModulo03(projectId: string): Promise<{ estado: Modulo03Estado; salvoEm: string | null }> {
  const { data, error } = await db.from("gerenciamento_modulo03").select("estado, updated_at").eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  return { estado: normalizarModulo03(data?.estado), salvoEm: data?.updated_at ?? null };
}

/** Grava o módulo 03 do projeto inteiro; devolve quando foi salvo. */
export async function salvarModulo03(projectId: string, estado: Modulo03Estado): Promise<string> {
  const { data, error } = await db.from("gerenciamento_modulo03")
    .upsert({ project_id: projectId, estado }, { onConflict: "project_id" })
    .select("updated_at").single();
  if (error) throw error;
  return data.updated_at as string;
}

/* ─── Situação das atividades ─── */

/** Visitas do cronograma, por data (sem data por último). */
export const visitasOrdenadas = (e: Modulo03Estado) =>
  [...e.cronograma.visitas].sort((a, b) => (a.data || "9999").localeCompare(b.data || "9999"));

/** Visita pronta para o cronograma: com o local e a data. */
export const visitaCompleta = (v: VisitaTecnica) => !!v.local.trim() && !!v.data;

/** Atividade feita. */
export function feito03(a: AtividadeId03, e: Modulo03Estado): boolean {
  switch (a) {
    case "apresentacao": return !!e.apresentacao.registradoEm;
    case "cartoes": return CARTOES_OPERACIONAIS.every(c => !!e.cartoes[c.id]);
    case "cronograma": return !!e.cronograma.registradoEm;
    case "visitas": return !!e.cronograma.registradoEm && e.cronograma.visitas.length > 0 && e.cronograma.visitas.every(v => !!v.feitaEm);
    case "regras": return !!e.regras.registradoEm;
    case "encerramento": return !!e.encerramento.registradoEm;
  }
}

/** Por que a atividade ainda não pode ser feita: `pill` no selo, `texto` no cartão; null se liberada. */
export function bloqueio03(a: AtividadeId03, e: Modulo03Estado): { pill: string; texto: string } | null {
  switch (a) {
    case "visitas":
      return e.cronograma.registradoEm ? null : { pill: "Aguarda o cronograma", texto: "Liberada quando o cronograma das visitas técnicas estiver definido." };
    case "encerramento": {
      // o encerramento fecha a etapa presencial: todas as outras atividades feitas
      const faltam = MODULO_03.atividades.filter(x => x.id !== "encerramento" && !feito03(x.id, e));
      if (!faltam.length) return null;
      return {
        pill: "Aguarda as atividades",
        texto: `Liberado quando as outras atividades do módulo estiverem feitas. ${faltam.length === 1 ? "Falta" : "Faltam"}: ${faltam.map(x => x.titulo.toLowerCase()).join(", ")}.`,
      };
    }
    default: return null;
  }
}

/** Situação da atividade do módulo 03. */
export function situacao03(a: AtividadeId03, e: Modulo03Estado): SituacaoAtividade {
  if (feito03(a, e)) return "feito";
  if (bloqueio03(a, e)) return "bloqueado";
  return "afazer";
}
