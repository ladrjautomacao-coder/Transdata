// E-mail ao meusuporte pedindo o cadastro do cliente no banco de dados (código BD). Tudo vem do
// cadastro do projeto; o código de 5 dígitos que volta é anotado na atividade e preenche o e-mail
// ao Data Center. O HTML segue o mesmo modelo que o Outlook mantém ao colar (src/lib/emailOutlook.ts).
import type { GerProject } from "@/lib/gerenciamento";
import { DC_DESTINATARIO, cidadeUf, razaoSocial, sistemasSugeridos, sistemasTexto, temCnpj } from "@/lib/dataCenterEmail";
import { escHtml, estiloTexto } from "@/lib/emailOutlook";

export const CODIGO_BD_DESTINATARIO = DC_DESTINATARIO;

/** "CACSCASUPG0008": o código do projeto sem o nome da empresa que o portal põe no final. */
export const codigoBase = (p: GerProject) => (p.project_code ?? "").split("-")[0].trim();
/** "CACSCASUPG0008 - AUTO COLETIVO CACADOR LTDA" */
export const codigoProjetoBd = (p: GerProject) => `${codigoBase(p) || "—"} - ${razaoSocial(p)}`;
export const assuntoCodigoBd = (p: GerProject) => `CADASTRO DO CÓDIGO BD | ${codigoProjetoBd(p)}`;

export interface LinhaCodigoBd { label: string; valor: string }
/** Itens do e-mail, na ordem do modelo. */
export const linhasCodigoBd = (p: GerProject): LinhaCodigoBd[] => [
  { label: "Código do Projeto", valor: codigoProjetoBd(p) },
  { label: "Razão Social", valor: razaoSocial(p) },
  { label: "CNPJ", valor: p.cnpj || "—" },
  { label: "Sistema", valor: sistemasTexto(sistemasSugeridos(p)) },
  { label: "Cidade", valor: cidadeUf(p) || "—" },
];

/** O que ainda falta no cadastro para o e-mail ficar pronto. */
export function faltandoCodigoBd(p: GerProject): string[] {
  const out: string[] = [];
  if (!codigoBase(p)) out.push("Código do projeto");
  if (!temCnpj(p)) out.push("CNPJ no cadastro do projeto");
  return out;
}

const txt = estiloTexto;

export function emailHtmlCodigoBd(p: GerProject, gp: string): string {
  const linha = "border-top:1px solid #e3dcec;";
  const rows = linhasCodigoBd(p).map(l =>
    `<tr><td width="42%" valign="top" style="${txt(13, "#645a72")}width:42%;padding:8px 16px;${linha}">${escHtml(l.label)}</td>`
    + `<td valign="top" style="${txt(13, "#1f1630", true)}padding:8px 16px;${linha}">${escHtml(l.valor)}</td></tr>`).join("");
  const p0 = (texto: string, extra = "") => `<p style="${txt(14, "#1f1630")}margin:0;${extra}">${texto}</p>`;
  return p0("Prezados,")
    + p0("Segue solicitação para cadastro do cliente no banco de dados (código BD).", "margin-bottom:14px;")
    + `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;border:1px solid #e3dcec;">`
    + `<tr><td colspan="2" bgcolor="#4b1768" style="background-color:#4b1768;padding:14px 16px;">`
    + `<p style="${txt(11, "#dcc8ec", true)}margin:0;">CADASTRO DO CÓDIGO BD</p>`
    + `<p style="${txt(16, "#ffffff", true)}margin:4px 0 0 0;">${escHtml(codigoProjetoBd(p))}</p></td></tr>`
    + rows
    + `</table>`
    + p0("Atenciosamente,", "margin-top:16px;")
    + p0(`<b style="${txt(14, "#1f1630", true)}">${escHtml(gp)}</b>`)
    + `<p style="${txt(13, "#645a72")}margin:0;">Gerente de Projetos · Transdata</p>`;
}

/** Versão em texto (para quem colar onde não aceita formatação). */
export function emailTextoCodigoBd(p: GerProject, gp: string): string {
  return ["Prezados,", "", "Segue solicitação para cadastro do cliente no banco de dados (código BD).", "",
    ...linhasCodigoBd(p).map(l => `${l.label}: ${l.valor}`), "", "Atenciosamente,", gp, "Gerente de Projetos · Transdata"].join("\n");
}

/** Abre o e-mail no Outlook (programa) já com destinatário e assunto. */
export const mailtoCodigoBd = (p: GerProject) =>
  `mailto:${CODIGO_BD_DESTINATARIO}?subject=${encodeURIComponent(assuntoCodigoBd(p))}`;
/** Abre o e-mail no Outlook na web já com destinatário e assunto. */
export const outlookWebCodigoBd = (p: GerProject) =>
  `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(CODIGO_BD_DESTINATARIO)}&subject=${encodeURIComponent(assuntoCodigoBd(p))}`;
