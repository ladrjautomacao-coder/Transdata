// Cobertura das operadoras (Claro e Vivo) para o e-mail ao cliente nos projetos com Carrier, ITS
// ou Gestão de Frota.
// Fonte: Anatel (cobertura estimada a partir das estações licenciadas), carregada a cada trimestre
// por scripts/cobertura/atualizar.mjs; o mapa de calor usa os setores censitários do IBGE.
import { supabase } from "@/integrations/supabase/client";
import type { GerProject } from "@/lib/gerenciamento";
import { escHtml as esc, estiloTexto as txt } from "@/lib/emailOutlook";

export const OPERADORAS_COBERTURA = ["CLARO", "VIVO"] as const;
export type OperadoraCobertura = (typeof OPERADORAS_COBERTURA)[number];
export const NOME_OPERADORA: Record<OperadoraCobertura, string> = { CLARO: "Claro", VIVO: "Vivo" };
/** Mapas das próprias operadoras, para o cliente consultar um endereço específico. */
export const MAPA_DA_OPERADORA: Record<OperadoraCobertura, string> = {
  CLARO: "https://www.claro.com.br/mapa-de-cobertura",
  VIVO: "https://vivo.com.br/para-voce/por-que-vivo/qualidade/cobertura",
};

/** Nome da cidade sem acento, pontuação e caixa (mesma regra da carga em scripts/cobertura). */
export const normalizarMunicipio = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** % da área e dos moradores com sinal, por operadora (0 a 100). */
export interface ResumoOperadora {
  operadora: OperadoraCobertura;
  area4g: number; moradores4g: number;
  area5g: number; moradores5g: number;
}
export interface CoberturaMunicipio { codIbge: number; municipio: string; uf: string; periodo: string; resumo: ResumoOperadora[] }

interface LinhaCobertura { cod_ibge: number; municipio: string; uf: string; operadora: string; tecnologia: string; pct_area: number; pct_moradores: number; periodo: string }

export function resumir(linhas: LinhaCobertura[]): ResumoOperadora[] {
  return OPERADORAS_COBERTURA.map(operadora => {
    const de = (tec: string) => linhas.find(l => l.operadora === operadora && l.tecnologia === tec);
    return {
      operadora,
      area4g: Number(de("4G")?.pct_area ?? 0), moradores4g: Number(de("4G")?.pct_moradores ?? 0),
      area5g: Number(de("5G")?.pct_area ?? 0), moradores5g: Number(de("5G")?.pct_moradores ?? 0),
    };
  });
}

/** A de maior % da área com 4G; desempate pelos moradores com 4G. Ninguém com 4G: null. */
export function recomendada(resumo: ResumoOperadora[]): OperadoraCobertura | null {
  const [melhor] = [...resumo].sort((a, b) => b.area4g - a.area4g || b.moradores4g - a.moradores4g);
  return melhor && (melhor.area4g > 0 || melhor.moradores4g > 0) ? melhor.operadora : null;
}

/** "2026-09" → "09/2026" */
export const periodoTexto = (p: string) => { const [a, m] = p.split("-"); return `${m}/${a}`; };
/**
 * Dados velhos: a Anatel publica a cada trimestre (o período de 09 sai em outubro), então mais
 * de 6 meses desde o período indica que a carga semanal parou.
 */
export function dadosAtrasados(periodo: string, hoje = new Date()) {
  const [a, m] = periodo.split("-").map(Number);
  return (hoje.getFullYear() - a) * 12 + (hoje.getMonth() + 1 - m) > 6;
}
/** 79.9 → "79,9%" */
export const pctTexto = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export type ResultadoCobertura =
  | { status: "fora" }                        // projeto fora do Brasil
  | { status: "sem_dados" }                   // a carga da Anatel ainda não rodou
  | { status: "nao_encontrado"; uf: string }  // a cidade do cadastro não bateu com a lista da Anatel
  | { status: "ok"; dados: CoberturaMunicipio };

const COLS = "cod_ibge, municipio, uf, operadora, tecnologia, pct_area, pct_moradores, periodo";

