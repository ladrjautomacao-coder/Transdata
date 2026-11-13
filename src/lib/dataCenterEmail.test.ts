import { describe, expect, it } from "vitest";
import type { GerProject } from "@/lib/gerenciamento";
import { emailTextoDC, exigeCodigoIts, faltando, formInicial } from "@/lib/dataCenterEmail";

const projeto = (...solucoes: string[]) => ({
  company_name: "Auto Coletivo Cacador Ltda", project_code: "CACSCASUPG0008-X", city: "CAÇADOR", state: "SC", cnpj: "11.111.111/1111-11",
  fleet_size: 40, fleet_urbano: 40, fleet_seccionado: 0, reserve_fleet: 2, atlas_pay: false,
  project_solutions: solucoes.map(name => ({ solution: { name } })),
}) as unknown as GerProject;
const logo = { url: "https://exemplo/logo.png", nome: "logo.png", largura: 200, altura: 80 };

describe("e-mail ao Data Center: códigos obrigatórios", () => {
  it("o código TDMax é sempre obrigatório", () => {
    const p = projeto("Bilhetagem");
    expect(faltando(p, { ...formInicial(p), logo })).toContain("Código TDMax com 5 dígitos");
    expect(faltando(p, { ...formInicial(p), logo, codigo: "00745" })).toEqual([]);
  });

  it("sem ITS nem Gestão de frota no cadastro, só o TDMax", () => {
    const p = projeto("Bilhetagem", "Carrier");
    expect(exigeCodigoIts(p)).toBe(false);
    const f = { ...formInicial(p), logo, codigo: "00745" };
    expect(faltando(p, f)).toEqual([]);
    expect(emailTextoDC(p, f, "GP")).not.toContain("Código ITS");
  });

  it("com ITS ou Gestão de frota no cadastro, o código ITS também é obrigatório e vai no e-mail", () => {
    for (const s of ["Its (legado)", "Gestão de frota"]) {
      const p = projeto("Bilhetagem", s);
      expect(exigeCodigoIts(p)).toBe(true);
      expect(faltando(p, { ...formInicial(p), logo, codigo: "00745" })).toEqual(["Código ITS / Gestão de frota com 5 dígitos"]);
      const f = { ...formInicial(p), logo, codigo: "00745", codigoIts: "00812" };
      expect(faltando(p, f)).toEqual([]);
      expect(emailTextoDC(p, f, "GP")).toContain("Código ITS / Gestão de frota: 00812");
    }
  });

  it("formulário salvo antes do código ITS (sem o campo) ainda pede o código no projeto com ITS", () => {
    const p = projeto("Its (legado)");
    const antigo = { ...formInicial(p), logo, codigo: "00745" } as Partial<ReturnType<typeof formInicial>>;
    delete antigo.codigoIts;
    expect(faltando(p, antigo as ReturnType<typeof formInicial>)).toContain("Código ITS / Gestão de frota com 5 dígitos");
  });
});
