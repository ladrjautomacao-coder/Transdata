import { describe, expect, it } from "vitest";
import {
  datasDoCronograma, duracaoDoRoteiro, nomeDeExibicao, periodoCurto, segundosNoSlide, slideContratado, slidesDoProjeto, temBiometria,
} from "@/lib/apresentacao";

describe("apresentação da solução: datas do cronograma", () => {
  const agenda = [{ finalidade: "1ª visita · Bilhetagem", inicio: "2026-11-24T08:00:00-03:00", fim: "2026-11-26T18:00:00-03:00" }];

  it("visita aprovada na Agenda vale mais que a prevista pelo GP", () => {
    const c = datasDoCronograma({ v1Inicio: "2026-11-20", v2Inicio: "2026-12-08", v2Fim: "2026-12-10" }, agenda, null, "2026-11-12");
    expect(c.visitas[1]).toEqual({ periodo: { inicio: "2026-11-24", fim: "2026-11-26" }, confirmada: true });
    expect(c.visitas[2]).toEqual({ periodo: { inicio: "2026-12-08", fim: "2026-12-10" }, confirmada: false });
    expect(c.visitas[3]).toBeNull();
  });

  it("fim vazio ou antes do início vira um dia só", () => {
    expect(datasDoCronograma({ v2Inicio: "2026-12-08" }, [], null, "").visitas[2]?.periodo).toEqual({ inicio: "2026-12-08", fim: "2026-12-08" });
    expect(datasDoCronograma({ v2Inicio: "2026-12-08", v2Fim: "2026-12-01" }, [], null, "").visitas[2]?.periodo.fim).toBe("2026-12-08");
  });

  it("reunião de PE: a digitada, senão a do módulo 02, senão a data da apresentação", () => {
    expect(datasDoCronograma({ pe: "2026-11-10" }, [], "2026-11-12T09:00", "2026-11-13").pe).toBe("2026-11-10");
    expect(datasDoCronograma({}, [], "2026-11-12T09:00", "2026-11-13").pe).toBe("2026-11-12");
    expect(datasDoCronograma({}, [], null, "2026-11-13").pe).toBe("2026-11-13");
  });

  it("período curto no slide", () => {
    expect(periodoCurto({ inicio: "2026-11-24", fim: "2026-11-24" })).toBe("24/11");
    expect(periodoCurto({ inicio: "2026-11-24", fim: "2026-11-26" })).toBe("24 a 26/11");
    expect(periodoCurto({ inicio: "2026-11-28", fim: "2026-12-02" })).toBe("28/11 a 02/12");
  });
});

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