/** Cobertura da cidade do cadastro (ou do município escolhido quando o nome não bate). */
export async function buscarCobertura(p: GerProject, codIbge?: number | null): Promise<ResultadoCobertura> {
  if ((p.country_code ?? "BR") !== "BR") return { status: "fora" };
  const base = supabase.from("cobertura_movel_municipio").select(COLS);
  const { data, error } = await (codIbge
    ? base.eq("cod_ibge", codIbge)
    : base.eq("uf", p.state ?? "").eq("municipio_norm", normalizarMunicipio(p.city)));
  if (error) throw error;
  if (!data?.length) {
    const { count, error: e2 } = await supabase.from("cobertura_movel_meta").select("id", { count: "exact", head: true });
    if (e2) throw e2;
    return count ? { status: "nao_encontrado", uf: p.state ?? "" } : { status: "sem_dados" };
  }
  const l0 = data[0];
  return { status: "ok", dados: { codIbge: l0.cod_ibge, municipio: l0.municipio, uf: l0.uf, periodo: l0.periodo, resumo: resumir(data) } };
}

/** Municípios de uma UF, para escolher quando o nome do cadastro não bate. */
export async function municipiosDaUf(uf: string): Promise<{ codIbge: number; nome: string }[]> {
  const { data, error } = await supabase.from("cobertura_movel_municipio").select("cod_ibge, municipio")
    .eq("uf", uf).eq("operadora", "CLARO").eq("tecnologia", "4G").order("municipio");
  if (error) throw error;
  return (data ?? []).map(d => ({ codIbge: d.cod_ibge, nome: d.municipio }));
}

/** Setor censitário: anéis compactados e % do setor com [4G, 5G] por operadora. */
export interface SetorMapa { c: string; g: number[][]; v: Partial<Record<OperadoraCobertura, [number, number]>> }
export interface SetoresMunicipio {
  periodo: string;
  municipio: { cod_ibge: number; nome: string; uf: string };
  bbox: [number, number, number, number];
  setores: SetorMapa[];
}

/** Mapa dos setores do município (arquivo público gravado pela carga). Sem arquivo: null. */
export async function buscarSetores(codIbge: number): Promise<SetoresMunicipio | null> {
  const url = supabase.storage.from("cobertura").getPublicUrl(`setores/${codIbge}.json`).data.publicUrl;
  const r = await fetch(url);
  if (r.status === 400 || r.status === 404) return null;
  if (!r.ok) throw new Error(`Não foi possível carregar o mapa do município (HTTP ${r.status}).`);
  return r.json();
}

/**
 * Sobe a imagem do mapa para o e-mail apontar para ela (o Outlook embute ao colar).
 * Um arquivo por projeto, período e município: o e-mail já enviado não muda quando chegar outro trimestre.
 */
export async function enviarMapa(projectId: string, periodo: string, codIbge: number, png: Blob): Promise<string> {
  const caminho = `mapas/${projectId}/${periodo}-${codIbge}.png`;
  const { error } = await supabase.storage.from("cobertura").upload(caminho, png, { contentType: "image/png", upsert: true, cacheControl: "3600" });
  if (error) throw error;
  return supabase.storage.from("cobertura").getPublicUrl(caminho).data.publicUrl;
}

/** Desfaz a compactação da carga: cada anel volta a ser [longitude, latitude]. */
export const aneisDoSetor = (s: SetorMapa): [number, number][][] => s.g.map(r => {
  const pts: [number, number][] = [];
  let x = 0, y = 0;
  for (let i = 0; i + 1 < r.length; i += 2) { x += r[i]; y += r[i + 1]; pts.push([x / 1e5, y / 1e5]); }
  return pts;
});

// ---------------------------------------------------------------- e-mail ao cliente

/** Uma cidade no e-mail: o comparativo, a operadora recomendada e o mapa. */
export interface BlocoCobertura {
  dados: CoberturaMunicipio;
  recomendada: OperadoraCobertura | null;
  /** Endereço público da imagem do mapa (ou um endereço local, na prévia). */
  mapaUrl: string | null;
}

/** E-mail ao cliente: um bloco por cidade da operação (uma só, se o projeto tiver uma). */
export interface EmailCobertura {
  project: GerProject;
  cidades: BlocoCobertura[];
  remetente: string;
}

