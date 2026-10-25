// E-mail ao Data Center (criação do site do cliente no BD): o GP completa o que varia,
// o resto vem do cadastro do projeto. O portal monta o HTML para colar no Outlook.
import type { GerProject } from "@/lib/gerenciamento";
import { cnpjDigits } from "@/lib/cnpj";

export const DC_DESTINATARIO = "meusuporte@itstransdata.com";
export const SISTEMAS = ["TDMax Urbano", "TDMax Seccionado", "ITS", "Gestão de Frota"] as const;
export type SistemaDC = (typeof SISTEMAS)[number];

/** O que o GP escolhe ou digita. */
export interface DataCenterForm {
  /** Código do cliente, 5 dígitos (ex.: 00745). */
  codigo: string;
  sistema: SistemaDC | "";
  recolhimento: "com" | "sem";
  migracao: boolean;
  migracaoDe: string;
  prefixo: string;
  mascara: string;
  /** Só quando o projeto ainda não tem CNPJ no cadastro. */
  cnpj: string;
  crm: boolean;
  recarga: boolean;
  abt: boolean;
  billing: boolean;
  observacoes: string;
}

const solucoes = (p: GerProject) => p.project_solutions.map(s => s.solution?.name ?? "").filter(Boolean);
const temSolucao = (p: GerProject, re: RegExp) => solucoes(p).some(n => re.test(n));
export const temCarrier = (p: GerProject) => temSolucao(p, /carrier/i);

/** Sistema sugerido pelo cadastro (o GP pode trocar). */
function sistemaSugerido(p: GerProject): SistemaDC {
  if (temSolucao(p, /gest[aã]o de frota/i) && !temSolucao(p, /bilhet/i)) return "Gestão de Frota";
  if (temSolucao(p, /\bits\b/i) && !temSolucao(p, /bilhet/i)) return "ITS";
  if ((p.fleet_seccionado ?? 0) > 0 && !(p.fleet_urbano ?? 0)) return "TDMax Seccionado";
  return "TDMax Urbano";
}

/** Valores iniciais: o mais comum hoje, para o GP só ajustar o que muda. */
export const formInicial = (p: GerProject): DataCenterForm => ({
  codigo: "", sistema: sistemaSugerido(p), recolhimento: "sem", migracao: false, migracaoDe: "",
  prefixo: "4", mascara: "4", cnpj: "",
  crm: true, recarga: true, abt: false, billing: false, observacoes: "",
});

const dois = (n: number) => String(Math.max(0, n)).padStart(2, "0");
export const soDigitos = (s: string) => s.replace(/\D/g, "");
export const cidadeUf = (p: GerProject) => [p.city, p.state].filter(Boolean).join("/");
export const razaoSocial = (p: GerProject) => p.company_name.trim().toUpperCase();
/** Frota do cadastro: a contratada é o total e a reserva faz parte dela. */
export const totalCarros = (p: GerProject) => p.fleet_size ?? 0;
export const reservas = (p: GerProject) => p.reserve_fleet ?? 0;
export const licenciados = (p: GerProject) => Math.max(0, totalCarros(p) - reservas(p));
/** CNPJ do cadastro; sem ele, o que o GP informou no e-mail. */
export const cnpjDC = (p: GerProject, f: DataCenterForm) => p.cnpj || f.cnpj;

/** TDMax Urbano e Seccionado entram no código só como "TDMax". */
const sufixoSistema = (s: DataCenterForm["sistema"]) => (s.startsWith("TDMax") ? "TDMax" : s || "Sistema");
/** "00745 - MARISUL TRANSPORTES LTDA-Marau/RS-TDMax" */
export const codigoCliente = (p: GerProject, f: DataCenterForm) =>
  `${f.codigo || "_____"} - ${razaoSocial(p)}-${cidadeUf(p)}-${sufixoSistema(f.sistema)}`;
export const assuntoDC = (p: GerProject, f: DataCenterForm) => `DATA CENTER | CRIAR SITE NO BD | ${codigoCliente(p, f)}`;

/** O que ainda falta para o e-mail ficar pronto. */
export function faltando(p: GerProject, f: DataCenterForm): string[] {
  const out: string[] = [];
  if (!/^\d{5}$/.test(f.codigo)) out.push("Código do cliente com 5 dígitos");
  if (!f.sistema) out.push("Sistema");
  if (f.migracao && !f.migracaoDe.trim()) out.push("Sistema de origem da migração");
  if (!soDigitos(f.prefixo)) out.push("Dígitos do prefixo");
  if (!soDigitos(f.mascara)) out.push("Máscara da linha");
  if (cnpjDigits(cnpjDC(p, f)).length !== 14) out.push("CNPJ completo");
  return out;
}

export interface LinhaDC { label: string; valor: string; origem: "padrao" | "cadastro" | "gp"; simNao?: boolean }
const sn = (b: boolean) => (b ? "Sim" : "Não");

