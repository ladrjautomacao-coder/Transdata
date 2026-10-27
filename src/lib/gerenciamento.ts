// Gerenciamento do projeto (em desenvolvimento): os módulos com as rotinas do GP.
// Protótipo: as atividades do módulo 01 ainda não são gravadas no banco.
import { supabase } from "@/integrations/supabase/client";
import type { DataCenterForm } from "@/lib/dataCenterEmail";
import type { OperadoraCobertura } from "@/lib/coberturaOperadoras";

export interface GerProject {
  id: string;
  company_name: string;
  project_code: string | null;
  city: string;
  state: string | null;
  country_code: string | null;
  status: string;
  sub_phase: string | null;
  created_at: string;
  manager_id: string | null;
  manager: { full_name: string } | null;
  executive: { full_name: string } | null;
  fleet_size: number | null;
  fleet_urbano: number | null;
  fleet_seccionado: number | null;
  /** Parte da frota contratada que fica de reserva. */
  reserve_fleet: number;
  contract_date: string | null;
  /** Prazo contratual em dias, a partir da contratação (fim do contrato). */
  contractual_deadline_days: number | null;
  d_zero_date: string | null;
  handover_date: string | null;
  project_segment: string | null;
  cnpj: string | null;
  /** Quem conduz o projeto do lado do cliente. */
  client_manager_name: string | null;
  atlas_pay: boolean;
  project_type: { name: string } | null;
  project_solutions: { solution: { name: string } | null }[];
}

const COLS =
  "id, company_name, project_code, city, state, country_code, status, sub_phase, created_at, manager_id, fleet_size, fleet_urbano, fleet_seccionado, " +
  "reserve_fleet, cnpj, atlas_pay, contract_date, contractual_deadline_days, d_zero_date, handover_date, project_segment, client_manager_name, " +
  "manager:team_members!projects_manager_id_fkey(full_name), executive:team_members!projects_executive_id_fkey(full_name), " +
  "project_type:project_types(name), project_solutions(solution:solutions(name))";

export async function fetchGerProjects(): Promise<GerProject[]> {
  const { data, error } = await supabase.from("projects").select(COLS).order("company_name");
  if (error) throw error;
  return (data ?? []) as unknown as GerProject[];
}

export async function fetchGerProject(id: string): Promise<GerProject | null> {
  const { data, error } = await supabase.from("projects").select(COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as GerProject) ?? null;
}

/** Função "Coordenador de Implantação" em Equipe (Funções da equipe). */
export const PAPEL_COORDENADOR_IMPLANTACAO = "coordenador_implantacao";

/** Nome do Coordenador de Implantação; null se ninguém ou mais de uma pessoa ativa na função. */
export async function fetchCoordenadorImplantacao(): Promise<string | null> {
  // Sem filtro por tenant_id: em team_members o usuário só pode ler id, full_name, role, active e
  // created_at (permissão por coluna) — filtrar por tenant_id dá "permissão negada". A separação
  // por empresa fica com a regra "tenant guard" do banco, como nas outras telas que leem a Equipe.
  const { data, error } = await supabase.from("team_members").select("full_name")
    .eq("role", PAPEL_COORDENADOR_IMPLANTACAO).eq("active", true);
  if (error) throw error;
  return data?.length === 1 ? data[0].full_name : null;
}

const p2 = (n: number) => String(n).padStart(2, "0");
/** ISO ou AAAA-MM-DD → dd/mm/aaaa */
export const dataBr = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
};
/** ISO → dd/mm/aaaa às hh:mm */
export const dataHoraBr = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : `${dataBr(v)} às ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

/** Fim do contrato (AAAA-MM-DD): contratação + prazo contratual, a mesma conta do detalhe do projeto. */
export function fimDoContrato(p: Pick<GerProject, "contract_date" | "contractual_deadline_days">): string | null {
  if (!p.contract_date || !p.contractual_deadline_days) return null;
  const d = new Date(`${p.contract_date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + p.contractual_deadline_days);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export const solutionsOf = (p: GerProject) => p.project_solutions.map(ps => ps.solution?.name).filter((n): n is string => !!n);
