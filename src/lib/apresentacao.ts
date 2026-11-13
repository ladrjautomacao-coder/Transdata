// Gerenciamento · módulo 03 · apresentação da solução: os modelos de slide (das apresentações que
// os GPs usavam no PowerPoint: Reunião PE, ChatBot, Biometria Facial e Migração BD) e a montagem
// automática pelo que o projeto contratou.
import { supabase } from "@/integrations/supabase/client";

const SIGLAS = /^(ltda\.?|s\.?a\.?|s\/a|me|epp|eireli)$/i;
const LIGACOES = /^(de|da|do|das|dos|e)$/i;
/** "AUTO COLETIVO CACADOR LTDA" → "Auto Coletivo Cacador LTDA", para títulos de slide. */
export function nomeDeExibicao(nome: string): string {
  if (nome !== nome.toUpperCase()) return nome.trim();
  return nome.trim().split(/\s+/).map((p, i) => {
    if (SIGLAS.test(p)) return p.toUpperCase();
    const m = p.toLowerCase();
    return i > 0 && LIGACOES.test(m) ? m : m.charAt(0).toUpperCase() + m.slice(1);
  }).join(" ");
}

export type SecaoId = "abertura" | "servicos" | "projeto" | "escopo" | "cronograma" | "cartoes" | "biometria" | "chatbot" | "migracaobd" | "encerramento";
export const SECOES: { id: SecaoId; nome: string }[] = [
  { id: "abertura", nome: "Abertura" },
  { id: "servicos", nome: "Serviços" },
  { id: "projeto", nome: "Projeto" },
  { id: "escopo", nome: "Escopo do contrato" },
  { id: "cronograma", nome: "Cronograma" },
  { id: "cartoes", nome: "Gravação dos cartões" },
  { id: "biometria", nome: "Biometria facial" },
  { id: "chatbot", nome: "ChatBot" },
  { id: "migracaobd", nome: "Migração de BD" },
  { id: "encerramento", nome: "Encerramento" },
];

export type SlideId =
  | "capa" | "atlasbox" | "v6" | "biometria" | "its" | "chatbot"
  | "responsaveis" | "regras" | "migracao"
  | "fluxo" | "coleta" | "cadastro" | "venda" | "materiais"
  | "cronograma" | "app"
  | "cartoes"
  | "bio-abertura" | "bio-resultados" | "bio-requisitos" | "bio-foto" | "bio-equipe" | "bio-informacoes" | "bio-funciona" | "bio-convite"
  | "chat-prereq-1" | "chat-prereq-2" | "chat-regras" | "chat-ativacao"
  | "mig-projeto" | "mig-marcos" | "mig-regras"
  | "duvidas";

export interface SlideModelo {
  id: SlideId;
  secao: SecaoId;
  titulo: string;
  /** Solução que traz o slide (pelo nome do cadastro); sem: entra sempre. */
  solucao?: RegExp;
  /** Entra desligado: o GP liga quando fizer sentido (o texto diz quando). */
  opcional?: string;
  /** Pode ser mostrado mesmo sem a solução contratada (apresentar como oportunidade). */
  vitrine?: boolean;
  /** Segundos na tela no modo automático, na velocidade normal (pelo tanto de conteúdo). */
  tempo: number;
  /** De onde veio: apresentação e slide do PowerPoint original. */
  origem: string[];
}

const BILHETAGEM = /bilhetagem/i;
const BIOMETRIA = /biometria/i;
const CHATBOT = /chat ?bot/i;
const ITS = /\bits\b/i;
const MIGRACAO_BD = /migra[cç][aã]o de (bd|banco)/i;
/** App Informativo: o aplicativo do passageiro (AtlasMob no cadastro). */
const APP = /atlas ?mob/i;