/** Linhas do e-mail, na ordem do modelo do Data Center, em grupos. */
export function linhasDC(p: GerProject, f: DataCenterForm): { grupo: string; linhas: LinhaDC[] }[] {
  return [
    { grupo: "Solicitação", linhas: [
      { label: "Selo", valor: "Liberação para Criação do BD no DC", origem: "padrao" },
      { label: "Departamento", valor: "CPQ - PMO", origem: "padrao" },
      { label: "Código do Cliente", valor: codigoCliente(p, f), origem: "gp" },
      { label: "Sistema", valor: f.sistema || "—", origem: "gp" },
    ] },
    { grupo: "Configuração", linhas: [
      { label: "Com ou Sem Recolhimento", valor: f.recolhimento === "com" ? "Com recolhimento" : "Sem recolhimento", origem: "gp" },
      { label: "Migração (S/N). Se sim, de qual sistema", valor: f.migracao ? `Sim, ${f.migracaoDe.trim() || "—"}` : "Não", origem: "gp" },
      { label: "Dígitos do Prefixo", valor: soDigitos(f.prefixo) || "—", origem: "gp" },
      { label: "Máscara da Linha", valor: soDigitos(f.mascara) || "—", origem: "gp" },
      { label: "Observações", valor: f.observacoes.trim() || "—", origem: "gp" },
    ] },
    { grupo: "Cliente e frota", linhas: [
      { label: "Cidade/UF", valor: cidadeUf(p), origem: "cadastro" },
      { label: "Quantidade de carros licenciados", valor: dois(licenciados(p)), origem: "cadastro" },
      { label: "Quantidade de carros reservas", valor: dois(reservas(p)), origem: "cadastro" },
      { label: "Quantidade total de carros", valor: dois(totalCarros(p)), origem: "cadastro" },
      { label: "CNPJ", valor: cnpjDC(p, f) || "—", origem: p.cnpj ? "cadastro" : "gp" },
      { label: "Razão Social", valor: razaoSocial(p), origem: "cadastro" },
    ] },
    { grupo: "Módulos", linhas: [
      { label: "AtlasPay", valor: sn(p.atlas_pay), origem: "cadastro", simNao: true },
      { label: "Carrier", valor: sn(temCarrier(p)), origem: "cadastro", simNao: true },
      { label: "CRM", valor: sn(f.crm), origem: "gp", simNao: true },
      { label: "Recarga Embarcada", valor: sn(f.recarga), origem: "gp", simNao: true },
      { label: "TDMax Sendmail", valor: "Sim", origem: "padrao", simNao: true },
      { label: "ABT", valor: sn(f.abt), origem: "gp", simNao: true },
      { label: "Atlas TDCE", valor: "Sim", origem: "padrao", simNao: true },
      { label: "Billing", valor: sn(f.billing), origem: "gp", simNao: true },
      { label: "Bilhetagem", valor: "Sim", origem: "padrao", simNao: true },
    ] },
  ];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** HTML do e-mail com estilos em linha e tabela (é o que o Outlook respeita ao colar). */
export function emailHtmlDC(p: GerProject, f: DataCenterForm, gp: string): string {
  const font = "font-family:Arial,Helvetica,sans-serif;";
  const grupos = linhasDC(p, f).map(g => {
    const head = `<tr><td colspan="2" style="${font}background:#efe6f6;color:#4b1768;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:7px 14px;border-top:1px solid #e3dcec;">${esc(g.grupo)}</td></tr>`;
    const rows = g.linhas.map(l => {
      const valor = l.simNao
        ? `<span style="${font}display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;font-weight:bold;${l.valor === "Sim" ? "background:#dcf3ea;color:#047857;" : "background:#f1f0f3;color:#645a72;"}">${esc(l.valor)}</span>`
        : esc(l.valor);
      return `<tr><td style="${font}width:46%;padding:7px 14px;border-top:1px solid #e3dcec;color:#645a72;font-size:13px;vertical-align:top;">${esc(l.label)}</td><td style="${font}padding:7px 14px;border-top:1px solid #e3dcec;color:#1f1630;font-size:13px;font-weight:bold;vertical-align:top;">${valor}</td></tr>`;
    }).join("");
    return head + rows;
  }).join("");
  return `<div style="${font}color:#1f1630;font-size:14px;line-height:1.5;">`
    + `<p style="margin:0 0 4px 0;">Prezados,</p>`
    + `<p style="margin:0 0 16px 0;">Segue solicitação para criação do ambiente no data center.</p>`
    + `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;border:1px solid #e3dcec;">`
    + `<tr><td colspan="2" style="${font}background:#4b1768;color:#ffffff;padding:12px 14px;">`
    + `<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.8;">Data Center · Criar site no BD</div>`
    + `<div style="font-size:15px;font-weight:bold;margin-top:2px;">${esc(codigoCliente(p, f))}</div></td></tr>`
    + grupos
    + `</table>`
    + `<p style="margin:16px 0 0 0;">Atenciosamente,<br><b>${esc(gp)}</b><br><span style="color:#645a72;">Gerente de Projetos · Transdata</span></p>`
    + `</div>`;
}

/** Versão em texto (para quem colar onde não aceita formatação). */
export function emailTextoDC(p: GerProject, f: DataCenterForm, gp: string): string {
  const corpo = linhasDC(p, f).flatMap(g => g.linhas.map(l => `${l.label}: ${l.valor}`));
  return ["Prezados,", "", "Segue solicitação para criação do ambiente no data center.", "", ...corpo, "", "Atenciosamente,", gp, "Gerente de Projetos · Transdata"].join("\n");
}

/** Abre o e-mail no Outlook (programa) já com destinatário e assunto. */
export const mailtoDC = (p: GerProject, f: DataCenterForm) =>
  `mailto:${DC_DESTINATARIO}?subject=${encodeURIComponent(assuntoDC(p, f))}`;
/** Abre o e-mail no Outlook na web já com destinatário e assunto. */
export const outlookWebDC = (p: GerProject, f: DataCenterForm) =>
  `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(DC_DESTINATARIO)}&subject=${encodeURIComponent(assuntoDC(p, f))}`;
