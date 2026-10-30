// Dashboard de projetos: os filtros e as contas de cada bloco (status, carga por gerente, soluções,
// frota e estados), separados da tela para serem testados.
import type { Database } from "@/integrations/supabase/types";

export type ProjectStatus = Database["public"]["Enums"]["project_status"];
/** As colunas do Kanban, na ordem. */
export const STATUS_ORDEM: ProjectStatus[] = ["comercial", "planejamento", "implantacao", "encerrado", "suspenso"];

export interface DashProject {
  id: string;
  company_name: string;
  project_code: string | null;
  city: string;
  state: string;
  contract_date: string;
  d_zero_date: string | null;
  status: ProjectStatus;
  sub_phase: string | null;
  fleet_size: number | null;
  is_pilot: boolean;
  complementary_sale: boolean;
  complementary_fleet: number;
  implemented_fleet: number;
  reached_implemented: boolean;
  manager_id: string | null;
  manager: { full_name: string } | null;
  project_solutions: { solution: { name: string } | null }[];
}

/** Frota do projeto: a contratada mais a da venda complementar. */
export const frotaDe = (p: DashProject) => (p.fleet_size || 0) + (p.complementary_sale ? p.complementary_fleet || 0 : 0);

/**
 * Status para as contas: quem já chegou a Implementado continua contado como Implementado, mesmo
 * que tenha voltado para outra coluna.
 */
export const statusEfetivo = (p: DashProject): ProjectStatus => (p.reached_implemented ? "encerrado" : p.status);

/** Outros › Cancelado e Outros › Piloto reprovado não entram em nenhum número do Dashboard. */
export const descartado = (p: Pick<DashProject, "status" | "sub_phase">) =>
  p.status === "suspenso" && (p.sub_phase === "cancelado" || p.sub_phase === "piloto_reprovado");

/**
 * Carga do GP: o projeto está na coluna Comercial, Planejamento, Implantação ou Outros › Suspenso
 * do Kanban (Implementado não conta).
 */
export const emAndamento = (p: DashProject) => p.status !== "encerrado";

export const SEM_GERENTE = "Sem gerente";
export const gerenteDe = (p: DashProject) => p.manager?.full_name || SEM_GERENTE;
export const solucoesDe = (p: DashProject) => p.project_solutions.map(ps => ps.solution?.name).filter((n): n is string => !!n);

/* ─── Filtros ─── */

/** `de`/`ate`: AAAA-MM-DD da data de contrato; os outros: "all" ou o valor; `busca`: nome ou código. */
export interface FiltrosDash { de: string | null; ate: string | null; status: string; solucao: string; estado: string; cidade: string; gerente: string; busca: string }
export const FILTROS_PADRAO: FiltrosDash = { de: null, ate: null, status: "all", solucao: "all", estado: "all", cidade: "all", gerente: "all", busca: "" };
export type ChaveFiltro = keyof FiltrosDash;

export const temFiltro = (f: FiltrosDash) => (Object.keys(FILTROS_PADRAO) as ChaveFiltro[]).some(k => f[k] !== FILTROS_PADRAO[k]);
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Os projetos que passam nos filtros. `ignorar`: um filtro que o bloco não aplica nele mesmo (o
 * bloco de status mostra todos os status e destaca o escolhido, por exemplo).
 */
export function filtrar(ps: DashProject[], f: FiltrosDash, ignorar?: ChaveFiltro): DashProject[] {
  const q = semAcento(f.busca.trim());
  const usa = (k: ChaveFiltro) => k !== ignorar;
  return ps.filter(p => {
    if (usa("status") && f.status !== "all" && statusEfetivo(p) !== f.status) return false;
    if (usa("estado") && f.estado !== "all" && p.state !== f.estado) return false;
    if (usa("cidade") && f.cidade !== "all" && p.city !== f.cidade) return false;
    if (usa("solucao") && f.solucao !== "all" && !solucoesDe(p).includes(f.solucao)) return false;
    if (usa("gerente") && f.gerente !== "all" && gerenteDe(p) !== f.gerente) return false;
    if (usa("de") && f.de && p.contract_date.slice(0, 10) < f.de) return false;
    if (usa("ate") && f.ate && p.contract_date.slice(0, 10) > f.ate) return false;
    if (usa("busca") && q && !semAcento(`${p.company_name} ${p.project_code ?? ""}`).includes(q)) return false;
    return true;
  });
}

/* ─── Contas ─── */

export const porcentagem = (n: number, total: number) => (total ? Math.round((n * 100) / total) : 0);

export function contarStatus(ps: DashProject[]): Record<ProjectStatus, number> {
  const c = { comercial: 0, planejamento: 0, implantacao: 0, encerrado: 0, suspenso: 0 };
  ps.forEach(p => { c[statusEfetivo(p)] += 1; });
  return c;
}

/**
 * Veículos por status, como já era no Dashboard: com frota implementada, ela conta em Implementado
 * e o resto no status do projeto; sem, a frota toda fica no status do projeto.
 */
export function frotaPorStatus(ps: DashProject[]): Record<ProjectStatus, number> {
  const m = { comercial: 0, planejamento: 0, implantacao: 0, encerrado: 0, suspenso: 0 };
  ps.forEach(p => {
    const total = frotaDe(p), impl = Math.min(p.implemented_fleet || 0, total), st = statusEfetivo(p);
    if (impl > 0) {
      m.encerrado += impl;
      if (st !== "encerrado") m[st] += total - impl;
    } else m[st] += total;
  });
  return m;
}

