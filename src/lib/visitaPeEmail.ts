// E-mails da preparação da visita de PE (módulo 02): os custos ao cliente, para aprovação, e os
// comprovantes de pagamento ao Financeiro da Transdata. O HTML segue o modelo que o Outlook
// mantém ao colar (src/lib/emailOutlook.ts).
import { dataBr, dataHoraBr, fimDoContrato, solutionsOf, type GerProject } from "@/lib/gerenciamento";
import { cidadeUf, razaoSocial } from "@/lib/dataCenterEmail";
import { codigoBase, codigoProjetoBd } from "@/lib/codigoBd";
import { cidadesOperacaoTexto, lerCidadesOperacao } from "@/lib/cidadesOperacao";
import { escHtml, estiloTexto } from "@/lib/emailOutlook";
import { moeda, valorBr, type Modulo02Estado } from "@/lib/modulo02";
import { projectSegmentLabel } from "@/lib/projectSegments";
import { teamRoleLabels } from "@/lib/teamRoleLabels";
import type { ComprovanteResumo } from "@/lib/comprovantesFinanceiro";

const txt = estiloTexto;
const primeiroNome = (nome: string | null | undefined) => (nome ?? "").trim().split(/\s+/)[0] || "";
const ou = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "—");
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
  const nome = primeiroNome(e.contato.com);
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
  const nome = primeiroNome(e.contato.com);
  return [
    `Olá${nome ? `, ${nome}` : ""},`, "", INTRO_CUSTOS, "",
    ...linhasVisita(p, e).map(l => `${l.label}: ${l.valor}`), "",
    PEDIDO_APROVACAO, "",
    "Atenciosamente,", remetente, "Gerente de Projetos | Transdata",
  ].join("\n");
}

/* ─── Comprovantes ao Financeiro ─── */

export const assuntoFinanceiro = (p: GerProject) => `COMPROVANTES DE VIAGEM | VISITA DE PE | ${codigoProjetoBd(p)}`;

/** Nome do PDF com os comprovantes, sem a extensão. */
export const arquivoComprovantes = (p: GerProject) => `Comprovantes-Visita-PE-${codigoBase(p) || "projeto"}`;

/** "Aprovados por Carla Souza em 30/10/2026" */
export const aprovacaoTexto = (e: Modulo02Estado) =>
  `Aprovados por ${e.aprovacao.aprovadoPor.trim() || "—"} em ${dataBr(e.aprovacao.aprovadoEm || e.aprovacao.registradoEm)}`;

export interface GrupoFinanceiro { titulo: string; linhas: { label: string; valor: string }[] }

/** O projeto (do cadastro) e a visita (do módulo), para o Financeiro: o e-mail e o PDF usam os mesmos. */
export function gruposFinanceiro(p: GerProject, e: Modulo02Estado): GrupoFinanceiro[] {
  const solucoes = solutionsOf(p);
  const frota = p.fleet_size ?? 0;
  const ad = e.adiantamento;
  const projeto = [
    { label: "Cliente (razão social)", valor: razaoSocial(p) },
    { label: "CNPJ", valor: ou(p.cnpj) },
    { label: "Código do Projeto", valor: codigoProjetoBd(p) },
    { label: "Tipo do projeto", valor: ou(p.project_type?.name) },
    { label: "Segmento", valor: projectSegmentLabel(p.project_segment) || "—" },
    { label: "Soluções contratadas", valor: solucoes.join(", ") || "—" },
    { label: "Frota contratada", valor: frota ? `${frota} veículo${frota === 1 ? "" : "s"}` : "—" },
    { label: "Cidade/UF", valor: cidadeUf(p) || "—" },
    { label: "Data de contratação", valor: dataBr(p.contract_date) },
    { label: "D-zero", valor: dataBr(p.d_zero_date) },
    { label: "Fim do contrato", valor: dataBr(fimDoContrato(p)) },
    { label: teamRoleLabels.manager ?? "Gerente de Projetos", valor: p.manager?.full_name ?? "—" },
    { label: teamRoleLabels.executive ?? "Executivo de Vendas", valor: p.executive?.full_name ?? "—" },
    ...(p.client_manager_name?.trim() ? [{ label: "Gerente de Projetos no cliente", valor: p.client_manager_name.trim() }] : []),
  ];
  const visita = [
    { label: "Reunião de Projeto Executivo", valor: reuniaoTexto(e) },
    { label: "Destino", valor: destino(p) },
    ...(e.contato.com.trim() ? [{ label: "Contato no cliente", valor: e.contato.com.trim() }] : []),
    { label: "Custos simulados na Onfly", valor: e.custos.registradoEm ? `Em ${dataBr(e.custos.registradoEm)}` : "—" },
    { label: "Aprovação dos custos", valor: e.aprovacao.registradoEm ? aprovacaoTexto(e) : "—" },
    { label: "Reserva do deslocamento", valor: e.reservas.deslocamento.trim() || "—" },
    { label: "Reserva da hospedagem", valor: e.reservas.hospedagem.trim() || "—" },
    // o adiantamento vem depois na lista: só entra se já foi registrado
    ...(ad.registradoEm ? [{
      label: "Adiantamento de verba",
      valor: ad.necessario ? `Solicitado na Onfly${valorBr(ad.valor) ? `: ${moeda(valorBr(ad.valor)!)}` : ""}` : "Não necessário",
    }] : []),
  ];
  return [{ titulo: "PROJETO", linhas: projeto }, { titulo: "VISITA DE PROJETO EXECUTIVO", linhas: visita }];
}

