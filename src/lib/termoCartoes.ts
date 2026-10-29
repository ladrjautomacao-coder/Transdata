// Termo de Recebimento de Cartões (módulo 02): os cartões JCOP que o GP leva à reunião de PE e
// o cliente assina ao receber. Modelo do usuário: Chave, Senha e MK TRANSPORT em quantidade fixa,
// Acesso = 1 por carro da frota; o GP ajusta as quantidades e acrescenta outros cartões.
import { dataBr, type GerProject } from "@/lib/gerenciamento";
import { razaoSocial } from "@/lib/dataCenterEmail";
import { codigoProjetoBd } from "@/lib/codigoBd";
import type { Modulo02Estado } from "@/lib/modulo02";

/** Cartão acrescentado pelo GP (fora dos quatro do modelo). */
export interface CartaoExtra { id: string; tipo: string; destacavel: boolean; quantidade: number }

/** Uma linha da tabela do termo. `padrao`: a quantidade do modelo (null nos acrescentados). */
export interface CartaoTermo { id: string; tipo: string; destacavel: boolean; quantidade: number; padrao: number | null }

/** Os cartões do modelo; `frota`: Acesso é 1 por carro. */
export const CARTOES_DO_MODELO: { id: string; tipo: string; destacavel: boolean; padrao: number | "frota" }[] = [
  { id: "chave", tipo: "Chave", destacavel: false, padrao: 1 },
  { id: "senha", tipo: "Senha", destacavel: false, padrao: 5 },
  { id: "acesso", tipo: "Acesso", destacavel: true, padrao: "frota" },
  { id: "mk", tipo: "MK TRANSPORT", destacavel: false, padrao: 1 },
];

/** Frota total do cadastro (a reserva faz parte dela). */
export const frotaDoProjeto = (p: Pick<GerProject, "fleet_size">) => Math.max(0, p.fleet_size ?? 0);

/** Os cartões do termo: os do modelo (com o que o GP ajustou) e os acrescentados. */
export function cartoesDoTermo(p: Pick<GerProject, "fleet_size">, c: Pick<Modulo02Estado["cartoes"], "ajustes" | "extras">): CartaoTermo[] {
  const modelo = CARTOES_DO_MODELO.map(m => {
    const padrao = m.padrao === "frota" ? frotaDoProjeto(p) : m.padrao;
    const ajuste = c.ajustes?.[m.id];
    return { id: m.id, tipo: m.tipo, destacavel: m.destacavel, padrao, quantidade: typeof ajuste === "number" ? ajuste : padrao };
  });
  const extras = (c.extras ?? []).map(x => ({ ...x, padrao: null }));
  return [...modelo, ...extras];
}

/** "Cartão Não Destacável" / "Cartões Destacáveis" */
export const descricaoCartao = (destacavel: boolean, quantidade: number) =>
  quantidade === 1 ? `Cartão ${destacavel ? "Destacável" : "Não Destacável"}` : `Cartões ${destacavel ? "Destacáveis" : "Não Destacáveis"}`;

/** Quantidade com dois dígitos, como no modelo ("01", "05", "40"). */
export const qtdTermo = (n: number) => String(n).padStart(2, "0");

/** Local padrão da assinatura (o do modelo). */
export const LOCAL_PADRAO_TERMO = "Campinas";
export const CARGO_PADRAO_TERMO = "Gerente do Projeto";

/** O que vai no PDF. */
export interface DadosTermo {
  /** "CACSCASNEW0008 - AUTO COLETIVO CACADOR LTDA" */
  projeto: string;
  /** Nome da empresa como está no cadastro (no texto) e em maiúsculas (na assinatura). */
  cliente: string;
  clienteAssinatura: string;
  cartoes: { quantidade: string; descricao: string; tipo: string }[];
  local: string;
  /** dd/mm/aaaa */
  data: string;
  recebedor: string;
  cargo: string;
  /** Nome do arquivo, sem a extensão. */
  arquivo: string;
}

/** Valores do termo que o GP pode mudar, com os padrões já aplicados. */
export function camposTermo(p: GerProject, e: Modulo02Estado) {
  const t = e.termo;
  return {
    local: t.local.trim() || LOCAL_PADRAO_TERMO,
    // os cartões são entregues na reunião de PE: sem data escolhida, vale a da reunião
    data: t.data || e.contato.reuniaoPe.slice(0, 10),
    // quem recebe os cartões o GP digita: o termo não sugere nome
    recebedor: t.recebedor.trim(),
    cargo: t.cargo.trim() || CARGO_PADRAO_TERMO,
  };
}

/** O que falta para gerar o termo. */
export function faltandoTermo(p: GerProject, e: Modulo02Estado): string[] {
  const out: string[] = [];
  const f = camposTermo(p, e);
  if (!cartoesDoTermo(p, e.cartoes).some(c => c.quantidade > 0)) out.push("ao menos um cartão");
  if (cartoesDoTermo(p, e.cartoes).some(c => c.padrao === null && c.quantidade > 0 && !c.tipo.trim())) out.push("o tipo do cartão acrescentado");
  if (!f.data) out.push("data");
  if (!f.recebedor) out.push("quem recebe os cartões");
  return out;
}

export function montarTermo(p: GerProject, e: Modulo02Estado): DadosTermo {
  const f = camposTermo(p, e);
  return {
    projeto: codigoProjetoBd(p),
    cliente: p.company_name.trim(),
    clienteAssinatura: razaoSocial(p),
    // cartão com quantidade zero não entra na tabela
    cartoes: cartoesDoTermo(p, e.cartoes).filter(c => c.quantidade > 0)
      .map(c => ({ quantidade: qtdTermo(c.quantidade), descricao: descricaoCartao(c.destacavel, c.quantidade), tipo: c.tipo.trim() })),
    local: f.local,
    data: f.data ? dataBr(f.data) : "—",
    recebedor: f.recebedor || "—",
    cargo: f.cargo,
    arquivo: `Termo-Recebimento-Cartoes-${(p.project_code ?? "").split("-")[0].trim() || "projeto"}`,
  };
}
