import { describe, expect, it } from "vitest";
import type { GerProject } from "@/lib/gerenciamento";
import { modulo02Vazio } from "@/lib/modulo02";
import { faltandoComprovantes, montarComprovantesPdf, type Comprovante } from "@/lib/comprovantesFinanceiro";

const project = {
  id: "p1", company_name: "Auto Coletivo Caçador Ltda", project_code: "CACSCASNEW0008-AUTO", city: "Caçador", state: "SC", country_code: "BR",
  manager: { full_name: "Luiz Alves" }, executive: null, client_manager_name: null, operation_cities: [], project_solutions: [],
} as unknown as GerProject;
const comp = (patch: Partial<Comprovante>): Comprovante =>
  ({ id: "c", arquivo: "a.jpg", tipo: "Hospedagem", descricao: "", imagem: "data:image/jpeg;base64,", largura: 10, altura: 10, ...patch });

describe("comprovantes ao Financeiro", () => {
  it("pede ao menos um comprovante e o tipo de cada um", () => {
    expect(faltandoComprovantes([])).toEqual(["ao menos um comprovante"]);
    expect(faltandoComprovantes([comp({}), comp({ id: "d", tipo: "" })])).toEqual(["o tipo de cada comprovante"]);
    expect(faltandoComprovantes([comp({})])).toEqual([]);
  });
  it("PDF: o resumo com o projeto, a visita e a lista, e um comprovante por página", () => {
    const d = montarComprovantesPdf(project, modulo02Vazio(), [comp({ tipo: "Passagem aérea", descricao: " LATAM " }), comp({ id: "d" })], "Luiz Alves", new Date(2026, 9, 29));
    expect(d.arquivo).toBe("Comprovantes-Visita-PE-CACSCASNEW0008");
    expect(d.projeto).toBe("CACSCASNEW0008 - AUTO COLETIVO CAÇADOR LTDA");
    expect(d.grupos.map(g => g.titulo)).toEqual(["PROJETO", "VISITA DE PROJETO EXECUTIVO", "COMPROVANTES ANEXADOS (2)"]);
    expect(d.comprovantes.map(c => [c.titulo, c.descricao])).toEqual([["Comprovante 1 de 2 · Passagem aérea", "LATAM"], ["Comprovante 2 de 2 · Hospedagem", ""]]);
    expect(d.rodape).toBe("Gerado no portal Transdata em 29/10/2026 por Luiz Alves");
  });
});
