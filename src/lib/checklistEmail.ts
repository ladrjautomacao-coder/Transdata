// E-mail ao GP do projeto quando o checklist de pré-requisitos é liberado (100% atendido ou
// exceção da diretoria). Tudo vem do cadastro e do checklist; o HTML segue o modelo que o
// Outlook mantém ao colar (src/lib/emailOutlook.ts).
import { CHECKLIST_ITENS, RESP_CHECKLIST, dataBr, dataHoraBr, naoAplica, type GerProject, type Modulo01Estado } from "@/lib/gerenciamento";
import { cidadeUf, razaoSocial } from "@/lib/dataCenterEmail";
import { codigoProjetoBd } from "@/lib/codigoBd";
import { cidadesOperacaoTexto, lerCidadesOperacao } from "@/lib/cidadesOperacao";
import { escHtml, estiloTexto } from "@/lib/emailOutlook";

const excecao = (e: Modulo01Estado) => e.checklist.resultado === "excecao";

export const assuntoChecklist = (p: GerProject, e: Modulo01Estado) =>
  `${excecao(e) ? "CHECKLIST LIBERADO POR EXCEÇÃO" : "CHECKLIST ATENDIDO"} | ${codigoProjetoBd(p)}`;

/** Dados do projeto no topo do e-mail (a cidade de atuação inclusive). */
export const linhasProjetoChecklist = (p: GerProject) => [
  { label: "Cliente", valor: razaoSocial(p) },
  { label: "Código do Projeto", valor: codigoProjetoBd(p) },
  // cidades da operação; sem elas, a cidade do contrato
  { label: "Cidade de atuação", valor: cidadesOperacaoTexto(lerCidadesOperacao(p.operation_cities)) || cidadeUf(p) || "—" },
  { label: "Tipo do projeto", valor: p.project_type?.name ?? "—" },
  { label: "Executivo(a) de Vendas", valor: p.executive?.full_name ?? "—" },
  { label: "Gerente de Projetos", valor: p.manager?.full_name ?? "—" },
];

export type SituacaoItem = "ok" | "naoaplica" | "pendente";
/** Cada pré-requisito com a situação no momento da liberação. */
export const itensChecklist = (e: Modulo01Estado) => CHECKLIST_ITENS.map(i => {
  const situacao: SituacaoItem = naoAplica(e, i) ? "naoaplica" : e.checklist.itens[i.id] ? "ok" : "pendente";
  const extra = i.vencimento && e.checklist.vencimentoDzero && situacao === "ok" ? ` · vencimento ${dataBr(e.checklist.vencimentoDzero)}` : "";
  return { texto: i.texto, responsavel: RESP_CHECKLIST[i.resp].label, situacao, extra };
});

const ROTULO: Record<SituacaoItem, string> = { ok: "OK", naoaplica: "Não se aplica", pendente: "Pendente" };

export const resultadoChecklist = (e: Modulo01Estado, por: string) => excecao(e)
  ? `Liberado por exceção autorizada por ${e.checklist.autorizadoPor.trim() || "—"} em ${dataHoraBr(e.checklist.em)}.`
  : `Todos os pré-requisitos que se aplicam estão ok. Confirmado em ${dataHoraBr(e.checklist.em)} por ${por}.`;

const primeiroNome = (nome: string | undefined) => (nome ?? "").trim().split(/\s+/)[0] || "";

const txt = estiloTexto;