/** Soluções que dependem do sinal de celular: entra a atividade do mapa de calor das operadoras. */
const SOLUCOES_COBERTURA = /carrier|\bits\b|gest[aã]o de frota/i;
/** Projeto com Carrier, ITS ou Gestão de Frota. */
export const precisaCobertura = (p: GerProject) => solutionsOf(p).some(n => SOLUCOES_COBERTURA.test(n));

/* ─── Módulo 01 ─── */
export type Responsavel = "portal" | "gp" | "assistente";
export const RESPONSAVEL_LABEL: Record<Responsavel, string> = { portal: "Automático", gp: "GP", assistente: "Assistente de Projetos" };

export type AtividadeId = "portal" | "pedidos" | "totvs" | "drive" | "checklist" | "datacenter" | "handover" | "carrier";

export interface Atividade {
  id: AtividadeId;
  titulo: string;
  descricao: string;
  responsavel: Responsavel;
  /** Campo de registro da tarefa simples (o que o GP anota ao concluir). */
  campo?: { label: string; placeholder: string; url?: boolean };
}

/** Nome provisório: os nomes dos módulos serão revistos depois. */
export const MODULO_01 = {
  numero: "01",
  nome: "Abertura do projeto (TAP)",
  resumo: "Do cadastro no portal até a reunião de Handover: o projeto sai do Comercial pronto para o time de Projetos.",
  atividades: [
    { id: "portal", titulo: "Cadastro do projeto no portal", descricao: "O portal gera o código do projeto e o projeto já sai com o GP responsável.", responsavel: "portal" },
    { id: "pedidos", titulo: "Cadastro no sistema de pedidos", descricao: "Cadastre o projeto no sistema de pedidos.", responsavel: "gp",
      campo: { label: "Número no sistema de pedidos (opcional)", placeholder: "Ex.: 2026-00123" } },
    { id: "totvs", titulo: "Cadastro no TOTVS", descricao: "Cadastre o projeto no TOTVS usando o código do projeto do portal.", responsavel: "gp",
      campo: { label: "Número do projeto no TOTVS (opcional)", placeholder: "Ex.: 000457" } },
    { id: "drive", titulo: "Pastas do projeto no Drive", descricao: "Crie as pastas do projeto no Drive da Transdata, com todos os documentos padrão de projeto.", responsavel: "gp",
      campo: { label: "Link da pasta no Drive", placeholder: "https://drive.google.com/...", url: true } },
    { id: "checklist", titulo: "Checklist de pré-requisitos", descricao: "Confira se o projeto cumpre os pré-requisitos para virar projeto.", responsavel: "gp" },
    { id: "datacenter", titulo: "Sites e credenciais no Data Center", descricao: "Peça por e-mail ao Data Center a criação dos sites do cliente no banco de dados e as credenciais de acesso.", responsavel: "gp" },
    { id: "handover", titulo: "Reunião de Handover", descricao: "Passagem de bastão do Comercial para Projetos, com o Executivo de Vendas.", responsavel: "gp" },
    { id: "carrier", titulo: "Mapa de calor das operadoras", descricao: "Envie ao cliente o comparativo de cobertura Claro × Vivo da cidade, com o mapa de calor e a operadora recomendada.", responsavel: "assistente" },
  ] as Atividade[],
};


