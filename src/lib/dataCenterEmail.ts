// E-mail ao Data Center (criação do site do cliente no BD): o GP completa o que varia,
// o resto vem do cadastro do projeto. O portal monta o HTML para colar no Outlook.
import type { GerProject } from "@/lib/gerenciamento";
import { cnpjDigits } from "@/lib/cnpj";
import { escHtml, estiloTexto } from "@/lib/emailOutlook";

export const DC_DESTINATARIO = "meusuporte@itstransdata.com";
export const SISTEMAS = ["TDMax Urbano", "TDMax Seccionado", "ITS", "Gestão de Frota"] as const;
export type SistemaDC = (typeof SISTEMAS)[number];

/** O que o GP escolhe ou digita. */
export interface DataCenterForm {
  /** Código do cliente, 5 dígitos (ex.: 00745). */
  codigo: string;
  /** Um ou mais (ex.: TDMax Urbano e TDMax Seccionado no mesmo cliente). */
  sistemas: SistemaDC[];
  recolhimento: "com" | "sem";
  migracao: boolean;
  migracaoDe: string;
  prefixo: string;
  mascara: string;
  crm: boolean;
  recarga: boolean;
  abt: boolean;
  billing: boolean;
  observacoes: string;
}

const solucoes = (p: GerProject) => p.project_solutions.map(s => s.solution?.name ?? "").filter(Boolean);
const temSolucao = (p: GerProject, re: RegExp) => solucoes(p).some(n => re.test(n));
export const temCarrier = (p: GerProject) => temSolucao(p, /carrier/i);

/** Sistemas sugeridos pelo cadastro (o GP marca ou desmarca). */
export function sistemasSugeridos(p: GerProject): SistemaDC[] {
  const its = temSolucao(p, /\bits\b/i), frota = temSolucao(p, /gest[aã]o de frota/i);
  const out: SistemaDC[] = [];
  if (temSolucao(p, /bilhet/i) || (!its && !frota)) {
    const urb = p.fleet_urbano ?? 0, sec = p.fleet_seccionado ?? 0;
    if (urb > 0 || sec === 0) out.push("TDMax Urbano");
    if (sec > 0) out.push("TDMax Seccionado");
  }
  if (its) out.push("ITS");
  if (frota) out.push("Gestão de Frota");
  return out;
}

/** Valores iniciais: o mais comum hoje, para o GP só ajustar o que muda. */
export const formInicial = (p: GerProject): DataCenterForm => ({
  codigo: "", sistemas: sistemasSugeridos(p), recolhimento: "sem", migracao: false, migracaoDe: "",
  prefixo: "4", mascara: "4",
  crm: true, recarga: true, abt: false, billing: false, observacoes: "",
});

/** Marca ou desmarca um sistema, mantendo a ordem da lista. */
export const alternarSistema = (atuais: SistemaDC[], s: SistemaDC) =>
  SISTEMAS.filter(x => (x === s ? !atuais.includes(s) : atuais.includes(x)));

const dois = (n: number) => String(Math.max(0, n)).padStart(2, "0");
export const soDigitos = (s: string) => s.replace(/\D/g, "");
export const cidadeUf = (p: GerProject) => [p.city, p.state].filter(Boolean).join("/");
export const razaoSocial = (p: GerProject) => p.company_name.trim().toUpperCase();
/** Frota do cadastro: a contratada é o total e a reserva faz parte dela. */
export const totalCarros = (p: GerProject) => p.fleet_size ?? 0;
export const reservas = (p: GerProject) => p.reserve_fleet ?? 0;
export const licenciados = (p: GerProject) => Math.max(0, totalCarros(p) - reservas(p));
/** O CNPJ vem só do cadastro do projeto. */
export const temCnpj = (p: GerProject) => cnpjDigits(p.cnpj ?? "").length === 14;

/** TDMax Urbano e Seccionado entram no código só como "TDMax"; vários sistemas: "TDMax/ITS". */
const sufixoSistemas = (s: SistemaDC[]) =>
  [...new Set(s.map(x => (x.startsWith("TDMax") ? "TDMax" : x)))].join("/") || "Sistema";
