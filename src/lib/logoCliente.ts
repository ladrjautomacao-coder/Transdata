// Logo do cliente no corpo do e-mail ao Data Center: só PNG, até 2 MB. O arquivo sobe para o
// bucket público "gerenciamento" (o Outlook busca a imagem ao colar o e-mail).
import { supabase } from "@/integrations/supabase/client";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export interface LogoCliente {
  url: string;
  nome: string;
  largura: number;
  altura: number;
}

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Motivo para recusar o arquivo, ou null se pode enviar. `bytes`: os primeiros bytes do arquivo. */
export function validarLogo(arquivo: { name: string; type: string; size: number }, bytes: Uint8Array): string | null {
  const png = ASSINATURA_PNG.every((b, i) => bytes[i] === b);
  if (!png || (arquivo.type && arquivo.type !== "image/png")) return "O logo precisa ser um arquivo PNG.";
  if (arquivo.size > LOGO_MAX_BYTES) return `O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB; o limite é 2 MB.`;
  if (arquivo.size === 0) return "O arquivo está vazio.";
  return null;
}

/** Largura do logo no e-mail: no máximo 240 px, sem aumentar logo pequeno. */
export const larguraNoEmail = (l: Pick<LogoCliente, "largura">) => Math.min(240, Math.max(1, l.largura));
export const alturaNoEmail = (l: Pick<LogoCliente, "largura" | "altura">) =>
  Math.round((l.altura / Math.max(1, l.largura)) * larguraNoEmail(l));

async function dimensoes(arquivo: Blob): Promise<{ largura: number; altura: number }> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    await new Promise<void>((ok, erro) => { img.onload = () => ok(); img.onerror = () => erro(new Error("Não foi possível ler a imagem.")); img.src = url; });
    return { largura: img.naturalWidth, altura: img.naturalHeight };
  } finally { URL.revokeObjectURL(url); }
}

/** Confere o PNG e sobe para logos/<projeto>/; um arquivo novo a cada envio. */
export async function enviarLogo(projectId: string, arquivo: File): Promise<LogoCliente> {
  const inicio = new Uint8Array(await arquivo.slice(0, 8).arrayBuffer());
  const motivo = validarLogo(arquivo, inicio);
  if (motivo) throw new Error(motivo);
  const { largura, altura } = await dimensoes(arquivo);
  const caminho = `logos/${projectId}/${Date.now()}.png`;
  const { error } = await supabase.storage.from("gerenciamento").upload(caminho, arquivo, { contentType: "image/png", upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  return { url: supabase.storage.from("gerenciamento").getPublicUrl(caminho).data.publicUrl, nome: arquivo.name, largura, altura };
}
