// E-mails da preparação da visita de PE (módulo 02): os custos ao cliente, para aprovação, e os
// comprovantes das reservas ao Financeiro da Transdata. O HTML segue o modelo que o Outlook
// mantém ao colar (src/lib/emailOutlook.ts).
import { dataBr, dataHoraBr, type GerProject } from "@/lib/gerenciamento";
import { cidadeUf, razaoSocial } from "@/lib/dataCenterEmail";
import { codigoProjetoBd } from "@/lib/codigoBd";
import { cidadesOperacaoTexto, lerCidadesOperacao } from "@/lib/cidadesOperacao";
import { escHtml, estiloTexto } from "@/lib/emailOutlook";
import type { Modulo02Estado } from "@/lib/modulo02";

const txt = estiloTexto;
const primeiroNome = (nome: string | null | undefined) => (nome ?? "").trim().split(/\s+/)[0] || "";
/** Cidades da operação; sem elas, a cidade do contrato. */
const destino = (p: GerProject) => cidadesOperacaoTexto(lerCidadesOperacao(p.operation_cities)) || cidadeUf(p) || "—";

/** Reunião de PE: "10/11/2026 às 09:00" (+ local). */
const reuniaoTexto = (e: Modulo02Estado) =>
  e.contato.reuniaoPe ? `${dataHoraBr(e.contato.reuniaoPe)}${e.contato.local.trim() ? `, ${e.contato.local.trim()}` : ""}` : "—";

/* ─── Pedaços do HTML ─── */
const LINHA = "border-top:1px solid #e3dcec;";
const p0 = (texto: string, extra = "") => `<p style="${txt(14, "#1f1630")}margin:0;${extra}">${texto}</p>`;
const grupo = (t: string) => `<tr><td colspan="2" bgcolor="#efe6f6" style="${txt(11, "#4b1768", true)}background-color:#efe6f6;padding:8px 16px;${LINHA}">${escHtml(t)}</td></tr>`;
const par = (label: string, valor: string) =>
  `<tr><td width="42%" valign="top" style="${txt(13, "#645a72")}width:42%;padding:8px 16px;${LINHA}">${label}</td>`
  + `<td valign="top" style="${txt(13, "#1f1630", true)}padding:8px 16px;${LINHA}">${valor}</td></tr>`;
const topo = (faixa: string, titulo: string) =>
  `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;border:1px solid #e3dcec;">`
  + `<tr><td colspan="2" bgcolor="#4b1768" style="background-color:#4b1768;padding:14px 16px;">`
  + `<p style="${txt(11, "#dcc8ec", true)}margin:0;">${faixa}</p>`
  + `<p style="${txt(16, "#ffffff", true)}margin:4px 0 0 0;">${escHtml(titulo)}</p></td></tr>`;
const assinatura = (remetente: string) =>
  p0("Atenciosamente,", "margin-top:16px;")
  + p0(`<b style="${txt(14, "#1f1630", true)}">${escHtml(remetente)}</b>`)
  + `<p style="${txt(13, "#645a72")}margin:0;">Gerente de Projetos | Transdata</p>`;

/* ─── Custos ao cliente ─── */

export const assuntoCustos = (p: GerProject) => `Custos da visita de Projeto Executivo | ${razaoSocial(p)}`;

/** Dados da visita no e-mail ao cliente. */
export const linhasVisita = (p: GerProject, e: Modulo02Estado) => [
  { label: "Reunião de Projeto Executivo", valor: reuniaoTexto(e) },
  { label: "Destino", valor: destino(p) },
];

const INTRO_CUSTOS = "Conforme conversamos, seguem em anexo os custos estimados de deslocamento e hospedagem da equipe Transdata para a visita de Projeto Executivo, simulados na Onfly.";
const PEDIDO_APROVACAO = "Os valores são estimados nesta data e podem mudar até a emissão das reservas. Pedimos, por gentileza, a aprovação para seguirmos com as reservas.";