const cidadeUf = (d: CoberturaMunicipio) => `${d.municipio}/${d.uf}`;
/** "Caçador/SC, Videira/SC e Fraiburgo/SC" */
const listaCidades = (e: EmailCobertura) => {
  const t = e.cidades.map(c => cidadeUf(c.dados));
  return t.length <= 1 ? t.join("") : `${t.slice(0, -1).join(", ")} e ${t.at(-1)}`;
};

export const assuntoCobertura = (e: EmailCobertura) =>
  `COBERTURA DAS OPERADORAS | ${e.cidades.map(c => cidadeUf(c.dados)).join(", ").toUpperCase()} | ${e.project.company_name.trim().toUpperCase()}`;

/** Frase da recomendação, com o número da outra operadora para comparar. */
export function fraseRecomendacao(d: CoberturaMunicipio, rec: OperadoraCobertura | null): string {
  if (!rec) return "Nenhuma das duas operadoras tem cobertura 4G registrada no município.";
  const r = d.resumo.find(x => x.operadora === rec)!;
  const outras = d.resumo.filter(x => x.operadora !== rec).map(x => `${NOME_OPERADORA[x.operadora]}: ${pctTexto(x.area4g)}`).join("; ");
  return `${NOME_OPERADORA[rec]}, com sinal 4G em ${pctTexto(r.area4g)} da área do município${outras ? ` (${outras})` : ""}.`;
}

const FONTE_DADOS = (periodo: string) =>
  `Fonte: Anatel, cobertura estimada a partir das estações licenciadas das operadoras, período ${periodoTexto(periodo)}. Não substitui medição em campo.`;

/** HTML de uma cidade: faixa com o nome, tabela Claro × Vivo, recomendação e mapa. */
function blocoHtml(b: BlocoCobertura): string {
  const { dados: d, recomendada: rec } = b;
  const linha = "border-top:1px solid #e3dcec;";
  const th = (t: string, w: string) => `<td width="${w}" bgcolor="#efe6f6" style="${txt(11, "#4b1768", true)}background-color:#efe6f6;padding:8px 12px;${linha}">${t}</td>`;
  const linhas = d.resumo.map(r => {
    const destaque = r.operadora === rec;
    const fundo = destaque ? ` bgcolor="#e6f6ee"` : "";
    const bg = destaque ? "background-color:#e6f6ee;" : "";
    const td = (t: string, bold = false) => `<td${fundo} style="${txt(13, "#1f1630", bold)}${bg}padding:8px 12px;${linha}">${t}</td>`;
    const nome = `${esc(NOME_OPERADORA[r.operadora])}${destaque ? `&nbsp;&nbsp;<span style="${txt(10, "#047857", true)}">RECOMENDADA</span>` : ""}`;
    return `<tr>${td(nome, true)}${td(pctTexto(r.area4g), destaque)}${td(pctTexto(r.moradores4g))}${td(pctTexto(r.area5g))}${td(pctTexto(r.moradores5g))}</tr>`;
  }).join("");
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:640px;border:1px solid #e3dcec;margin-top:16px;">`
    + `<tr><td colspan="5" bgcolor="#4b1768" style="background-color:#4b1768;padding:14px 16px;">`
    + `<p style="${txt(11, "#dcc8ec", true)}margin:0;">COBERTURA DAS OPERADORAS &nbsp;|&nbsp; ANATEL ${periodoTexto(d.periodo)}</p>`
    + `<p style="${txt(16, "#ffffff", true)}margin:4px 0 0 0;">${esc(cidadeUf(d))}</p></td></tr>`
    + `<tr>${th("OPERADORA", "32%")}${th("4G · ÁREA", "17%")}${th("4G · MORADORES", "17%")}${th("5G · ÁREA", "17%")}${th("5G · MORADORES", "17%")}</tr>`
    + linhas
    + `</table>`
    + `<p style="${txt(14, "#1f1630")}margin:12px 0 0 0;"><b style="${txt(14, "#1f1630", true)}">Recomendação em ${esc(cidadeUf(d))}:</b> ${esc(fraseRecomendacao(d, rec))}</p>`
    + (b.mapaUrl
      ? `<p style="${txt(13, "#1f1630", true)}margin:14px 0 2px 0;">Mapa de calor da cobertura 4G · ${esc(cidadeUf(d))}</p>`
        + `<p style="${txt(12, "#645a72")}margin:0 0 8px 0;">Cada área é um setor censitário do IBGE: verde, sinal em todo o setor; vermelho, sem sinal.</p>`
        + `<img src="${esc(b.mapaUrl)}" width="640" alt="Mapa de calor da cobertura 4G da Claro e da Vivo em ${esc(cidadeUf(d))}" style="display:block;width:100%;max-width:640px;height:auto;border:1px solid #e3dcec;">`
      : "");
}