/** Os slides, na ordem em que são apresentados. */
export const MODELO_APRESENTACAO: SlideModelo[] = [
  { id: "capa", secao: "abertura", titulo: "Capa", tempo: 10, origem: ["Reunião PE 1", "ChatBot 1", "Migração BD 1"] },
  { id: "atlasbox", secao: "servicos", titulo: "AtlasBox", solucao: BILHETAGEM, vitrine: true, tempo: 25, origem: ["Reunião PE 2"] },
  { id: "v6", secao: "servicos", titulo: "V6", solucao: BILHETAGEM, vitrine: true, tempo: 22, origem: ["Reunião PE 3"] },
  { id: "biometria", secao: "servicos", titulo: "Biometria facial", solucao: BIOMETRIA, vitrine: true, tempo: 22, origem: ["Reunião PE 4", "Biometria 2"] },
  { id: "its", secao: "servicos", titulo: "ITS", solucao: ITS, vitrine: true, tempo: 22, origem: ["Reunião PE 5"] },
  { id: "chatbot", secao: "servicos", titulo: "ChatBot", solucao: CHATBOT, vitrine: true, tempo: 25, origem: ["Reunião PE 6", "ChatBot 2"] },
  { id: "responsaveis", secao: "projeto", titulo: "Responsáveis pelo projeto", tempo: 25, origem: ["Reunião PE 7", "Migração BD 4"] },
  { id: "regras", secao: "projeto", titulo: "Regras de negócio", solucao: BILHETAGEM, tempo: 35, origem: ["Reunião PE 9", "Reunião PE 10"] },
  { id: "migracao", secao: "projeto", titulo: "Migração de outro sistema", solucao: BILHETAGEM, opcional: "Ligue quando o cliente vem de outro sistema de bilhetagem.", tempo: 25, origem: ["Reunião PE 8"] },
  { id: "fluxo", secao: "escopo", titulo: "Fluxo primário", solucao: BILHETAGEM, tempo: 25, origem: ["Reunião PE 11"] },
  { id: "coleta", secao: "escopo", titulo: "Ponto de coleta", solucao: BILHETAGEM, tempo: 25, origem: ["Reunião PE 12"] },
  { id: "cadastro", secao: "escopo", titulo: "Ponto de cadastro", solucao: BILHETAGEM, tempo: 20, origem: ["Reunião PE 13"] },
  { id: "venda", secao: "escopo", titulo: "Ponto de venda e encerrante", solucao: BILHETAGEM, tempo: 25, origem: ["Reunião PE 14"] },
  { id: "materiais", secao: "escopo", titulo: "Lista de materiais", solucao: BILHETAGEM, tempo: 25, origem: ["Reunião PE 15"] },
  { id: "cronograma", secao: "cronograma", titulo: "Cronograma", solucao: BILHETAGEM, tempo: 30, origem: ["Reunião PE 16"] },
  { id: "app", secao: "cronograma", titulo: "App Informativo", solucao: APP, tempo: 18, origem: ["Reunião PE 17"] },
  { id: "cartoes", secao: "cartoes", titulo: "Chave da cidade", solucao: BILHETAGEM, tempo: 28, origem: ["Reunião PE 18"] },
  { id: "bio-abertura", secao: "biometria", titulo: "Uma solução antifraude", solucao: BIOMETRIA, vitrine: true, tempo: 8, origem: ["Biometria 1"] },
  { id: "bio-resultados", secao: "biometria", titulo: "Resultados", solucao: BIOMETRIA, vitrine: true, tempo: 35, origem: ["Biometria 3"] },
  { id: "bio-funciona", secao: "biometria", titulo: "Como funciona", solucao: BIOMETRIA, vitrine: true, tempo: 28, origem: ["Biometria 8"] },
  { id: "bio-requisitos", secao: "biometria", titulo: "Requisitos de hardware e software", solucao: BIOMETRIA, tempo: 22, origem: ["Biometria 4"] },
  { id: "bio-foto", secao: "biometria", titulo: "Foto do cadastro", solucao: BIOMETRIA, tempo: 22, origem: ["Biometria 5"] },
  { id: "bio-equipe", secao: "biometria", titulo: "Requisitos de equipe", solucao: BIOMETRIA, tempo: 30, origem: ["Biometria 6"] },
  { id: "bio-informacoes", secao: "biometria", titulo: "Informações importantes", solucao: BIOMETRIA, tempo: 45, origem: ["Biometria 7"] },
  { id: "bio-convite", secao: "biometria", titulo: "Vamos implantar?", solucao: BIOMETRIA, vitrine: true, opcional: "Fala de venda: ligue quando o cliente ainda vai decidir pela biometria.", tempo: 15, origem: ["Biometria 9"] },
  { id: "chat-prereq-1", secao: "chatbot", titulo: "Pré-requisitos: site, CNPJ e Facebook", solucao: CHATBOT, tempo: 28, origem: ["ChatBot 3"] },
  { id: "chat-prereq-2", secao: "chatbot", titulo: "Pré-requisitos: telefone, nome e cartão teste", solucao: CHATBOT, tempo: 28, origem: ["ChatBot 4"] },
  { id: "chat-regras", secao: "chatbot", titulo: "Regras de negócio do ChatBot", solucao: CHATBOT, tempo: 28, origem: ["ChatBot 5"] },
  { id: "chat-ativacao", secao: "chatbot", titulo: "Ativação", solucao: CHATBOT, tempo: 28, origem: ["ChatBot 6"] },
  { id: "mig-projeto", secao: "migracaobd", titulo: "Migração de banco de dados", solucao: MIGRACAO_BD, tempo: 25, origem: ["Migração BD 2"] },
  { id: "mig-marcos", secao: "migracaobd", titulo: "Marcos do projeto", solucao: MIGRACAO_BD, tempo: 22, origem: ["Migração BD 3"] },
  { id: "mig-regras", secao: "migracaobd", titulo: "Regras de migração", solucao: MIGRACAO_BD, tempo: 12, origem: ["Migração BD 5"] },
  { id: "duvidas", secao: "encerramento", titulo: "Dúvidas e contatos", tempo: 15, origem: ["Reunião PE 19", "Reunião PE 20", "ChatBot 7", "Biometria 10", "Migração BD 6", "Migração BD 7"] },
];
const modeloDe = (id: SlideId) => MODELO_APRESENTACAO.find(m => m.id === id)!;

