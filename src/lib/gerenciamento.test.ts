import { describe, expect, it } from "vitest";
import { linkExterno, modulo01Vazio, normalizarModulo01 } from "@/lib/gerenciamento";

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
