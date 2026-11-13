import { describe, expect, it } from "vitest";
import type { GerProject } from "@/lib/gerenciamento";
import {
  assuntoCodigo, assuntoCodigoBd, codigoProjetoBd, emailHtmlCodigo, emailHtmlCodigoBd, emailTextoCodigo, emailTextoCodigoBd, faltandoCodigoBd,
} from "@/lib/codigoBd";

const projeto = (extra: Partial<GerProject> = {}) => ({
  company_name: "Auto Coletivo Cacador Ltda", project_code: "CACSCASUPG0008-AUTOCOLETIVOCACADORLTDA", city: "CAÇADOR", state: "SC",
  cnpj: "11.111.111/1111-11", fleet_urbano: 30, fleet_seccionado: 0, project_solutions: [{ solution: { name: "Bilhetagem" } }],
  ...extra,
}) as unknown as GerProject;

describe("e-mail do cadastro do código BD", () => {
  it("código do projeto sem o nome da empresa do final, seguido da razão social", () => {
    expect(codigoProjetoBd(projeto())).toBe("CACSCASUPG0008 - AUTO COLETIVO CACADOR LTDA");
    expect(assuntoCodigoBd(projeto())).toBe("CADASTRO DO CÓDIGO BD | CACSCASUPG0008 - AUTO COLETIVO CACADOR LTDA");
  });
  it("traz os itens do modelo, com o sistema vindo das soluções e da frota", () => {
    const texto = emailTextoCodigoBd(projeto(), "Luiz Alves");
    expect(texto).toContain("Código do Projeto: CACSCASUPG0008 - AUTO COLETIVO CACADOR LTDA");
    expect(texto).toContain("Razão Social: AUTO COLETIVO CACADOR LTDA");
    expect(texto).toContain("CNPJ: 11.111.111/1111-11");
    expect(texto).toContain("Sistema: TDMax Urbano");
    expect(texto).toContain("Cidade: CAÇADOR/SC");
    expect(emailHtmlCodigoBd(projeto(), "Luiz Alves")).toContain("CADASTRO DO CÓDIGO BD");
  });
  it("sem CNPJ ou sem código do projeto, o e-mail não fica pronto", () => {
    expect(faltandoCodigoBd(projeto())).toEqual([]);
    expect(faltandoCodigoBd(projeto({ cnpj: null, project_code: null }))).toEqual(["Código do projeto", "CNPJ no cadastro do projeto"]);
  });
});

describe("e-mail do cadastro do código ITS / Gestão de frota", () => {
  const its = () => projeto({ fleet_size: 30, project_solutions: [{ solution: { name: "Bilhetagem" } }, { solution: { name: "Its (legado)" } }, { solution: { name: "Gestão de frota" } }] });
  it("assunto e pedido próprios, com o mesmo código do projeto", () => {
    expect(assuntoCodigo(its(), "its")).toBe("CADASTRO DO CÓDIGO ITS / GESTÃO DE FROTA | CACSCASUPG0008 - AUTO COLETIVO CACADOR LTDA");
    const texto = emailTextoCodigo(its(), "Luiz Alves", "its");
    expect(texto).toContain("cadastro do cliente no ITS / Gestão de frota");
    expect(emailHtmlCodigo(its(), "Luiz Alves", "its")).toContain("CADASTRO DO CÓDIGO ITS / GESTÃO DE FROTA");
  });
  it("no lugar do sistema de bilhetagem, a solução de ITS / Gestão de frota e a frota", () => {
    const texto = emailTextoCodigo(its(), "Luiz Alves", "its");
    expect(texto).toContain("Solução: Its (legado), Gestão de frota");
    expect(texto).toContain("Frota: 30 veículos");
    expect(texto).not.toContain("Sistema:");
  });
});