export function emailHtmlChecklist(p: GerProject, e: Modulo01Estado, remetente: string): string {
  const linha = "border-top:1px solid #e3dcec;";
  const grupo = (t: string) => `<tr><td colspan="2" bgcolor="#efe6f6" style="${txt(11, "#4b1768", true)}background-color:#efe6f6;padding:8px 16px;${linha}">${escHtml(t)}</td></tr>`;
  const par = (label: string, valor: string) =>
    `<tr><td width="42%" valign="top" style="${txt(13, "#645a72")}width:42%;padding:8px 16px;${linha}">${label}</td>`
    + `<td valign="top" style="${txt(13, "#1f1630", true)}padding:8px 16px;${linha}">${valor}</td></tr>`;
  const situacao = (s: SituacaoItem, extra: string) =>
    s === "ok" ? `<span style="${txt(13, "#047857", true)}">&#9679;&nbsp;OK</span><span style="${txt(12, "#645a72")}">${escHtml(extra)}</span>`
    : s === "naoaplica" ? `<span style="${txt(13, "#8a8197")}">&#9675;&nbsp;Não se aplica</span>`
    : `<span style="${txt(13, "#b45309", true)}">&#9888;&nbsp;Pendente</span>`;
  const obs = e.checklist.observacoes.trim();
  const p0 = (texto: string, extra = "") => `<p style="${txt(14, "#1f1630")}margin:0;${extra}">${texto}</p>`;
  const gp = primeiroNome(p.manager?.full_name);
  return p0(`Olá${gp ? `, ${escHtml(gp)}` : ""},`)
    + p0(excecao(e)
      ? "O checklist de pré-requisitos do projeto foi liberado por exceção da diretoria. As próximas atividades da abertura estão liberadas."
      : "O checklist de pré-requisitos do projeto está 100% atendido. As próximas atividades da abertura estão liberadas.", "margin-bottom:14px;")
    + `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;border:1px solid #e3dcec;">`
    + `<tr><td colspan="2" bgcolor="#4b1768" style="background-color:#4b1768;padding:14px 16px;">`
    + `<p style="${txt(11, "#dcc8ec", true)}margin:0;">CHECKLIST DE PRÉ-REQUISITOS &nbsp;|&nbsp; ${excecao(e) ? "LIBERADO POR EXCEÇÃO" : "100% ATENDIDO"}</p>`
    + `<p style="${txt(16, "#ffffff", true)}margin:4px 0 0 0;">${escHtml(codigoProjetoBd(p))}</p></td></tr>`
    + grupo("PROJETO")
    + linhasProjetoChecklist(p).map(l => par(escHtml(l.label), escHtml(l.valor))).join("")
    + grupo("PRÉ-REQUISITOS")
    + itensChecklist(e).map(i => par(`${escHtml(i.texto)}<br><span style="${txt(11, "#8a8197")}">${escHtml(i.responsavel)}</span>`, situacao(i.situacao, i.extra))).join("")
    + grupo("RESULTADO")
    + par("Resultado", escHtml(resultadoChecklist(e, remetente)))
    + (obs ? par("Observações", escHtml(obs).replace(/\n/g, "<br>")) : "")
    + `</table>`
    + p0("Atenciosamente,", "margin-top:16px;")
    + p0(`<b style="${txt(14, "#1f1630", true)}">${escHtml(remetente)}</b>`)
    + `<p style="${txt(13, "#645a72")}margin:0;">Transdata</p>`;
}

/** Versão em texto (para quem colar onde não aceita formatação). */
export function emailTextoChecklist(p: GerProject, e: Modulo01Estado, remetente: string): string {
  const gp = primeiroNome(p.manager?.full_name);
  const obs = e.checklist.observacoes.trim();
  return [
    `Olá${gp ? `, ${gp}` : ""},`, "",
    excecao(e)
      ? "O checklist de pré-requisitos do projeto foi liberado por exceção da diretoria. As próximas atividades da abertura estão liberadas."
      : "O checklist de pré-requisitos do projeto está 100% atendido. As próximas atividades da abertura estão liberadas.", "",
    ...linhasProjetoChecklist(p).map(l => `${l.label}: ${l.valor}`), "",
    "Pré-requisitos:",
    ...itensChecklist(e).map(i => `- ${i.texto} (${i.responsavel}): ${ROTULO[i.situacao]}${i.extra}`), "",
    `Resultado: ${resultadoChecklist(e, remetente)}`,
    ...(obs ? [`Observações: ${obs}`] : []), "",
    "Atenciosamente,", remetente, "Transdata",
  ].join("\n");
}

/** Abre o e-mail no Outlook (programa) já com destinatário e assunto. */
export const mailtoChecklist = (para: string, p: GerProject, e: Modulo01Estado) =>
  `mailto:${encodeURIComponent(para.trim())}?subject=${encodeURIComponent(assuntoChecklist(p, e))}`;
/** Abre o e-mail no Outlook na web já com destinatário e assunto. */
export const outlookWebChecklist = (para: string, p: GerProject, e: Modulo01Estado) =>
  `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(para.trim())}&subject=${encodeURIComponent(assuntoChecklist(p, e))}`;
