// Comprovantes de pagamento da visita de PE (módulo 02, "Comprovantes ao Financeiro"): o GP anexa
// as imagens e o portal monta o e-mail e um PDF com os dados do projeto e os comprovantes.
import { dataBr, type GerProject } from "@/lib/gerenciamento";
import type { Modulo02Estado } from "@/lib/modulo02";
import { codigoProjetoBd } from "@/lib/codigoBd";
import { arquivoComprovantes, gruposFinanceiro, linhasComprovantes, type GrupoFinanceiro } from "@/lib/visitaPeEmail";

export const TIPOS_COMPROVANTE = [
  "Passagem aérea", "Passagem rodoviária", "Hospedagem", "Locação de carro", "Combustível e pedágio", "Alimentação", "Outro",
];

/** Comprovante anexado na tela: a imagem fica só na sessão (JPEG reduzido, em data URL). */
export interface Comprovante {
  id: string;
  arquivo: string;
  tipo: string;
  descricao: string;
  imagem: string;
  largura: number;
  altura: number;
}

/** O que fica registrado no módulo de cada comprovante (sem a imagem). */
export type ComprovanteResumo = Pick<Comprovante, "tipo" | "descricao" | "arquivo">;

export const FORMATOS_COMPROVANTE = "image/png,image/jpeg,image/webp";
export const MAX_COMPROVANTES = 12;
const MAX_MB = 15;
/** Lado maior da imagem no PDF: legível e leve para anexar no e-mail. */
const LADO_MAX = 1800;

export const resumoComprovantes = (cs: Comprovante[]): ComprovanteResumo[] =>
  cs.map(({ tipo, descricao, arquivo }) => ({ tipo, descricao: descricao.trim(), arquivo }));

/** O que falta nos comprovantes para montar o e-mail e o PDF. */
export function faltandoComprovantes(cs: Comprovante[]): string[] {
  if (!cs.length) return ["ao menos um comprovante"];
  return cs.some(c => !c.tipo) ? ["o tipo de cada comprovante"] : [];
}

/** Lê a imagem e a reduz para o PDF (JPEG, fundo branco no lugar da transparência). */
export async function prepararImagem(file: File): Promise<Pick<Comprovante, "imagem" | "largura" | "altura">> {
  if (!FORMATOS_COMPROVANTE.split(",").includes(file.type)) throw new Error(`${file.name}: use JPG, PNG ou WEBP.`);
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`${file.name}: maior que ${MAX_MB} MB.`);
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const largura = Math.round(bmp.width * escala), altura = Math.round(bmp.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = largura; canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(`${file.name}: não foi possível ler a imagem.`);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bmp, 0, 0, largura, altura);
  bmp.close();
  return { imagem: canvas.toDataURL("image/jpeg", 0.85), largura, altura };
}

export interface DadosComprovantesPdf {
  arquivo: string;
  projeto: string;
  intro: string;
  grupos: GrupoFinanceiro[];
  comprovantes: { titulo: string; descricao: string; imagem: string; largura: number; altura: number }[];
  rodape: string;
}

/** O PDF: página 1 com o projeto, a visita e a lista; depois um comprovante por página. */
export function montarComprovantesPdf(p: GerProject, e: Modulo02Estado, cs: Comprovante[], emitidoPor: string, hoje = new Date()): DadosComprovantesPdf {
  const n = cs.length;
  return {
    arquivo: arquivoComprovantes(p),
    projeto: codigoProjetoBd(p),
    intro: `Comprovantes de pagamento da viagem para a reunião de Projeto Executivo (${n} ${n === 1 ? "comprovante" : "comprovantes"}). Os custos foram aprovados pelo cliente.`,
    grupos: [...gruposFinanceiro(p, e), { titulo: `COMPROVANTES ANEXADOS (${n})`, linhas: linhasComprovantes(resumoComprovantes(cs)) }],
    comprovantes: cs.map((c, i) => ({ titulo: `Comprovante ${i + 1} de ${n} · ${c.tipo || "Comprovante"}`, descricao: c.descricao.trim(), imagem: c.imagem, largura: c.largura, altura: c.altura })),
    rodape: `Gerado no portal Transdata em ${dataBr(hoje.toISOString())} por ${emitidoPor}`,
  };
}