/** Os comprovantes na ordem do PDF (a página 1 é o resumo). */
export const linhasComprovantes = (cs: ComprovanteResumo[]) =>
  cs.map((c, i) => ({ label: `${i + 1}. ${c.tipo || "Comprovante"}`, valor: [c.descricao.trim(), `página ${i + 2} do PDF`].filter(Boolean).join(" · ") }));

const introFinanceiro = (n: number, arquivo: string) =>
  `Seguem em anexo os comprovantes de pagamento referentes à visita de Projeto Executivo do projeto abaixo${n ? `: ${n} ${n === 1 ? "comprovante" : "comprovantes"} no PDF ${arquivo}.pdf` : ""}. Os custos foram aprovados pelo cliente.`;
const FECHO_FINANCEIRO = "Fico à disposição para qualquer dúvida.";

export function emailHtmlFinanceiro(p: GerProject, e: Modulo02Estado, remetente: string, cs: ComprovanteResumo[], arquivo = arquivoComprovantes(p)): string {
  const tabela = (g: GrupoFinanceiro) => grupo(g.titulo) + g.linhas.map(l => par(escHtml(l.label), escHtml(l.valor))).join("");
  return p0("Olá, equipe do Financeiro,")
    + p0(escHtml(introFinanceiro(cs.length, arquivo)), "margin-bottom:14px;")
    + topo("COMPROVANTES DE PAGAMENTO &nbsp;|&nbsp; VISITA DE PROJETO EXECUTIVO", codigoProjetoBd(p))
    + gruposFinanceiro(p, e).map(tabela).join("")
    + tabela({ titulo: `COMPROVANTES ANEXADOS (${cs.length})`, linhas: cs.length ? linhasComprovantes(cs) : [{ label: "Comprovantes", valor: "—" }] })
    + `</table>`
    + p0(FECHO_FINANCEIRO, "margin-top:14px;")
    + assinatura(remetente);
}

export function emailTextoFinanceiro(p: GerProject, e: Modulo02Estado, remetente: string, cs: ComprovanteResumo[], arquivo = arquivoComprovantes(p)): string {
  const bloco = (g: GrupoFinanceiro) => [g.titulo, ...g.linhas.map(l => `${l.label}: ${l.valor}`), ""];
  return [
    "Olá, equipe do Financeiro,", "", introFinanceiro(cs.length, arquivo), "",
    ...gruposFinanceiro(p, e).flatMap(bloco),
    ...bloco({ titulo: `COMPROVANTES ANEXADOS (${cs.length})`, linhas: linhasComprovantes(cs) }),
    FECHO_FINANCEIRO, "",
    "Atenciosamente,", remetente, "Gerente de Projetos | Transdata",
  ].join("\n");
}

/** Abre o e-mail no Outlook (programa) já com destinatário e assunto. */
export const mailtoPara = (para: string, assunto: string) => `mailto:${encodeURIComponent(para.trim())}?subject=${encodeURIComponent(assunto)}`;
/** Abre o e-mail no Outlook na web já com destinatário e assunto. */
export const outlookWebPara = (para: string, assunto: string) =>
  `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(para.trim())}&subject=${encodeURIComponent(assunto)}`;
