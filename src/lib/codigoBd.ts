// E-mails ao meusuporte pedindo o cadastro do cliente: no banco de dados (código BD) e no ITS /
// Gestão de frota (código ITS / Gestão de frota). Tudo vem do cadastro do projeto; o código de 5
// dígitos que volta é anotado na atividade (o código BD também preenche o e-mail ao Data Center).
// O HTML segue o mesmo modelo que o Outlook mantém ao colar (src/lib/emailOutlook.ts).
import { solutionsOf, type GerProject } from "@/lib/gerenciamento";
import { DC_DESTINATARIO, cidadeUf, razaoSocial, sistemasSugeridos, sistemasTexto, temCnpj, totalCarros } from "@/lib/dataCenterEmail";
import { escHtml, estiloTexto } from "@/lib/emailOutlook";

export const CODIGO_BD_DESTINATARIO = DC_DESTINATARIO;

/** Qual cadastro o e-mail pede: banco de dados ou ITS / Gestão de frota. */
export type TipoCodigo = "bd" | "its";
export const TIPOS_CODIGO: Record<TipoCodigo, { nome: string; titulo: string; pedido: string }> = {
  bd: { nome: "código BD", titulo: "CADASTRO DO CÓDIGO BD", pedido: "Segue solicitação para cadastro do cliente no banco de dados (código BD)." },
  its: {
    nome: "código ITS / Gestão de frota", titulo: "CADASTRO DO CÓDIGO ITS / GESTÃO DE FROTA",
    pedido: "Segue solicitação para cadastro do cliente no ITS / Gestão de frota (código ITS / Gestão de frota).",
  },
};

/** Soluções de ITS e Gestão de frota do projeto ("ITS (legado), Gestão de frota"). */
const SOLUCOES_ITS = /\bits\b|gest[aã]o de frota/i;
export const solucoesIts = (p: GerProject) => solutionsOf(p).filter(s => SOLUCOES_ITS.test(s));

/** "CACSCASUPG0008": o código do projeto sem o nome da empresa que o portal põe no final. */
export const codigoBase = (p: GerProject) => (p.project_code ?? "").split("-")[0].trim();
/** "CACSCASUPG0008 - AUTO COLETIVO CACADOR LTDA" */
export const codigoProjetoBd = (p: GerProject) => `${codigoBase(p) || "—"} - ${razaoSocial(p)}`;
export const assuntoCodigo = (p: GerProject, t: TipoCodigo) => `${TIPOS_CODIGO[t].titulo} | ${codigoProjetoBd(p)}`;
export const assuntoCodigoBd = (p: GerProject) => assuntoCodigo(p, "bd");

export interface LinhaCodigoBd { label: string; valor: string }
/** Itens do e-mail, na ordem do modelo. */
export const linhasCodigo = (p: GerProject, t: TipoCodigo): LinhaCodigoBd[] => [
  { label: "Código do Projeto", valor: codigoProjetoBd(p) },
  { label: "Razão Social", valor: razaoSocial(p) },
  { label: "CNPJ", valor: p.cnpj || "—" },
  ...(t === "bd"
    ? [{ label: "Sistema", valor: sistemasTexto(sistemasSugeridos(p)) }]
    : [{ label: "Solução", valor: solucoesIts(p).join(", ") || "—" }, { label: "Frota", valor: `${totalCarros(p)} veículos` }]),
  { label: "Cidade", valor: cidadeUf(p) || "—" },
];
export const linhasCodigoBd = (p: GerProject) => linhasCodigo(p, "bd");

/** O que ainda falta no cadastro para o e-mail ficar pronto. */
export function faltandoCodigoBd(p: GerProject): string[] {
  const out: string[] = [];
  if (!codigoBase(p)) out.push("Código do projeto");
  if (!temCnpj(p)) out.push("CNPJ no cadastro do projeto");
  return out;
}

const txt = estiloTexto;

export function emailHtmlCodigo(p: GerProject, gp: string, t: TipoCodigo): string {
  const linha = "border-top:1px solid #e3dcec;";
  const rows = linhasCodigo(p, t).map(l =>
    `<tr><td width="42%" valign="top" style="${txt(13, "#645a72")}width:42%;padding:8px 16px;${linha}">${escHtml(l.label)}</td>`
    + `<td valign="top" style="${txt(13, "#1f1630", true)}padding:8px 16px;${linha}">${escHtml(l.valor)}</td></tr>`).join("");
  const p0 = (texto: string, extra = "") => `<p style="${txt(14, "#1f1630")}margin:0;${extra}">${texto}</p>`;
  return p0("Prezados,")
    + p0(escHtml(TIPOS_CODIGO[t].pedido), "margin-bottom:14px;")
    + `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;border:1px solid #e3dcec;">`
    + `<tr><td colspan="2" bgcolor="#4b1768" style="background-color:#4b1768;padding:14px 16px;">`
    + `<p style="${txt(11, "#dcc8ec", true)}margin:0;">${escHtml(TIPOS_CODIGO[t].titulo)}</p>`
    + `<p style="${txt(16, "#ffffff", true)}margin:4px 0 0 0;">${escHtml(codigoProjetoBd(p))}</p></td></tr>`
    + rows
    + `</table>`
    + p0("Atenciosamente,", "margin-top:16px;")
    + p0(`<b style="${txt(14, "#1f1630", true)}">${escHtml(gp)}</b>`)
    + `<p style="${txt(13, "#645a72")}margin:0;">Gerente de Projetos · Transdata</p>`;
}
export const emailHtmlCodigoBd = (p: GerProject, gp: string) => emailHtmlCodigo(p, gp, "bd");

/** Versão em texto (para quem colar onde não aceita formatação). */
export function emailTextoCodigo(p: GerProject, gp: string, t: TipoCodigo): string {
  return ["Prezados,", "", TIPOS_CODIGO[t].pedido, "",
    ...linhasCodigo(p, t).map(l => `${l.label}: ${l.valor}`), "", "Atenciosamente,", gp, "Gerente de Projetos · Transdata"].join("\n");
}
export const emailTextoCodigoBd = (p: GerProject, gp: string) => emailTextoCodigo(p, gp, "bd");

/** Abre o e-mail no Outlook (programa) já com destinatário e assunto. */
export const mailtoCodigo = (p: GerProject, t: TipoCodigo) =>
  `mailto:${CODIGO_BD_DESTINATARIO}?subject=${encodeURIComponent(assuntoCodigo(p, t))}`;
export const mailtoCodigoBd = (p: GerProject) => mailtoCodigo(p, "bd");
/** Abre o e-mail no Outlook na web já com destinatário e assunto. */
export const outlookWebCodigo = (p: GerProject, t: TipoCodigo) =>
  `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(CODIGO_BD_DESTINATARIO)}&subject=${encodeURIComponent(assuntoCodigo(p, t))}`;
export const outlookWebCodigoBd = (p: GerProject) => outlookWebCodigo(p, "bd");
