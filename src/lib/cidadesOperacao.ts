// Cidades da operação do projeto (além da cidade do contrato): uma operação pode rodar em 2 ou 3
// municípios. Escolhidas da lista do IBGE da cobertura da Anatel, com o código do município, para
// o mapa de calor das operadoras analisar cada uma.

export interface CidadeOperacao { cod_ibge: number; municipio: string; uf: string }

/** Lê a lista gravada em projects.operation_cities (ignora o que não estiver no formato). */
export function lerCidadesOperacao(raw: unknown): CidadeOperacao[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(c => {
    const o = c as Partial<CidadeOperacao> | null;
    return o && Number.isFinite(Number(o.cod_ibge)) && typeof o.municipio === "string" && typeof o.uf === "string"
      ? [{ cod_ibge: Number(o.cod_ibge), municipio: o.municipio, uf: o.uf }] : [];
  });
}

/** "Caçador/SC" */
export const cidadeOperacaoTexto = (c: Pick<CidadeOperacao, "municipio" | "uf">) => `${c.municipio}/${c.uf}`;
/** "Caçador/SC, Videira/SC e Fraiburgo/SC" */
export function cidadesOperacaoTexto(cs: Pick<CidadeOperacao, "municipio" | "uf">[]): string {
  const t = cs.map(cidadeOperacaoTexto);
  return t.length <= 1 ? t.join("") : `${t.slice(0, -1).join(", ")} e ${t.at(-1)}`;
}

/** Acrescenta a cidade se ainda não estiver na lista (mesmo código do IBGE). */
export const incluirCidade = (lista: CidadeOperacao[], c: CidadeOperacao) =>
  lista.some(x => x.cod_ibge === c.cod_ibge) ? lista : [...lista, c];
