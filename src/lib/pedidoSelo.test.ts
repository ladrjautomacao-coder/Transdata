import { describe, expect, it } from "vitest";
import { fimDoContrato, type GerProject } from "@/lib/gerenciamento";
import { faltandoPedido, htmlPedido, pedidoDesignacaoGp, textoPedido } from "@/lib/pedidoSelo";

const projeto = (extra: Partial<GerProject> = {}) => ({
  company_name: "EMPRESA TESTE LTDA", project_code: "TUBSCASUPG0002-EMPRESATESTELTDA",
  manager: { full_name: "Luiz Alves dos Reis Junior" }, client_manager_name: "Carla Souza",
  d_zero_date: "2026-10-20", contract_date: "2026-09-15", contractual_deadline_days: 365,
  ...extra,
}) as unknown as GerProject;

describe("fimDoContrato", () => {
  it("soma o prazo contratual à data de contratação", () => {
    expect(fimDoContrato({ contract_date: "2026-09-15", contractual_deadline_days: 365 })).toBe("2027-09-15");
    expect(fimDoContrato({ contract_date: "2026-01-31", contractual_deadline_days: 30 })).toBe("2026-03-02");
  });
  it("sem contratação ou sem prazo, não há fim do contrato", () => {
    expect(fimDoContrato({ contract_date: "2026-09-15", contractual_deadline_days: null })).toBeNull();
    expect(fimDoContrato({ contract_date: null, contractual_deadline_days: 90 })).toBeNull();
  });
});

describe("pedido IMP [IN1-8] Designação do GP", () => {
  it("traz os itens na ordem do selo, com os valores do cadastro", () => {
    expect(textoPedido(pedidoDesignacaoGp(projeto()))).toBe([
      "Selo: IMP [IN1-8] Designação do GP",
      "Departamento: CPQ - PMO",
      "Nome do Projeto: EMPRESA TESTE LTDA",
      "Código do Projeto: TUBSCASUPG0002-EMPRESATESTELTDA",
      "Gerente de Projetos Transdata: Luiz Alves dos Reis Junior",
      "Gerente de Projetos no Cliente: Carla Souza",
      "Data do D-zero: 20/10/2026",
      "Data de encerramento do Projeto: 15/09/2027",
    ].join("\n"));
  });
  it("aponta o que falta no cadastro", () => {
    const pd = pedidoDesignacaoGp(projeto({ client_manager_name: "  ", contractual_deadline_days: null, d_zero_date: null }));
    expect(faltandoPedido(pd)).toEqual(["Gerente de Projetos no Cliente", "Data do D-zero", "Data de encerramento do Projeto"]);
    expect(faltandoPedido(pedidoDesignacaoGp(projeto()))).toEqual([]);
  });
  it("o HTML escapa o que vem do cadastro e leva o selo em maiúsculas", () => {
    const html = htmlPedido(pedidoDesignacaoGp(projeto({ company_name: "A & B <Transportes>" })));
    expect(html).toContain("A &amp; B &lt;Transportes&gt;");
    expect(html).not.toContain("<Transportes>");
    expect(html).toContain("IMP [IN1-8] DESIGNAÇÃO DO GP");
  });
});
