import { describe, expect, it } from "vitest";
import {
  FILTROS_PADRAO, cargaPorGerente, contarStatus, csvProjetos, descartado, evolucaoFrota, evolucaoSolucoes, filtrar, frotaPorStatus, porSolucao,
  type DashProject,
} from "@/lib/dashboard";
import { DEFAULT_STATUS_LABELS } from "@/lib/statusLabels";

const proj = (x: Partial<DashProject> & Pick<DashProject, "id">): DashProject => ({
  company_name: `Viação ${x.id}`, project_code: `COD${x.id}`, city: "Joinville", state: "SC", contract_date: "2026-01-10", d_zero_date: null,
  status: "implantacao", sub_phase: null, fleet_size: 10, is_pilot: false, complementary_sale: false, complementary_fleet: 0, implemented_fleet: 0,
  reached_implemented: false, manager_id: "g1", manager: { full_name: "Ana Lima" }, project_solutions: [{ solution: { name: "Bilhetagem" } }], ...x,
});

describe("filtros do Dashboard", () => {
  const ps = [
    proj({ id: "1" }),
    proj({ id: "2", status: "comercial", state: "PR", city: "Curitiba", manager_id: null, manager: null, project_solutions: [{ solution: { name: "Carrier" } }] }),
    proj({ id: "3", status: "encerrado", contract_date: "2024-05-02", company_name: "Expresso Integração" }),
  ];
  it("combina status, estado, solução, gerente, período e busca sem acento", () => {
    expect(filtrar(ps, { ...FILTROS_PADRAO, status: "comercial" }).map(p => p.id)).toEqual(["2"]);
    expect(filtrar(ps, { ...FILTROS_PADRAO, solucao: "Bilhetagem", estado: "SC" }).map(p => p.id)).toEqual(["1", "3"]);
    expect(filtrar(ps, { ...FILTROS_PADRAO, gerente: "Sem gerente" }).map(p => p.id)).toEqual(["2"]);
    expect(filtrar(ps, { ...FILTROS_PADRAO, de: "2025-01-01" }).map(p => p.id)).toEqual(["1", "2"]);
    expect(filtrar(ps, { ...FILTROS_PADRAO, busca: "integracao" }).map(p => p.id)).toEqual(["3"]);
  });
  it("o bloco pode ignorar o próprio filtro (mostra todos e destaca o escolhido)", () => {
    expect(filtrar(ps, { ...FILTROS_PADRAO, status: "comercial", estado: "SC" }, "status").map(p => p.id)).toEqual(["1", "3"]);
  });
  it("Cancelado e Piloto reprovado ficam fora", () => {
    expect(descartado({ status: "suspenso", sub_phase: "cancelado" })).toBe(true);
    expect(descartado({ status: "suspenso", sub_phase: "suspenso" })).toBe(false);
  });
});

describe("contas", () => {
  it("quem já foi Implementado conta como Implementado; frota implementada vai para Implementado", () => {
    const ps = [proj({ id: "1", reached_implemented: true, status: "implantacao" }), proj({ id: "2", fleet_size: 40, implemented_fleet: 15 })];
    expect(contarStatus(ps)).toMatchObject({ encerrado: 1, implantacao: 1 });
    expect(frotaPorStatus(ps)).toMatchObject({ encerrado: 25, implantacao: 25 });
  });
  it("carga por gerente: pela coluna do Kanban, quem tem menos em andamento primeiro", () => {
    const g = cargaPorGerente([
      proj({ id: "1" }), proj({ id: "2", status: "comercial" }), proj({ id: "3", status: "encerrado" }),
      proj({ id: "4", manager_id: "g2", manager: { full_name: "Bruno Reis" } }),
    ]);
    expect(g.map(x => [x.nome, x.emAndamento, x.implementados, x.total])).toEqual([["Bruno Reis", 1, 0, 1], ["Ana Lima", 2, 1, 3]]);
    expect(g[1]).toMatchObject({ id: "g1", comercial: 1, implantacao: 1 });
  });
  it("soluções da mais usada para a menos usada", () => {
    expect(porSolucao([proj({ id: "1" }), proj({ id: "2", project_solutions: [{ solution: { name: "Carrier" } }, { solution: { name: "Bilhetagem" } }] })]))
      .toEqual([{ nome: "Bilhetagem", n: 2 }, { nome: "Carrier", n: 1 }]);
  });
});

describe("linha do tempo", () => {
  it("frota acumulada em todos os meses, sem buracos, até o mês pedido", () => {
    const r = evolucaoFrota([proj({ id: "1", contract_date: "2026-01-10" }), proj({ id: "2", contract_date: "2026-03-05", fleet_size: 5 })], "2026-04");
    expect(r.map(x => [x.mes, x.frota])).toEqual([["jan/26", 10], ["fev/26", 10], ["mar/26", 15], ["abr/26", 15]]);
  });
  it("por solução: as maiores em destaque, as outras à parte", () => {
    const r = evolucaoSolucoes([
      proj({ id: "1", fleet_size: 50 }),
      proj({ id: "2", fleet_size: 20, project_solutions: [{ solution: { name: "Carrier" } }] }),
      proj({ id: "3", fleet_size: 5, project_solutions: [{ solution: { name: "ATMs" } }] }),
    ], "2026-01", 2);
    expect(r.destaques.map(d => d.nome)).toEqual(["Bilhetagem", "Carrier"]);
    expect(r.outras.map(d => d.nome)).toEqual(["ATMs"]);
    expect(r.linhas[0]).toMatchObject({ mes: "jan/26", Bilhetagem: 50, Carrier: 20, ATMs: 5 });
  });
});

describe("exportar", () => {
  it("planilha com ponto e vírgula, aspas onde precisa e datas dd/mm/aaaa", () => {
    const csv = csvProjetos([proj({ id: "1", company_name: "Viação \"Azul\"; Ltda", d_zero_date: "2026-02-01" })], DEFAULT_STATUS_LABELS);
    // começa com a marca de UTF-8 (para o Excel ler os acentos)
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [cab, linha] = csv.slice(1).split("\r\n");
    expect(cab.split(";")[0]).toBe("Projeto");
    expect(linha).toBe('"Viação ""Azul""; Ltda";COD1;Joinville;SC;Implantação;Ana Lima;10;Bilhetagem;10/01/2026;01/02/2026');
  });
});