export function emailHtmlCustos(p: GerProject, e: Modulo02Estado, remetente: string): string {
  const nome = primeiroNome(e.contato.com || p.client_manager_name);
  return p0(`Olá${nome ? `, ${escHtml(nome)}` : ""},`)
    + p0(INTRO_CUSTOS, "margin-bottom:14px;")
    + topo("CUSTOS DA VISITA DE PROJETO EXECUTIVO", razaoSocial(p))
    + grupo("VISITA")
    + linhasVisita(p, e).map(l => par(escHtml(l.label), escHtml(l.valor))).join("")
    + `</table>`
    + p0(PEDIDO_APROVACAO, "margin-top:14px;")
    + assinatura(remetente);
}

export function emailTextoCustos(p: GerProject, e: Modulo02Estado, remetente: string): string {
  const nome = primeiroNome(e.contato.com || p.client_manager_name);
  return [
    `Olá${nome ? `, ${nome}` : ""},`, "", INTRO_CUSTOS, "",
    ...linhasVisita(p, e).map(l => `${l.label}: ${l.valor}`), "",
    PEDIDO_APROVACAO, "",
    "Atenciosamente,", remetente, "Gerente de Projetos | Transdata",
  ].join("\n");
}

/* ─── Comprovantes ao Financeiro ─── */

export const assuntoFinanceiro = (p: GerProject) => `COMPROVANTES DE VIAGEM | VISITA DE PE | ${codigoProjetoBd(p)}`;

/** Dados do projeto e da viagem no e-mail ao Financeiro. */
export const linhasFinanceiro = (p: GerProject, e: Modulo02Estado) => [
  { label: "Cliente", valor: razaoSocial(p) },
  { label: "Código do Projeto", valor: codigoProjetoBd(p) },
  { label: "Gerente de Projetos", valor: p.manager?.full_name ?? "—" },
  { label: "Destino", valor: destino(p) },
  { label: "Reserva do deslocamento", valor: e.reservas.deslocamento.trim() || "—" },
  { label: "Reserva da hospedagem", valor: e.reservas.hospedagem.trim() || "—" },
  { label: "Aprovação dos custos", valor: aprovacaoTexto(e) },
];

/** "Aprovados por Carla Souza em 30/10/2026" */
export const aprovacaoTexto = (e: Modulo02Estado) =>
  `Aprovados por ${e.aprovacao.aprovadoPor.trim() || "—"} em ${dataBr(e.aprovacao.aprovadoEm || e.aprovacao.registradoEm)}`;

const INTRO_FINANCEIRO = "Seguem em anexo os comprovantes das reservas da visita de Projeto Executivo do projeto abaixo. Os custos foram aprovados pelo cliente.";

export function emailHtmlFinanceiro(p: GerProject, e: Modulo02Estado, remetente: string): string {
  return p0("Olá, equipe do Financeiro,")
    + p0(INTRO_FINANCEIRO, "margin-bottom:14px;")
    + topo("COMPROVANTES DE VIAGEM &nbsp;|&nbsp; VISITA DE PROJETO EXECUTIVO", codigoProjetoBd(p))
    + grupo("PROJETO E VIAGEM")
    + linhasFinanceiro(p, e).map(l => par(escHtml(l.label), escHtml(l.valor))).join("")
    + `</table>`
    + p0("Os comprovantes seguem em anexo.", "margin-top:14px;")
    + assinatura(remetente);
}

export function emailTextoFinanceiro(p: GerProject, e: Modulo02Estado, remetente: string): string {
  return [
    "Olá, equipe do Financeiro,", "", INTRO_FINANCEIRO, "",
    ...linhasFinanceiro(p, e).map(l => `${l.label}: ${l.valor}`), "",
    "Os comprovantes seguem em anexo.", "",
    "Atenciosamente,", remetente, "Gerente de Projetos | Transdata",
  ].join("\n");
}

/** Abre o e-mail no Outlook (programa) já com destinatário e assunto. */
export const mailtoPara = (para: string, assunto: string) => `mailto:${encodeURIComponent(para.trim())}?subject=${encodeURIComponent(assunto)}`;
/** Abre o e-mail no Outlook na web já com destinatário e assunto. */
export const outlookWebPara = (para: string, assunto: string) =>
  `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(para.trim())}&subject=${encodeURIComponent(assunto)}`;
