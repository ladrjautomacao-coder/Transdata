import { describe, expect, it } from "vitest";
import {
  aguardandoAnterior, alterarEtapa, corDaEtapa, diasAtraso, faltaParaConcluir, modulo04Vazio, normalizarModulo04, pendencias04, resumo04, situacao04,
} from "@/lib/modulo04";
import type { GerProject } from "@/lib/gerenciamento";
import { assuntoComunicacaoAp, emailTextoComunicacaoAp, faltandoComunicacaoAp } from "@/lib/entregaCartoesEmail";

const T = "2026-11-16T12:32:00Z";
const HOJE = "2026-11-18";

describe("módulo 04: histórico", () => {
  it("cada campo alterado vira uma linha (de → para), com usuário, data e hora", () => {
    const e = alterarEtapa(modulo04Vazio(), "equipamentos", { status: "despachado", transportadora: "Jadlog" }, "Luiz", T);
    expect(e.historico).toEqual([
      { em: T, por: "Luiz", etapa: "equipamentos", campo: "Situação", de: "Aguardando separação", para: "Despachado" },
      { em: T, por: "Luiz", etapa: "equipamentos", campo: "Transportadora", de: "—", para: "Jadlog" },
    ]);
    expect(e.equipamentos.statusDesde).toBe(T);
  });
  it("o histórico só cresce: alterar de novo acrescenta, nunca sobrescreve", () => {
    const e1 = alterarEtapa(modulo04Vazio(), "cartoesAp", { quantidade: "300" }, "Silvana", T);
    const e2 = alterarEtapa(e1, "cartoesAp", { quantidade: "320" }, "Silvana", "2026-11-17T10:00:00Z");
    expect(e2.historico).toHaveLength(2);
    expect(e2.historico[0]).toEqual(e1.historico[0]);
    expect(e2.historico[1]).toMatchObject({ campo: "Quantidade", de: "300", para: "320" });
  });
  it("sem mudança, nada é registrado", () => {
    const e = modulo04Vazio();
    expect(alterarEtapa(e, "apAt", { pedido: "" }, "Luiz", T)).toBe(e);
  });
  it("datas aparecem no formato brasileiro e a conclusão guarda quem e quando", () => {
    const e = alterarEtapa(modulo04Vazio(), "cartoesAp", { prevista: "2026-11-15", status: "entregue" }, "Silvana", T);
    expect(e.historico.find(h => h.campo === "Data prevista")?.para).toBe("15/11/2026");
    expect(e.cartoesAp.concluidoEm).toBe(T);
    expect(e.cartoesAp.por).toBe("Silvana");
  });
});

describe("módulo 04: prazos e sequência", () => {
  it("atraso: hoje depois da data prevista e a etapa não entregue", () => {
    const e = modulo04Vazio();
    e.cartoesAp.prevista = "2026-11-15";
    expect(diasAtraso("cartoesAp", e, HOJE)).toBe(3);
    expect(corDaEtapa("cartoesAp", e, HOJE)).toBe("vermelho");
    e.cartoesAp.status = "entregue";
    expect(diasAtraso("cartoesAp", e, HOJE)).toBe(0);
  });
  it("nos equipamentos vale a entrega prevista; sem ela, o despacho previsto", () => {
    const e = modulo04Vazio();
    e.equipamentos.despachoPrevisto = "2026-11-10";
    expect(diasAtraso("equipamentos", e, HOJE)).toBe(8);
    e.equipamentos.prevista = "2026-11-20";
    expect(diasAtraso("equipamentos", e, HOJE)).toBe(0);
  });
  it("a etapa seguinte aparece como aguardando a anterior, sem travar", () => {
    const e = modulo04Vazio();
    expect(aguardandoAnterior("apAt", e)).toBe(true);
    expect(situacao04("apAt", e)).toBe("bloqueado");
    e.apAt.status = "processamento"; // andando em paralelo
    expect(aguardandoAnterior("apAt", e)).toBe(false);
    expect(situacao04("apAt", e)).toBe("afazer");
  });
  it("situação para o progresso do projeto", () => {
    const e = modulo04Vazio();
    expect(situacao04("cartoesAp", e)).toBe("afazer");
    e.cartoesAp.status = "aguardandoEnvio";
    expect(situacao04("cartoesAp", e)).toBe("aguardando");
    e.cartoesAp.status = "entregue";
    expect(situacao04("cartoesAp", e)).toBe("feito");
    expect(situacao04("apAt", e)).toBe("aguardando"); // "Aguardando AP" é amarelo
  });
});