/** HTML do e-mail ao cliente (mesmas regras do e-mail ao Data Center para colar no Outlook). */
export function emailHtmlCobertura(e: EmailCobertura): string {
  const p0 = (texto: string, extra = "") => `<p style="${txt(14, "#1f1630")}margin:0;${extra}">${texto}</p>`;
  const links = (Object.keys(MAPA_DA_OPERADORA) as OperadoraCobertura[])
    .map(op => `<a href="${MAPA_DA_OPERADORA[op]}" style="${txt(13, "#4b1768", true)}">mapa da ${NOME_OPERADORA[op]}</a>`).join(" · ");
  const periodo = e.cidades[0]?.dados.periodo ?? "";
  return p0("Prezados,")
    + p0(`Segue o comparativo de cobertura das operadoras Claro e Vivo em ${esc(listaCidades(e))}, com base nos dados oficiais da Anatel.`)
    + e.cidades.map(blocoHtml).join("")
    + p0(`Para consultar um endereço específico: ${links}.`, "margin-top:16px;")
    + (periodo ? `<p style="${txt(11, "#8a8197")}margin:10px 0 0 0;">${esc(FONTE_DADOS(periodo))}</p>` : "")
    + p0("Atenciosamente,", "margin-top:16px;")
    + p0(`<b style="${txt(14, "#1f1630", true)}">${esc(e.remetente)}</b>`)
    + `<p style="${txt(13, "#645a72")}margin:0;">Transdata</p>`;
}

/** Versão em texto (para quem colar onde não aceita formatação). */
export function emailTextoCobertura(e: EmailCobertura): string {
  const periodo = e.cidades[0]?.dados.periodo ?? "";
  return [
    "Prezados,", "",
    `Segue o comparativo de cobertura das operadoras Claro e Vivo em ${listaCidades(e)}, com base nos dados oficiais da Anatel.`,
    ...e.cidades.flatMap(({ dados: d, recomendada: rec }) => [
      "", `${cidadeUf(d)}:`,
      ...d.resumo.map(r => `${NOME_OPERADORA[r.operadora]}${r.operadora === rec ? " (recomendada)" : ""}: 4G em ${pctTexto(r.area4g)} da área e ${pctTexto(r.moradores4g)} dos moradores; 5G em ${pctTexto(r.area5g)} da área e ${pctTexto(r.moradores5g)} dos moradores.`),
      `Recomendação: ${fraseRecomendacao(d, rec)}`,
    ]),
    "",
    ...(Object.keys(MAPA_DA_OPERADORA) as OperadoraCobertura[]).map(op => `Mapa da ${NOME_OPERADORA[op]}: ${MAPA_DA_OPERADORA[op]}`),
    ...(periodo ? ["", FONTE_DADOS(periodo)] : []), "", "Atenciosamente,", e.remetente, "Transdata",
  ].join("\n");
}

/** Abre o e-mail no Outlook (programa) com destinatário (opcional) e assunto. */
export const mailtoCobertura = (para: string, assunto: string) =>
  `mailto:${para.replace(/\s+/g, "")}?subject=${encodeURIComponent(assunto)}`;
/** Abre o e-mail no Outlook na web. */
export const outlookWebCobertura = (para: string, assunto: string) =>
  `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(para.replace(/\s+/g, ""))}&subject=${encodeURIComponent(assunto)}`;
