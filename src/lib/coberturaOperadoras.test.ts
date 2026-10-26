import { describe, expect, it } from "vitest";
import {
  aneisDoSetor, dadosAtrasados, emailHtmlCobertura, emailTextoCobertura, fraseRecomendacao, normalizarMunicipio, pctTexto, periodoTexto,
  recomendada, resumir, type CoberturaMunicipio, type ResumoOperadora,
} from "@/lib/coberturaOperadoras";
import { precisaCobertura, type GerProject } from "@/lib/gerenciamento";

describe("precisaCobertura", () => {
  const com = (...nomes: string[]) => ({ project_solutions: nomes.map(name => ({ solution: { name } })) }) as unknown as GerProject;
  it("vale para Carrier, ITS e Gestão de Frota (nomes do cadastro)", () => {
    expect(precisaCobertura(com("Bilhetagem", "Carrier"))).toBe(true);
    expect(precisaCobertura(com("Its (legado)"))).toBe(true);
    expect(precisaCobertura(com("Gestão de frota"))).toBe(true);
  });
  it("não vale para as outras soluções", () => {
    expect(precisaCobertura(com("Bilhetagem", "AtlasMob", "Biometria facial"))).toBe(false);
    expect(precisaCobertura(com())).toBe(false);
  });
});

// Tubarão/SC, Anatel 09/2026
const linhas = [
  { op: "CLARO", tec: "4G", area: 79.9, mor: 98.23 }, { op: "VIVO", tec: "4G", area: 56.58, mor: 94.15 },
  { op: "CLARO", tec: "5G", area: 42.23, mor: 91.22 }, { op: "VIVO", tec: "5G", area: 11.14, mor: 65.01 },
  { op: "CLARO", tec: "Todas", area: 88.19, mor: 99.27 },
].map(l => ({ cod_ibge: 4218707, municipio: "Tubarão", uf: "SC", operadora: l.op, tecnologia: l.tec, pct_area: l.area, pct_moradores: l.mor, periodo: "2026-09" }));

const r = (operadora: "CLARO" | "VIVO", area4g: number, moradores4g: number): ResumoOperadora => ({ operadora, area4g, moradores4g, area5g: 0, moradores5g: 0 });

describe("normalizarMunicipio", () => {
  it("ignora acento, caixa e pontuação", () => {
    expect(normalizarMunicipio("TUBARÃO")).toBe("tubarao");
    expect(normalizarMunicipio("  São José dos Pinhais ")).toBe("sao jose dos pinhais");
    expect(normalizarMunicipio("Nova Brasilândia D'Oeste")).toBe(normalizarMunicipio("nova brasilandia d oeste"));
    expect(normalizarMunicipio("Embu-Guaçu")).toBe("embu guacu");
  });
});

describe("resumir e recomendada", () => {
  it("monta o resumo por operadora com 4G e 5G", () => {
    expect(resumir(linhas)).toEqual([
      { operadora: "CLARO", area4g: 79.9, moradores4g: 98.23, area5g: 42.23, moradores5g: 91.22 },
      { operadora: "VIVO", area4g: 56.58, moradores4g: 94.15, area5g: 11.14, moradores5g: 65.01 },
    ]);
  });
  it("recomenda a de maior área com 4G", () => {
    expect(recomendada(resumir(linhas))).toBe("CLARO");
    expect(recomendada([r("CLARO", 40, 99), r("VIVO", 60, 80)])).toBe("VIVO");
  });
  it("desempata pelos moradores com 4G", () => {
    expect(recomendada([r("CLARO", 50, 80), r("VIVO", 50, 90)])).toBe("VIVO");
  });
  it("sem 4G em nenhuma: sem recomendação", () => {
    expect(recomendada([r("CLARO", 0, 0), r("VIVO", 0, 0)])).toBeNull();
  });
});

