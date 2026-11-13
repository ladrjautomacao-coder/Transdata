import { describe, expect, it } from "vitest";
import { duracaoDoRoteiro, nomeDeExibicao, segundosNoSlide, slideContratado, slidesDoProjeto, temBiometria } from "@/lib/apresentacao";

const ids = (xs: ReturnType<typeof slidesDoProjeto>, f: (s: (typeof xs)[number]) => boolean) => xs.filter(f).map(s => s.modelo.id);

describe("apresentação da solução: montagem do roteiro", () => {
  it("projeto de bilhetagem com AtlasBox: AtlasBox ligado, V6 desligado com o motivo", () => {
    const s = slidesDoProjeto(["Bilhetagem"], {}, [{ nome: "AB FULL", qtd: 30 }]);
    const ab = s.find(x => x.modelo.id === "atlasbox")!, v6 = s.find(x => x.modelo.id === "v6")!;
    expect(ab.incluido).toBe(true);
    expect(v6.incluido).toBe(false);
    expect(v6.dica).toMatch(/cadastro de equipamentos/);
    expect(v6.foraDoContrato).toBe(false);
  });

  it("sem equipamento cadastrado entram os dois validadores", () => {
    const s = slidesDoProjeto(["Bilhetagem"], {}, []);
    expect(ids(s, x => x.incluido)).toEqual(expect.arrayContaining(["atlasbox", "v6"]));
  });

  it("serviços não contratados aparecem desligados, só os slides de vitrine", () => {
    const s = slidesDoProjeto(["Bilhetagem"], {}, []);
    const fora = ids(s, x => x.foraDoContrato);
    expect(fora).toEqual(["biometria", "its", "chatbot", "bio-abertura", "bio-resultados", "bio-funciona", "bio-convite"]);
    expect(s.filter(x => x.foraDoContrato).every(x => !x.incluido)).toBe(true);
    // a implantação (requisitos, pré-requisitos, migração de BD) não aparece sem a solução
    expect(ids(s, () => true)).not.toContain("bio-requisitos");
    expect(ids(s, () => true)).not.toContain("chat-prereq-1");
    expect(ids(s, () => true)).not.toContain("mig-projeto");
  });

  it("o GP liga um serviço não contratado e ele entra no roteiro, como oportunidade", () => {
    const s = slidesDoProjeto(["Bilhetagem"], { its: true }, []);
    const its = s.find(x => x.modelo.id === "its")!;
    expect(its.incluido).toBe(true);
    expect(its.contratado).toBe(false);
    expect(slideContratado("its", ["Bilhetagem"])).toBe(false);
  });

  it("opcionais começam desligados mesmo com a solução contratada", () => {
    const s = slidesDoProjeto(["Bilhetagem", "Biometria facial"], {}, []);
    expect(ids(s, x => !x.incluido && !x.foraDoContrato)).toEqual(expect.arrayContaining(["migracao", "bio-convite"]));
  });
});

describe("apresentação da solução: dados", () => {
  it("campo das câmeras só com a biometria contratada", () => {
    expect(temBiometria(["Bilhetagem", "Biometria facial"])).toBe(true);
    expect(temBiometria(["Bilhetagem"])).toBe(false);
  });

  it("nome do cliente para o título", () => {
    expect(nomeDeExibicao("AUTO COLETIVO CACADOR LTDA")).toBe("Auto Coletivo Cacador LTDA");
    expect(nomeDeExibicao("VIACAO SAO JOAO DA BOA VISTA S.A.")).toBe("Viacao Sao Joao da Boa Vista S.A.");
    expect(nomeDeExibicao("Viação Bela Vista")).toBe("Viação Bela Vista");
  });

  it("modo automático: a velocidade muda o tempo de cada slide e a duração total", () => {
    expect(segundosNoSlide("capa", "normal")).toBe(10);
    expect(segundosNoSlide("capa", "devagar")).toBe(15);
    expect(segundosNoSlide("capa", "rapido")).toBe(6);
    const roteiro = ["capa", "atlasbox", "duvidas"] as const;
    expect(duracaoDoRoteiro([...roteiro], "normal")).toBe(10 + 25 + 15);
    expect(duracaoDoRoteiro([...roteiro], "rapido")).toBeLessThan(duracaoDoRoteiro([...roteiro], "normal"));
  });
});
