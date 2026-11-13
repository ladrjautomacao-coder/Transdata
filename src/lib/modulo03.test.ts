import { describe, expect, it } from "vitest";
import { bloqueio03, feito03, modulo03Vazio, normalizarModulo03, situacao03, visitasOrdenadas, type Modulo03Estado, type VisitaTecnica } from "@/lib/modulo03";

const visita = (id: string, data: string, feitaEm: string | null = null): VisitaTecnica => ({ id, tipo: "garagem", local: `Local ${id}`, data, feitaEm });
const T = "2026-11-12T10:00:00Z";

/** Tudo feito, menos o encerramento. */
const quaseTudo = (): Modulo03Estado => ({
  ...modulo03Vazio(),
  apresentacao: { data: "2026-11-12", participantes: "", slides: {}, campos: {}, logo: null, registradoEm: T, por: "GP" },
  cartoes: { chave: T, senha: T, sam: T, por: "GP" },
  cronograma: { visitas: [visita("a", "2026-11-13", T)], registradoEm: T, por: "GP" },
  regras: { regras: "Integração de 60 minutos.", particularidades: "", necessidades: "", registradoEm: T, por: "GP" },
});

describe("módulo 03: situação das atividades", () => {
  it("vazio: tudo a fazer, menos as visitas (sem cronograma) e o encerramento", () => {
    const e = modulo03Vazio();
    expect(["apresentacao", "cartoes", "cronograma", "regras"].map(a => situacao03(a as never, e))).toEqual(["afazer", "afazer", "afazer", "afazer"]);
    expect(situacao03("visitas", e)).toBe("bloqueado");
    expect(bloqueio03("visitas", e)?.pill).toBe("Aguarda o cronograma");
    expect(situacao03("encerramento", e)).toBe("bloqueado");
  });

  it("cartões: só com chave, senha e SAM", () => {
    const e = { ...modulo03Vazio(), cartoes: { chave: T, senha: T, sam: null, por: "GP" } };
    expect(feito03("cartoes", e)).toBe(false);
    expect(feito03("cartoes", { ...e, cartoes: { ...e.cartoes, sam: T } })).toBe(true);
  });

  it("visitas: liberadas com o cronograma, feitas quando todas foram feitas", () => {
    const e: Modulo03Estado = { ...modulo03Vazio(), cronograma: { visitas: [visita("a", "2026-11-13", T), visita("b", "2026-11-14")], registradoEm: T, por: "GP" } };
    expect(situacao03("visitas", e)).toBe("afazer");
    const todas = { ...e, cronograma: { ...e.cronograma, visitas: e.cronograma.visitas.map(v => ({ ...v, feitaEm: T })) } };
    expect(situacao03("visitas", todas)).toBe("feito");
  });

  it("encerramento: liberado só com as outras cinco feitas, e diz o que falta", () => {
    expect(situacao03("encerramento", quaseTudo())).toBe("afazer");
    const semRegras = { ...quaseTudo(), regras: { ...quaseTudo().regras, registradoEm: null } };
    expect(bloqueio03("encerramento", semRegras)?.texto).toContain("Falta: regras de negócio da operação.");
    const feito = { ...quaseTudo(), encerramento: { ...quaseTudo().encerramento, registradoEm: T } };
    expect(situacao03("encerramento", feito)).toBe("feito");
  });
});

describe("módulo 03: dados", () => {
  it("visitas em ordem de data, sem data por último", () => {
    const e = { ...modulo03Vazio(), cronograma: { visitas: [visita("c", ""), visita("b", "2026-11-14"), visita("a", "2026-11-13")], registradoEm: null, por: "" } };
    expect(visitasOrdenadas(e).map(v => v.id)).toEqual(["a", "b", "c"]);
  });
  it("o que veio do banco é completado com o vazio", () => {
    const e = normalizarModulo03({ cartoes: { chave: T }, cronograma: { visitas: "inválido" } });
    expect(e.cartoes).toEqual({ chave: T, senha: null, sam: null, por: "" });
    expect(e.cronograma.visitas).toEqual([]);
    expect(e.encerramento.proximos).toBe("");
    expect(normalizarModulo03(null)).toEqual(modulo03Vazio());
  });
});
