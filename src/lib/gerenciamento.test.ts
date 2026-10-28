import { describe, expect, it } from "vitest";
import { faltandoHandover, linkExterno, modulo01Vazio, normalizarModulo01, respondidasHandover } from "@/lib/gerenciamento";

describe("linkExterno", () => {
  it("aceita link completo e completa o https:// de endereço sem ele", () => {
    expect(linkExterno(" https://pedidos.transdata.com/pedido/123 ")).toBe("https://pedidos.transdata.com/pedido/123");
    expect(linkExterno("pedidos.transdata.com/pedido/123")).toBe("https://pedidos.transdata.com/pedido/123");
  });
  it("número ou texto não vira link (anotações antigas do nº do pedido)", () => {
    expect(linkExterno("2026-00123")).toBeNull();
    expect(linkExterno("pedido 123")).toBeNull();
    expect(linkExterno("")).toBeNull();
    expect(linkExterno(undefined)).toBeNull();
  });
});

describe("normalizarModulo01", () => {
  it("projeto sem nada gravado abre com o módulo vazio", () => {
    expect(normalizarModulo01(null)).toEqual(modulo01Vazio());
    expect(normalizarModulo01("lixo")).toEqual(modulo01Vazio());
  });
  it("mantém o que foi gravado e completa os campos que surgiram depois", () => {
    const gravado = {
      feitos: { pedidos: { em: "2026-10-27T10:00:00Z", por: "Luiz", valor: "2026-00123" } },
      checklist: { itens: { contrato_transdata: true }, resultado: "atendido", em: "2026-10-27T10:05:00Z" },
      handover: { agendadoPara: "2026-10-28T10:00" },
    };
    const e = normalizarModulo01(gravado);
    expect(e.feitos.pedidos?.valor).toBe("2026-00123");
    expect(e.checklist.itens.contrato_transdata).toBe(true);
    expect(e.checklist.resultado).toBe("atendido");
    expect(e.checklist.naoAplica).toEqual({});
    expect(e.checklist.observacoes).toBe("");
    expect(e.handover.agendadoPara).toBe("2026-10-28T10:00");
    expect(e.handover.registradoEm).toBeNull();
    expect(e.carrier).toEqual(modulo01Vazio().carrier);
    expect(e.datacenter).toEqual({ concluidoEm: null, email: null });
  });
});

describe("Handover: perguntas ao Executivo de Vendas", () => {
  it("só fica pronto com a data, as cinco respostas e a previsão dos equipamentos", () => {
    const h = modulo01Vazio().handover;
    expect(faltandoHandover(h)).toEqual(["data da reunião", "5 perguntas", "previsão de entrega dos equipamentos"]);
    const quase = { ...h, agendadoPara: "2026-10-28T10:00", previsaoEquipamentos: "2026-11-20",
      respostas: { prometido: "Não.", escopo: "Recarga embarcada em todos os carros.", validacao: "  ", dependencias: "Obra da garagem.", risco: "Prazo da recarga." } };
    expect(respondidasHandover(quase)).toBe(4);
    expect(faltandoHandover(quase)).toEqual(["1 pergunta"]);
    expect(faltandoHandover({ ...quase, respostas: { ...quase.respostas, validacao: "Não." } })).toEqual([]);
  });
  it("Handover gravado antes das perguntas abre sem quebrar", () => {
    const e = normalizarModulo01({ handover: { agendadoPara: "2026-10-28T10:00", registradoEm: "2026-10-27T10:00:00Z" } });
    expect(e.handover.respostas).toEqual({});
    expect(e.handover.previsaoEquipamentos).toBe("");
  });
});