/** Soluções do cadastro que já têm slide próprio no modelo. */
const COM_SLIDE = [BILHETAGEM, BIOMETRIA, ITS, CHATBOT, MIGRACAO_BD, APP];

/** Soluções contratadas que ainda não têm slide próprio (aparecem só na lista de serviços). */
export const solucoesSemSlide = (solucoes: string[]) => solucoes.filter(s => !COM_SLIDE.some(r => r.test(s)));

/** Nome de cada solução como aparece nos slides (o do cadastro, se não houver outro). */
const NOME_NO_SLIDE: [RegExp, string][] = [[/carrier/i, "AtlasCarrier"], [CHATBOT, "ChatBot"], [/^its/i, "ITS"], [APP, "App Informativo"]];
export const nomeNoSlide = (s: string) => NOME_NO_SLIDE.find(([r]) => r.test(s))?.[1] ?? s;

/** Equipamento do cadastro do projeto ("AB FULL" → "AtlasBox FULL"). */
export interface Equipamento { nome: string; qtd: number }
export const nomeEquipamento = (n: string) => n.replace(/^AB\b/i, "AtlasBox");
export const eAtlasBox = (e: Equipamento) => /^(AB|atlas ?box)\b/i.test(e.nome);
export const eV6 = (e: Equipamento) => /^V6\b/i.test(e.nome);

/**
 * O slide fala de algo que o projeto contratou: a solução está no projeto e, no AtlasBox e no V6,
 * o equipamento está no cadastro (sem equipamento cadastrado, valem os dois).
 */
export function slideContratado(id: SlideId, solucoes: string[], equipamentos: Equipamento[] = []): boolean {
  const m = modeloDe(id);
  if (!m.solucao) return true;
  if (!solucoes.some(s => m.solucao!.test(s))) return false;
  const temAB = equipamentos.some(eAtlasBox), temV6 = equipamentos.some(eV6);
  if (id === "atlasbox" && (temAB || temV6)) return temAB;
  if (id === "v6" && (temAB || temV6)) return temV6;
  return true;
}

export interface SlideDoProjeto {
  modelo: SlideModelo;
  /** Faz parte do roteiro deste projeto. */
  incluido: boolean;
  /** Ligado sem o GP mexer. */
  padrao: boolean;
  /** Fala de algo que o projeto contratou (os outros são oportunidade: "Conheça também"). */
  contratado: boolean;
  /** A solução nem foi contratada (selo "Não contratado" no roteiro). */
  foraDoContrato: boolean;
  /** Por que entra desligado (o opcional do modelo, o cadastro ou a solução não contratada). */
  dica?: string;
}

/**
 * Os slides deste projeto, na ordem do modelo, cada um ligado ou desligado conforme o padrão e a
 * escolha do GP (`escolhas`: id → ligado). Entram os slides das soluções contratadas e, desligados,
 * os de vitrine das soluções não contratadas, para o GP apresentar como oportunidade.
 */