describe("dadosAtrasados", () => {
  const hoje = new Date(2026, 9, 25); // 25/10/2026
  it("período do último trimestre ou do anterior está em dia", () => {
    expect(dadosAtrasados("2026-09", hoje)).toBe(false);
    expect(dadosAtrasados("2026-06", hoje)).toBe(false);
  });
  it("mais de 6 meses indica que a carga parou", () => {
    expect(dadosAtrasados("2026-03", hoje)).toBe(true);
    expect(dadosAtrasados("2025-12", hoje)).toBe(true);
  });
});

describe("textos", () => {
  it("formata período e porcentagem em pt-BR", () => {
    expect(periodoTexto("2026-09")).toBe("09/2026");
    expect(pctTexto(79.9)).toBe("79,9%");
    expect(pctTexto(100)).toBe("100%");
  });
  it("frase da recomendação traz a outra operadora para comparar", () => {
    const d: CoberturaMunicipio = { codIbge: 4218707, municipio: "Tubarão", uf: "SC", periodo: "2026-09", resumo: resumir(linhas) };
    expect(fraseRecomendacao(d, "CLARO")).toBe("Claro, com sinal 4G em 79,9% da área do município (Vivo: 56,6%).");
  });
});

describe("e-mail ao cliente", () => {
  const project = { id: "p1", company_name: "Empresa Teste Ltda", city: "Tubarão", state: "SC", country_code: "BR" } as GerProject;
  const dados: CoberturaMunicipio = { codIbge: 4218707, municipio: "Tubarão", uf: "SC", periodo: "2026-09", resumo: resumir(linhas) };
  const html = emailHtmlCobertura({ project, dados, recomendada: "CLARO", remetente: "Luiz Alves", mapaUrl: "https://x.supabase.co/storage/v1/object/public/cobertura/mapas/p1/2026-09.png" });

  it("só usa o que o Outlook mantém ao colar", () => {
    expect(html).not.toMatch(/text-transform|letter-spacing|border-radius|opacity|display:inline-block/);
    expect(html).toContain("COBERTURA DAS OPERADORAS");
    expect(html).toContain("RECOMENDADA");
    expect(html).toContain('bgcolor="#4b1768"');
  });
  it("leva tabela, mapa, links das operadoras e a fonte", () => {
    expect(html).toContain("79,9%");
    expect(html).toContain('src="https://x.supabase.co/storage/v1/object/public/cobertura/mapas/p1/2026-09.png"');
    expect(html).toContain("https://www.claro.com.br/mapa-de-cobertura");
    expect(html).toContain("período 09/2026");
  });
  it("sem a imagem, o e-mail vai sem o bloco do mapa", () => {
    expect(emailHtmlCobertura({ project, dados, recomendada: "CLARO", remetente: "Luiz", mapaUrl: null })).not.toContain("<img");
  });
  it("tem versão em texto", () => {
    expect(emailTextoCobertura({ project, dados, recomendada: "CLARO", remetente: "Luiz", mapaUrl: null })).toContain("Claro (recomendada): 4G em 79,9% da área");
  });
});

describe("aneisDoSetor", () => {
  it("desfaz a compactação da carga (diferenças em 1e-5 grau)", () => {
    // mesmo formato de scripts/cobertura/atualizar.mjs: [x0, y0, dx1, dy1, ...]
    const pontos: [number, number][] = [[-49.00296, -28.48087], [-49.00382, -28.47792], [-49.00511, -28.47885], [-49.00296, -28.48087]];
    let px = 0, py = 0;
    const anel = pontos.flatMap(([x, y]) => { const ix = Math.round(x * 1e5), iy = Math.round(y * 1e5); const d = [ix - px, iy - py]; px = ix; py = iy; return d; });
    const [volta] = aneisDoSetor({ c: "421870705000001", g: [anel], v: {} });
    volta.forEach(([x, y], i) => { expect(x).toBeCloseTo(pontos[i][0], 5); expect(y).toBeCloseTo(pontos[i][1], 5); });
  });
});
