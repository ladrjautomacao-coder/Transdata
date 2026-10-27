import { describe, expect, it } from "vitest";
import { modulo01Vazio, type GerProject, type Modulo01Estado } from "@/lib/gerenciamento";
import { assuntoChecklist, emailHtmlChecklist, emailTextoChecklist, itensChecklist } from "@/lib/checklistEmail";

const projeto = {
  company_name: "Empresa Teste Ltda", project_code: "TUBSCASUPG0002-EMPRESATESTELTDA", city: "TUBARÃO", state: "SC",
  project_type: { name: "Alocação de equipamentos (SIGO)" }, executive: { full_name: "Romano Garcia" }, manager: { full_name: "Luiz Alves dos Reis Junior" },
} as unknown as GerProject;

const atendido = (): Modulo01Estado => {
  const e = modulo01Vazio();
  e.checklist = {
    ...e.checklist,
    itens: { contrato_transdata: true, pagamento_dzero: true, sem_pendencias: true },
    naoAplica: { contrato_sigo_locacao: true, contrato_sigo_pagamento: true, conta_sigo: true },
    vencimentoDzero: "2026-11-26", observacoes: "teste", resultado: "atendido", em: "2026-10-27T09:24:00",
  };
  return e;
};

describe("e-mail ao GP com o checklist liberado", () => {
  it("assunto diz se foi 100% atendido ou exceção", () => {
    expect(assuntoChecklist(projeto, atendido())).toBe("CHECKLIST ATENDIDO | TUBSCASUPG0002 - EMPRESA TESTE LTDA");
    const exc = atendido(); exc.checklist.resultado = "excecao"; exc.checklist.autorizadoPor = "Alexandre";
    expect(assuntoChecklist(projeto, exc)).toBe("CHECKLIST LIBERADO POR EXCEÇÃO | TUBSCASUPG0002 - EMPRESA TESTE LTDA");
    expect(emailTextoChecklist(projeto, exc, "Luiz Alves")).toContain("exceção autorizada por Alexandre");
  });
  it("lista cada pré-requisito com a situação e o vencimento do D-zero", () => {
    const itens = itensChecklist(atendido());
    expect(itens.find(i => i.texto === "Pagamento D-zero efetuado")).toMatchObject({ situacao: "ok", extra: " · vencimento 26/11/2026" });
    expect(itens.find(i => i.texto === "Abertura da Conta Sigo realizada")?.situacao).toBe("naoaplica");
  });
  it("cumprimenta o GP pelo primeiro nome e traz a cidade de atuação", () => {
    const texto = emailTextoChecklist(projeto, atendido(), "Luiz Alves");
    expect(texto.startsWith("Olá, Luiz,")).toBe(true);
    expect(texto).toContain("Cidade de atuação: TUBARÃO/SC");
    expect(texto).toContain("Observações: teste");
    expect(emailHtmlChecklist(projeto, atendido(), "Luiz Alves")).toContain("100% ATENDIDO");
  });
});
