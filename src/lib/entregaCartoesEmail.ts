// Comunicação da entrega dos cartões para AP (módulo 04, etapa 01): tudo vem do projeto e da
// etapa. O HTML segue o modelo que o Outlook mantém ao colar (src/lib/emailOutlook.ts).
import type { GerProject } from "@/lib/gerenciamento";
import { codigoProjetoBd } from "@/lib/codigoBd";
import { razaoSocial } from "@/lib/dataCenterEmail";
import { escHtml, estiloTexto } from "@/lib/emailOutlook";
import { dataBr04, type EtapaCartoesAp } from "@/lib/modulo04";

export interface DadosComunicacao { etapa: EtapaCartoesAp; responsavel: string; gp: string }

/** "[CÓDIGO - RAZÃO SOCIAL] | Entrega de cartões para AP" */
export const assuntoComunicacaoAp = (p: GerProject) => `${codigoProjetoBd(p)} | Entrega de cartões para AP`;

export const linhasComunicacaoAp = (p: GerProject, d: DadosComunicacao) => [
  { label: "Cliente", valor: razaoSocial(p) },
  { label: "Quantidade", valor: d.etapa.quantidade.trim() ? `${d.etapa.quantidade.trim()} cartões` : "—" },
  { label: "Data", valor: dataBr04(d.etapa.efetiva || d.etapa.prevista) },
  { label: "Responsável", valor: d.responsavel },
  { label: "Observações", valor: d.etapa.observacoes.trim() || "—" },
];

/** O que falta para a comunicação ficar pronta. */
export function faltandoComunicacaoAp(d: DadosComunicacao): string[] {
  const out: string[] = [];
  if (!d.etapa.quantidade.trim()) out.push("quantidade de cartões");
  if (!d.etapa.efetiva && !d.etapa.prevista) out.push("data prevista ou efetiva da entrega");
  return out;
}

const txt = estiloTexto;
const abertura = (p: GerProject) => `Informamos que os cartões referentes ao projeto ${codigoProjetoBd(p)} estão sendo encaminhados para AP.`;

export function emailHtmlComunicacaoAp(p: GerProject, d: DadosComunicacao): string {
  const linha = "border-top:1px solid #e3dcec;";
  const rows = linhasComunicacaoAp(p, d).map(l =>
    `<tr><td width="34%" valign="top" style="${txt(13, "#645a72")}width:34%;padding:8px 16px;${linha}">${escHtml(l.label)}</td>`
    + `<td valign="top" style="${txt(13, "#1f1630", true)}padding:8px 16px;${linha}">${escHtml(l.valor)}</td></tr>`).join("");
  const p0 = (texto: string, extra = "") => `<p style="${txt(14, "#1f1630")}margin:0;${extra}">${texto}</p>`;
  return p0("Olá,")
    + p0(escHtml(abertura(p)), "margin-bottom:14px;")
    + `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;border:1px solid #e3dcec;">`
    + `<tr><td colspan="2" bgcolor="#4b1768" style="background-color:#4b1768;padding:14px 16px;">`
    + `<p style="${txt(11, "#dcc8ec", true)}margin:0;">ENTREGA DE CARTÕES PARA AP</p>`
    + `<p style="${txt(16, "#ffffff", true)}margin:4px 0 0 0;">${escHtml(codigoProjetoBd(p))}</p></td></tr>`
    + rows
    + `</table>`
    + p0("Atenciosamente,", "margin-top:16px;")
    + p0(`<b style="${txt(14, "#1f1630", true)}">${escHtml(d.gp)}</b>`)
    + `<p style="${txt(13, "#645a72")}margin:0;">Transdata</p>`;
}

export function emailTextoComunicacaoAp(p: GerProject, d: DadosComunicacao): string {
  return ["Olá,", "", abertura(p), "", ...linhasComunicacaoAp(p, d).map(l => `${l.label}: ${l.valor}`), "", "Atenciosamente,", d.gp].join("\n");
}

export const mailtoComunicacaoAp = (p: GerProject, para: string) =>
  `mailto:${encodeURIComponent(para.trim())}?subject=${encodeURIComponent(assuntoComunicacaoAp(p))}`;