export function slidesDoProjeto(solucoes: string[], escolhas: Record<string, boolean>, equipamentos: Equipamento[] = []): SlideDoProjeto[] {
  return MODELO_APRESENTACAO
    .map(m => {
      const solucaoNoProjeto = !m.solucao || solucoes.some(s => m.solucao!.test(s));
      const contratado = slideContratado(m.id, solucoes, equipamentos);
      const padrao = contratado && !m.opcional;
      let dica = m.opcional;
      if (!solucaoNoProjeto) dica = "Ligue para apresentar como oportunidade.";
      else if (!contratado) dica = `O projeto não tem ${m.titulo} no cadastro de equipamentos.`;
      return { modelo: m, padrao, dica, contratado, foraDoContrato: !solucaoNoProjeto, incluido: escolhas[m.id] ?? padrao, mostrar: solucaoNoProjeto || !!m.vitrine };
    })
    .filter(s => s.mostrar)
    .map(({ mostrar: _m, ...s }) => s);
}

/* ─── Modo automático: velocidade e duração ─── */

export type Velocidade = "devagar" | "normal" | "rapido";
export const VELOCIDADES: { id: Velocidade; nome: string; fator: number }[] = [
  { id: "devagar", nome: "Devagar", fator: 1.5 },
  { id: "normal", nome: "Normal", fator: 1 },
  { id: "rapido", nome: "Rápido", fator: 0.6 },
];
export const fatorDe = (v: Velocidade) => VELOCIDADES.find(x => x.id === v)?.fator ?? 1;
/** Segundos do slide na tela, no modo automático, na velocidade escolhida. */
export const segundosNoSlide = (id: SlideId, v: Velocidade) => Math.round(modeloDe(id).tempo * fatorDe(v));
/** Duração do roteiro no modo automático, em segundos. */
export const duracaoDoRoteiro = (ids: SlideId[], v: Velocidade) => ids.reduce((s, id) => s + segundosNoSlide(id, v), 0);
/** 754 → "13 min"; 50 → "1 min". */
export const minutos = (seg: number) => `${Math.max(1, Math.round(seg / 60))} min`;

/** O projeto contratou a biometria facial (câmeras RF5/RF6). */
export const temBiometria = (solucoes: string[]) => solucoes.some(s => BIOMETRIA.test(s));

/** O que preenche os slides sozinho, vindo do projeto e dos módulos (e o que o GP completa). */
export interface DadosApresentacao {
  cliente: string;
  /** "Caçador/SC" */
  cidade: string;
  /** AAAA-MM-DD */
  data: string;
  /** Logo do cliente (o mesmo do e-mail ao Data Center, no módulo 01, ou enviado aqui). */
  logoCliente: string | null;
  gp: string | null;
  gpEmail: string | null;
  gpTelefone: string | null;
  /** Responsável técnico da Transdata: o Coordenador de Implantação da Equipe ("Nome · e-mail"). */
  tecnico: string | null;
  /** Câmeras de reconhecimento facial do projeto, como o GP escreveu ("RF6 · 40"). */
  cameras: string | null;
  responsavelCliente: string | null;
  /** Quem cuida do sistema de chamados (IGRE) do lado do cliente. */
  igreCliente: string | null;
  frota: { total: number | null; urbano: number | null; seccionado: number | null };
  equipamentos: Equipamento[];
  solucoes: string[];
  /** Reunião de PE (módulo 02), AAAA-MM-DDThh:mm. */
  reuniaoPe: string | null;
  /** Visitas técnicas do cronograma do módulo 03, por data. */
  visitasTecnicas: { tipo: string; local: string; data: string }[];
  /** Visitas de implantação aprovadas na Agenda de Implantação. */
  visitasAgenda: { finalidade: string; inicio: string; fim: string }[];
}

// implantation_requests ainda fora do types.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Visitas de implantação aprovadas na Agenda de Implantação para o projeto (para o cronograma). */
export async function fetchVisitasAgenda(projectId: string): Promise<DadosApresentacao["visitasAgenda"]> {
  const { data, error } = await db.from("implantation_requests")
    .select("visit_purpose, approved_start, approved_end, status")
    .eq("project_id", projectId).eq("status", "aprovada");
  if (error) throw error;
  return ((data ?? []) as { visit_purpose: string; approved_start: string | null; approved_end: string | null }[])
    .filter(r => r.approved_start)
    .map(r => ({ finalidade: r.visit_purpose, inicio: r.approved_start!, fim: r.approved_end ?? r.approved_start! }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}