/* ─── Checklist de pré-requisitos (modelo "Checklist · Cadastro Novo Projeto") ─── */
export type RespChecklist = "transdata" | "cliente" | "sigo";
export const RESP_CHECKLIST: Record<RespChecklist, { label: string; chip: string }> = {
  transdata: { label: "Transdata", chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  cliente: { label: "Cliente", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  sigo: { label: "Sigo", chip: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
};

export type ChecklistItemId = "contrato_transdata" | "contrato_sigo_locacao" | "contrato_sigo_pagamento" | "pagamento_dzero" | "sem_pendencias" | "conta_sigo";
/** `podeNaoAplicar`: itens do Sigo — nem todo cliente contrata o banco Sigo. */
export const CHECKLIST_ITENS: { id: ChecklistItemId; texto: string; resp: RespChecklist; vencimento?: true; podeNaoAplicar?: true }[] = [
  { id: "contrato_transdata", texto: "Contrato Transdata assinado", resp: "transdata" },
  { id: "contrato_sigo_locacao", texto: "Contrato Sigo (Locação) assinado", resp: "sigo", podeNaoAplicar: true },
  { id: "contrato_sigo_pagamento", texto: "Contrato Sigo (Meios de Pagamento) assinado", resp: "sigo", podeNaoAplicar: true },
  { id: "pagamento_dzero", texto: "Pagamento D-zero efetuado", resp: "cliente", vencimento: true },
  { id: "sem_pendencias", texto: "Cliente sem pendências financeiras", resp: "cliente" },
  { id: "conta_sigo", texto: "Abertura da Conta Sigo realizada", resp: "sigo", podeNaoAplicar: true },
];

/** Como o checklist foi liberado: com todos os itens ok ou por exceção autorizada pela diretoria. */
export type ChecklistResultado = "atendido" | "excecao";

/** Registro de uma atividade concluída. */
export interface Feito { em: string; por: string; valor?: string }

/** Estado do módulo 01 de um projeto (gravado inteiro em gerenciamento_modulo01.estado). */
export interface Modulo01Estado {
  feitos: Partial<Record<"pedidos" | "totvs" | "drive", Feito>>;
  checklist: {
    itens: Partial<Record<ChecklistItemId, boolean>>;
    /** Itens do Sigo marcados como "não se aplica" (cliente sem o banco Sigo). */
    naoAplica: Partial<Record<ChecklistItemId, boolean>>;
    /** Vencimento do boleto do D-zero (AAAA-MM-DD). */
    vencimentoDzero: string;
    observacoes: string;
    emailComercialEm: string | null;
    autorizadoPor: string;
    resultado: ChecklistResultado | null;
    em: string | null;
  };
  /**
   * `concluidoEm`: quando o GP copiou o e-mail ao Data Center (ou marcou que pediu por fora).
   * `email`: o que ele preencheu (volta preenchido ao reabrir).
   */
  datacenter: { concluidoEm: string | null; email: DataCenterForm | null };
  handover: { agendadoPara: string; participantes: string; particularidades: string; atencao: string; expectativas: string; registradoEm: string | null };
  /**
   * E-mail de cobertura ao cliente. `codIbge`: município escolhido à mão quando o nome do
   * cadastro não bate com a lista da Anatel; `para`: e-mail do cliente (opcional).
   */
  carrier: { concluidoEm: string | null; recomendada: OperadoraCobertura | null; para: string; codIbge: number | null };
}

export const modulo01Vazio = (): Modulo01Estado => ({
  feitos: {},
  checklist: { itens: {}, naoAplica: {}, vencimentoDzero: "", observacoes: "", emailComercialEm: null, autorizadoPor: "", resultado: null, em: null },
  datacenter: { concluidoEm: null, email: null },
  handover: { agendadoPara: "", participantes: "", particularidades: "", atencao: "", expectativas: "", registradoEm: null },
  carrier: { concluidoEm: null, recomendada: null, para: "", codIbge: null },
});

/** Completa com o estado vazio o que faltar no que veio do banco (o formato cresce junto com o módulo). */
export function normalizarModulo01(raw: unknown): Modulo01Estado {
  const v = modulo01Vazio();
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Modulo01Estado>;
  return {
    feitos: { ...r.feitos },
    checklist: { ...v.checklist, ...r.checklist, itens: { ...r.checklist?.itens }, naoAplica: { ...r.checklist?.naoAplica } },
    datacenter: { ...v.datacenter, ...r.datacenter },
    handover: { ...v.handover, ...r.handover },
    carrier: { ...v.carrier, ...r.carrier },
  };
}

// gerenciamento_modulo01 ainda fora do types.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** O módulo 01 gravado do projeto (vazio se o GP ainda não marcou nada) e quando foi salvo. */
export async function fetchModulo01(projectId: string): Promise<{ estado: Modulo01Estado; salvoEm: string | null }> {
  const { data, error } = await db.from("gerenciamento_modulo01").select("estado, updated_at").eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  return { estado: normalizarModulo01(data?.estado), salvoEm: data?.updated_at ?? null };
}

/** Grava o módulo 01 do projeto inteiro; devolve quando foi salvo. */
export async function salvarModulo01(projectId: string, estado: Modulo01Estado): Promise<string> {
  const { data, error } = await db.from("gerenciamento_modulo01")
    .upsert({ project_id: projectId, estado }, { onConflict: "project_id" })
    .select("updated_at").single();
  if (error) throw error;
  return data.updated_at as string;
}

export type SituacaoAtividade = "feito" | "afazer" | "aguardando" | "bloqueado" | "naoaplica";

/** Ordem original das atividades (a ordem oficial ainda está sendo discutida com os GPs). */
export const ORDEM_PADRAO: AtividadeId[] = MODULO_01.atividades.map(a => a.id);
/** O cadastro no portal é sempre o primeiro: sem ele não existe projeto. */
export const ATIVIDADE_FIXA: AtividadeId = "portal";

/** Item fora da conta: do Sigo e marcado como "não se aplica". */
export const naoAplica = (e: Modulo01Estado, i: (typeof CHECKLIST_ITENS)[number]) => !!i.podeNaoAplicar && !!e.checklist.naoAplica[i.id];
/** Itens que contam no checklist deste projeto. */
export const itensAplicaveis = (e: Modulo01Estado) => CHECKLIST_ITENS.filter(i => !naoAplica(e, i));
/** Item ok: marcado (o pagamento do D-zero também precisa do vencimento). */
export const itemOk = (e: Modulo01Estado, i: (typeof CHECKLIST_ITENS)[number]) =>
  !!e.checklist.itens[i.id] && (!i.vencimento || !!e.checklist.vencimentoDzero);
/** Pré-requisitos que se aplicam e ainda não estão ok. */
export const pendenciasDe = (e: Modulo01Estado) => itensAplicaveis(e).filter(i => !itemOk(e, i));

/** Checklist concluído: todos os itens ok, ou exceção autorizada pela diretoria, já registrado. */
export const checklistLiberado = (e: Modulo01Estado) =>
  !!e.checklist.em && (e.checklist.resultado === "excecao" || (e.checklist.resultado === "atendido" && pendenciasDe(e).length === 0));

/**
 * Situação da atividade na ordem atual. Tudo o que fica abaixo do checklist (e o Handover,
 * onde estiver) fica bloqueado até o checklist estar atendido ou com exceção da diretoria.
 */
export function situacao(a: AtividadeId, e: Modulo01Estado, p: GerProject, ordem: AtividadeId[] = ORDEM_PADRAO): SituacaoAtividade {
  if (a === "portal") return "feito";
  if (a === "carrier" && !precisaCobertura(p)) return "naoaplica";
  const feito = a === "checklist" ? checklistLiberado(e)
    : a === "datacenter" ? !!e.datacenter.concluidoEm
    : a === "handover" ? !!e.handover.registradoEm
    : a === "carrier" ? !!e.carrier.concluidoEm
    : !!e.feitos[a];
  if (feito) return "feito";
  const abaixoDoChecklist = ordem.indexOf(a) > ordem.indexOf("checklist");
  if ((abaixoDoChecklist || a === "handover") && !checklistLiberado(e)) return "bloqueado";
  if (a === "checklist" && e.checklist.emailComercialEm) return "aguardando";
  return "afazer";
}
