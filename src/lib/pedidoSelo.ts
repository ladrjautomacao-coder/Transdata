// Pedidos com selo no sistema de pedidos (CPQ - PMO): o portal monta o texto a partir do cadastro
// do projeto e o GP copia e cola no sistema. Cada selo declara as suas linhas; os próximos selos
// entram aqui com as linhas deles.
import { dataBr, fimDoContrato, type GerProject } from "@/lib/gerenciamento";
import { escHtml, estiloTexto } from "@/lib/emailOutlook";

export interface LinhaPedido {
  label: string;
  /** null: falta no cadastro do projeto. */
  valor: string | null;
  origem: "padrao" | "cadastro";
  /** O que preencher no cadastro quando falta. */
  comoPreencher?: string;
}

export interface PedidoSelo {
  selo: string;
  linhas: LinhaPedido[];
}

const padrao = (label: string, valor: string): LinhaPedido => ({ label, valor, origem: "padrao" });
const doCadastro = (label: string, valor: string | null | undefined, comoPreencher: string): LinhaPedido =>
  ({ label, valor: valor?.trim() || null, origem: "cadastro", comoPreencher });

/** IMP [IN1-8] Designação do GP: atividade "Cadastro no sistema de pedidos" do módulo 01. */
export function pedidoDesignacaoGp(p: GerProject): PedidoSelo {
  const selo = "IMP [IN1-8] Designação do GP";
  const fim = fimDoContrato(p);
  return {
    selo,
    linhas: [
      padrao("Selo", selo),
      padrao("Departamento", "CPQ - PMO"),
      doCadastro("Nome do Projeto", p.company_name, "o nome do cliente"),
      doCadastro("Código do Projeto", p.project_code, "o código do projeto"),
      doCadastro("Gerente de Projetos Transdata", p.manager?.full_name, "o Gerente de Projetos"),
      doCadastro("Gerente de Projetos no Cliente", p.client_manager_name, "o Gerente de Projetos no cliente"),
      doCadastro("Data do D-zero", p.d_zero_date ? dataBr(p.d_zero_date) : null, "a data do D-zero"),
      doCadastro("Data de encerramento do Projeto", fim ? dataBr(fim) : null, "o prazo contratual (dias); o encerramento é a contratação + o prazo"),
    ],
  };
}

/** Itens que ainda faltam no cadastro. */
export const faltandoPedido = (pd: PedidoSelo) => pd.linhas.filter(l => !l.valor).map(l => l.label);

/** Texto para colar num campo simples: um item por linha. */
export const textoPedido = (pd: PedidoSelo) => pd.linhas.map(l => `${l.label}: ${l.valor ?? ""}`).join("\n");

/**
 * HTML para colar num editor com formatação: o mesmo visual do e-mail ao Data Center, com o estilo
 * declarado em cada texto (ver src/lib/emailOutlook.ts) e o título já escrito em maiúsculas.
 */
export function htmlPedido(pd: PedidoSelo): string {
  const txt = estiloTexto;
  const linha = "border-top:1px solid #e3dcec;";
  const rows = pd.linhas.map(l =>
    `<tr><td width="42%" valign="top" style="${txt(13, "#645a72")}width:42%;padding:8px 16px;${linha}">${escHtml(l.label)}</td>`
    + `<td valign="top" style="${txt(13, "#1f1630", true)}padding:8px 16px;${linha}">${escHtml(l.valor ?? "—")}</td></tr>`).join("");
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;border:1px solid #e3dcec;">`
    + `<tr><td colspan="2" bgcolor="#4b1768" style="background-color:#4b1768;padding:14px 16px;">`
    + `<p style="${txt(11, "#dcc8ec", true)}margin:0;">SISTEMA DE PEDIDOS &nbsp;|&nbsp; CPQ - PMO</p>`
    + `<p style="${txt(16, "#ffffff", true)}margin:4px 0 0 0;">${escHtml(pd.selo.toUpperCase())}</p></td></tr>`
    + rows
    + `</table>`;
}