export interface CargaGerente {
  nome: string;
  /** null em "Sem gerente". */
  id: string | null;
  comercial: number; planejamento: number; implantacao: number; suspenso: number; implementados: number;
  emAndamento: number; total: number;
}
/** Projetos de cada gerente pela coluna do Kanban. Quem tem menos em andamento vem primeiro. */
export function cargaPorGerente(ps: DashProject[]): CargaGerente[] {
  const m = new Map<string, CargaGerente>();
  ps.forEach(p => {
    const nome = gerenteDe(p);
    const g = m.get(nome) ?? { nome, id: p.manager?.full_name ? p.manager_id : null, comercial: 0, planejamento: 0, implantacao: 0, suspenso: 0, implementados: 0, emAndamento: 0, total: 0 };
    if (p.status === "encerrado") g.implementados += 1; else g[p.status] += 1;
    if (emAndamento(p)) g.emAndamento += 1;
    g.total += 1;
    m.set(nome, g);
  });
  return Array.from(m.values()).sort((a, b) => a.emAndamento - b.emAndamento || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Projetos por solução, da mais usada para a menos usada. */
export function porSolucao(ps: DashProject[]): { nome: string; n: number }[] {
  const c = new Map<string, number>();
  ps.forEach(p => solucoesDe(p).forEach(s => c.set(s, (c.get(s) ?? 0) + 1)));
  return Array.from(c, ([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function porEstado(ps: DashProject[]): Record<string, number> {
  const c: Record<string, number> = {};
  ps.forEach(p => { if (p.state) c[p.state] = (c[p.state] ?? 0) + 1; });
  return c;
}

/* ─── Linha do tempo (mês a mês, pela data de contrato) ─── */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2026-10" → "out/26" */
export const rotuloMes = (chave: string) => `${MESES[Number(chave.slice(5, 7)) - 1]}/${chave.slice(2, 4)}`;
const chaveMes = (d: string) => d.slice(0, 7);
function proximoMes(chave: string) {
  const a = Number(chave.slice(0, 4)), m = Number(chave.slice(5, 7));
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}
/** Todos os meses do primeiro contrato até `ate` (AAAA-MM), sem buracos: o eixo do tempo fica proporcional. */
function mesesAte(ps: DashProject[], ate: string): string[] {
  if (!ps.length) return [];
  let m = ps.reduce((min, p) => (chaveMes(p.contract_date) < min ? chaveMes(p.contract_date) : min), "9999-99");
  const fim = ps.reduce((max, p) => (chaveMes(p.contract_date) > max ? chaveMes(p.contract_date) : max), ate);
  const out: string[] = [];
  for (let i = 0; m <= fim && i < 600; i++, m = proximoMes(m)) out.push(m);
  return out;
}

/** Frota acumulada mês a mês (veículos contratados até aquele mês). */
export function evolucaoFrota(ps: DashProject[], ate: string): { chave: string; mes: string; frota: number }[] {
  const porMes = new Map<string, number>();
  ps.forEach(p => { const f = frotaDe(p); if (f) porMes.set(chaveMes(p.contract_date), (porMes.get(chaveMes(p.contract_date)) ?? 0) + f); });
  let acc = 0;
  return mesesAte(ps.filter(p => frotaDe(p) > 0), ate).map(chave => { acc += porMes.get(chave) ?? 0; return { chave, mes: rotuloMes(chave), frota: acc }; });
}

/**
 * Frota acumulada por solução, mês a mês. `destaques`: as soluções de maior frota no fim (as outras
 * aparecem em cinza no gráfico).
 */
export function evolucaoSolucoes(ps: DashProject[], ate: string, nDestaques = 4) {
  const comFrota = ps.filter(p => frotaDe(p) > 0 && solucoesDe(p).length);
  const nomes = Array.from(new Set(comFrota.flatMap(solucoesDe)));
  const porMes = new Map<string, Map<string, number>>();
  comFrota.forEach(p => {
    const k = chaveMes(p.contract_date), mm = porMes.get(k) ?? new Map<string, number>();
    solucoesDe(p).forEach(s => mm.set(s, (mm.get(s) ?? 0) + frotaDe(p)));
    porMes.set(k, mm);
  });
  const acc: Record<string, number> = Object.fromEntries(nomes.map(n => [n, 0]));
  const linhas = mesesAte(comFrota, ate).map(chave => {
    porMes.get(chave)?.forEach((v, s) => { acc[s] += v; });
    return { chave, mes: rotuloMes(chave), ...acc } as { chave: string; mes: string } & Record<string, number>;
  });
  const finais = nomes.map(nome => ({ nome, total: acc[nome] })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  return { linhas, destaques: finais.slice(0, nDestaques), outras: finais.slice(nDestaques) };
}

/* ─── Exportar ─── */

const celula = (v: string | number) => {
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Marca de UTF-8 no começo do arquivo: sem ela o Excel lê os acentos errado. */
const BOM = String.fromCharCode(0xfeff);
/** Quebra de linha do Windows, a que o Excel espera. */
const FIM_DE_LINHA = String.fromCharCode(13, 10);
/** Planilha (CSV com ";", que o Excel em português abre direto) dos projetos do painel. */
export function csvProjetos(ps: DashProject[], rotulos: Record<ProjectStatus, string>): string {
  const cab = ["Projeto", "Código", "Cidade", "UF", "Status", "Gerente de Projetos", "Frota", "Soluções", "Contrato", "D-zero"];
  const data = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
  const linhas = ps.map(p => [
    p.company_name, p.project_code ?? "", p.city, p.state, rotulos[statusEfetivo(p)], gerenteDe(p), frotaDe(p), solucoesDe(p).join(", "), data(p.contract_date), data(p.d_zero_date),
  ].map(celula).join(";"));
  return BOM + [cab.join(";"), ...linhas].join(FIM_DE_LINHA);
}