describe("módulo 04: conclusão, pendências e resumo", () => {
  it("as etapas críticas pedem evidência ou referência ao pedido", () => {
    const e = modulo04Vazio();
    expect(faltaParaConcluir("cartoesAp", e)).toEqual(["quantidade de cartões", "uma evidência (anexo ou a comunicação de entrega)"]);
    expect(faltaParaConcluir("apAt", e)).toEqual(["número do pedido ou uma evidência"]);
    e.apAt.pedido = "48213";
    expect(faltaParaConcluir("apAt", e)).toEqual([]);
  });
  it("pendências: atraso, pendência registrada, aguardando confirmação e falta de evidência", () => {
    const e = modulo04Vazio();
    e.cartoesAp = { ...e.cartoesAp, prevista: "2026-11-15", status: "preparacao", statusDesde: "2026-11-12T10:00:00Z" };
    e.apAt = { ...e.apAt, status: "aguardandoConfirmacao", statusDesde: "2026-11-14T10:00:00Z", pedido: "48213" };
    e.equipamentos = { ...e.equipamentos, status: "pendencia", observacoes: "Chicote faltando", statusDesde: "2026-11-16T10:00:00Z" };
    const p = pendencias04(e, HOJE);
    expect(p.map(x => [x.etapa, x.motivo])).toEqual([
      ["cartoesAp", "Prazo vencido em 15/11/2026"],
      ["cartoesAp", "Sem evidência nem número do pedido"],
      ["apAt", "Entrega aguardando confirmação"],
      ["equipamentos", "Pendência na entrega: Chicote faltando"],
      ["equipamentos", "Sem evidência nem número do pedido"],
    ]);
    expect(p[0].dias).toBe(3);
    expect(p[2].dias).toBe(4);
  });
  it("resumo: progresso, atrasadas, próxima ação e previsão de conclusão", () => {
    const e = modulo04Vazio();
    e.cartoesAp = { ...e.cartoesAp, status: "entregue" };
    e.apAt = { ...e.apAt, status: "entregue" };
    e.equipamentos = { ...e.equipamentos, status: "aguardandoDespacho", prevista: "2026-11-25", despachoPrevisto: "2026-11-20" };
    const r = resumo04(e, HOJE);
    expect(r).toMatchObject({ concluidas: 2, pendentes: 1, atrasadas: 0, pct: 67, proxima: "equipamentos", previsao: "2026-11-25", situacao: "Em andamento" });
    expect(r.proximaAcao).toBe("Acompanhar despacho dos equipamentos");
  });
  it("estado antigo ou vazio do banco ganha o formato completo", () => {
    const e = normalizarModulo04({ cartoesAp: { quantidade: "300" } });
    expect(e.cartoesAp.quantidade).toBe("300");
    expect(e.cartoesAp.status).toBe("naoiniciado");
    expect(e.historico).toEqual([]);
    expect(e.evidencias.apAt).toEqual([]);
  });
});

describe("comunicação da entrega dos cartões para AP", () => {
  const projeto = { company_name: "Auto Coletivo Cacador Ltda", project_code: "CACSCASUPG0008-X", city: "CAÇADOR", state: "SC" } as unknown as GerProject;
  it("assunto e corpo com os dados do projeto e da etapa", () => {
    const etapa = { ...modulo04Vazio().cartoesAp, quantidade: "300", prevista: "2026-11-20", observacoes: "Cartões Mifare 1K" };
    expect(assuntoComunicacaoAp(projeto)).toBe("CACSCASUPG0008 - AUTO COLETIVO CACADOR LTDA | Entrega de cartões para AP");
    const texto = emailTextoComunicacaoAp(projeto, { etapa, responsavel: "Silvana", gp: "Luiz Alves" });
    expect(texto).toContain("estão sendo encaminhados para AP");
    expect(texto).toContain("Quantidade: 300 cartões");
    expect(texto).toContain("Data: 20/11/2026");
    expect(texto).toContain("Responsável: Silvana");
    expect(texto).toContain("Observações: Cartões Mifare 1K");
  });
  it("sem quantidade ou data, a comunicação não fica pronta", () => {
    expect(faltandoComunicacaoAp({ etapa: modulo04Vazio().cartoesAp, responsavel: "Silvana", gp: "Luiz" })).toEqual(["quantidade de cartões", "data prevista ou efetiva da entrega"]);
  });
});