export const sistemasTexto = (s: SistemaDC[]) => s.join(", ") || "—";
/** "00745 - MARISUL TRANSPORTES LTDA-Marau/RS-TDMax" */
export const codigoCliente = (p: GerProject, f: DataCenterForm) =>
  `${f.codigo || "_____"} - ${razaoSocial(p)}-${cidadeUf(p)}-${sufixoSistemas(f.sistemas)}`;
export const assuntoDC = (p: GerProject, f: DataCenterForm) => `DATA CENTER | CRIAR SITE NO BD | ${codigoCliente(p, f)}`;

/** O que ainda falta para o e-mail ficar pronto. */
export function faltando(p: GerProject, f: DataCenterForm): string[] {
  const out: string[] = [];
  if (!/^\d{5}$/.test(f.codigo)) out.push("Código do cliente com 5 dígitos");
  if (!f.sistemas.length) out.push("Sistema");
  if (f.migracao && !f.migracaoDe.trim()) out.push("Sistema de origem da migração");
  if (!soDigitos(f.prefixo)) out.push("Dígitos do prefixo");
  if (!soDigitos(f.mascara)) out.push("Máscara da linha");
  if (!temCnpj(p)) out.push("CNPJ no cadastro do projeto");
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
      { label: "Sistema", valor: sistemasTexto(f.sistemas), origem: "gp" },
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
      { label: "CNPJ", valor: p.cnpj || "—", origem: "cadastro" },
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

const esc = escHtml;
const txt = estiloTexto;

/**
 * HTML do e-mail para colar no Outlook: só o que ele mantém ao colar (ver src/lib/emailOutlook.ts):
 * tabela simples, cor de fundo na célula (bgcolor) e o estilo declarado em cada texto.
 * Os títulos já vão escritos em maiúsculas.
 */
export function emailHtmlDC(p: GerProject, f: DataCenterForm, gp: string): string {
  const linha = "border-top:1px solid #e3dcec;";
  const grupos = linhasDC(p, f).map(g => {
    const head = `<tr><td colspan="2" bgcolor="#efe6f6" style="${txt(11, "#4b1768", true)}background-color:#efe6f6;padding:8px 16px;${linha}">${esc(g.grupo.toUpperCase())}</td></tr>`;
    const rows = g.linhas.map(l => {
      const valor = !l.simNao ? `<span style="${txt(13, "#1f1630", true)}">${esc(l.valor)}</span>`
        : l.valor === "Sim" ? `<span style="${txt(13, "#047857", true)}">&#9679;&nbsp;Sim</span>`
        : `<span style="${txt(13, "#8a8197")}">&#9675;&nbsp;Não</span>`;
      return `<tr><td width="42%" valign="top" style="${txt(13, "#645a72")}width:42%;padding:8px 16px;${linha}">${esc(l.label)}</td>`
        + `<td valign="top" style="${txt(13, "#1f1630", true)}padding:8px 16px;${linha}">${valor}</td></tr>`;
    }).join("");
    return head + rows;
  }).join("");
  const p0 = (texto: string, extra = "") => `<p style="${txt(14, "#1f1630")}margin:0;${extra}">${texto}</p>`;
  return p0("Prezados,")
    + p0("Segue solicitação para criação do ambiente no data center.", "margin-bottom:14px;")
    + `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;border:1px solid #e3dcec;">`
    + `<tr><td colspan="2" bgcolor="#4b1768" style="background-color:#4b1768;padding:14px 16px;">`
    + `<p style="${txt(11, "#dcc8ec", true)}margin:0;">DATA CENTER &nbsp;|&nbsp; CRIAR SITE NO BD</p>`
    + `<p style="${txt(16, "#ffffff", true)}margin:4px 0 0 0;">${esc(codigoCliente(p, f))}</p></td></tr>`
    + grupos
    + `</table>`
    + p0("Atenciosamente,", "margin-top:16px;")
    + p0(`<b style="${txt(14, "#1f1630", true)}">${esc(gp)}</b>`)
    + `<p style="${txt(13, "#645a72")}margin:0;">Gerente de Projetos · Transdata</p>`;
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
