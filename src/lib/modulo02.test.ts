import { describe, expect, it } from "vitest";
import type { GerProject } from "@/lib/gerenciamento";
import {
  bloqueio02, diasAtePe, moeda, modulo02Vazio, normalizarModulo02, prazoPe, situacao02, valorBr,
} from "@/lib/modulo02";
import { emailHtmlCustos, emailHtmlFinanceiro, emailTextoCustos, emailTextoFinanceiro } from "@/lib/visitaPeEmail";

describe("valorBr", () => {
  it("lê o valor como o GP digita", () => {
    expect(valorBr("1.250,50")).toBe(1250.5);
    expect(valorBr("1250,5")).toBe(1250.5);
    expect(valorBr("1250.50")).toBe(1250.5);
    expect(valorBr("1.500")).toBe(1500);
    expect(valorBr("R$ 980")).toBe(980);
  });
  it("vazio ou texto não é valor", () => {
    expect(valorBr("")).toBeNull();
    expect(valorBr(undefined)).toBeNull();
    expect(valorBr("abc")).toBeNull();
    expect(valorBr("1,2,3")).toBeNull();
  });
});

describe("moeda", () => {
  it("formata em reais com espaço comum", () => {
    expect(moeda(1250.5)).toBe("R$ 1.250,50");
  });
});

describe("reunião de PE", () => {
  it("conta os dias até a reunião", () => {
    const hoje = new Date(2026, 9, 28, 15, 0);
    expect(diasAtePe("2026-11-10T09:00", hoje)).toBe(13);
    expect(diasAtePe("2026-10-28T08:00", hoje)).toBe(0);
    expect(diasAtePe("", hoje)).toBeNull();
    expect([0, 1, -1, 13, -3].map(prazoPe)).toEqual(["hoje", "amanhã", "ontem", "em 13 dias", "há 3 dias"]);
  });
});

describe("situação das atividades", () => {
  it("as etapas da viagem esperam os custos e a aprovação do cliente", () => {
    const e = modulo02Vazio();
    expect(situacao02("contato", e)).toBe("afazer");
    expect(situacao02("aprovacao", e)).toBe("bloqueado");
    expect(bloqueio02("aprovacao", e)?.pill).toBe("Aguarda os custos");
    e.custos.registradoEm = "2026-10-28T10:00:00Z";
    expect(situacao02("aprovacao", e)).toBe("afazer");
    e.aprovacao.enviadoEm = "2026-10-28T10:05:00Z";
    expect(situacao02("aprovacao", e)).toBe("aguardando");
    expect(situacao02("reservas", e)).toBe("bloqueado");
    expect(bloqueio02("financeiro", e)?.pill).toBe("Aguarda a aprovação");
    e.aprovacao.registradoEm = "2026-10-29T09:00:00Z";
    expect(situacao02("aprovacao", e)).toBe("feito");
    expect(situacao02("reservas", e)).toBe("afazer");
    expect(bloqueio02("financeiro", e)?.pill).toBe("Aguarda as reservas");
    e.reservas.registradoEm = "2026-10-29T10:00:00Z";
    expect(situacao02("financeiro", e)).toBe("afazer");
  });
  it("adiantamento não necessário sai da conta; o termo espera os cartões", () => {
    const e = modulo02Vazio();
    e.aprovacao.registradoEm = "2026-10-29T09:00:00Z";
    e.adiantamento = { necessario: false, valor: "", registradoEm: "2026-10-29T11:00:00Z", por: "Luiz" };
    expect(situacao02("adiantamento", e)).toBe("naoaplica");
    e.adiantamento.necessario = true;
    expect(situacao02("adiantamento", e)).toBe("feito");
    expect(situacao02("termo", e)).toBe("bloqueado");
    e.cartoes.registradoEm = "2026-10-30T09:00:00Z";
    expect(situacao02("termo", e)).toBe("afazer");
  });
  it("software só fica feito com os dois conferidos", () => {
    const e = modulo02Vazio();
    e.software.saminit = "2026-10-30T09:00:00Z";
    expect(situacao02("software", e)).toBe("afazer");
    e.software.sasm = "2026-10-30T09:05:00Z";
    expect(situacao02("software", e)).toBe("feito");
  });
});

describe("normalizarModulo02", () => {
  it("projeto sem nada gravado abre com o módulo vazio", () => {
    expect(normalizarModulo02(null)).toEqual(modulo02Vazio());
    expect(normalizarModulo02("lixo")).toEqual(modulo02Vazio());
  });
  it("mantém o que foi gravado e completa os campos que surgiram depois", () => {
    const e = normalizarModulo02({ contato: { reuniaoPe: "2026-11-10T09:00", registradoEm: "2026-10-28T10:00:00Z" }, custos: { registradoEm: "2026-10-28T11:00:00Z" } });
    expect(e.contato.reuniaoPe).toBe("2026-11-10T09:00");
    expect(e.contato.local).toBe("");
    expect(e.custos.registradoEm).toBe("2026-10-28T11:00:00Z");
    expect(e.custos.por).toBe("");
    expect(e.software).toEqual(modulo02Vazio().software);
  });
});

describe("e-mails da visita de PE", () => {
  const project = {
    id: "p1", company_name: "Viação <Teste> & Cia", project_code: "CACSCASNEW0008-VIACAO", city: "Caçador", state: "SC", country_code: "BR",
    manager: { full_name: "Luiz Alves" }, executive: { full_name: "Marina Prado" }, client_manager_name: "Carla Souza", operation_cities: [],
    cnpj: "11.111.111/0001-11", fleet_size: 40, contract_date: "2026-09-15", contractual_deadline_days: 365, d_zero_date: "2026-12-01",
    project_type: { name: "Implantação" }, project_segment: null, project_solutions: [{ solution: { name: "Bilhetagem" } }, { solution: { name: "ITS" } }],
  } as unknown as GerProject;
  const e = modulo02Vazio();
  e.contato = { com: "", reuniaoPe: "2026-11-10T09:00", local: "Garagem central", registradoEm: "2026-10-28T10:00:00Z", por: "Luiz" };
  e.custos = { registradoEm: "2026-10-29T09:00:00Z", por: "Luiz" };
  e.aprovacao = { para: "carla@cliente.com", enviadoEm: null, aprovadoPor: "Carla Souza", aprovadoEm: "2026-10-30", registradoEm: "2026-10-30T12:00:00Z" };
  e.reservas = { deslocamento: "LATAM XKQ7PL", hospedagem: "Hotel Central", registradoEm: "2026-10-31T09:00:00Z", por: "Luiz" };

  it("custos ao cliente: saudação ao contato digitado (sem nome do cadastro), visita e a simulação da Onfly em anexo", () => {
    const t = emailTextoCustos(project, e, "Luiz Alves");
    expect(t.startsWith("Olá,\n")).toBe(true);
    expect(t).not.toContain("Carla");
    expect(emailTextoCustos(project, { ...e, contato: { ...e.contato, com: "Carla Souza" } }, "Luiz Alves")).toContain("Olá, Carla,");
    expect(t).toContain("seguem em anexo os custos estimados");
    expect(t).toContain("Reunião de Projeto Executivo: 10/11/2026 às 09:00, Garagem central");
    expect(t).not.toContain("TOTAL");
  });
  const comprovantes = [{ tipo: "Passagem aérea", descricao: "LATAM ida e volta", arquivo: "latam.jpg" }, { tipo: "Hospedagem", descricao: "", arquivo: "hotel.png" }];
  it("comprovantes ao Financeiro: dados do cadastro, da visita e os comprovantes no PDF", () => {
    const t = emailTextoFinanceiro(project, e, "Luiz Alves", comprovantes);
    expect(t).toContain("2 comprovantes no PDF Comprovantes-Visita-PE-CACSCASNEW0008.pdf");
    expect(t).toContain("CNPJ: 11.111.111/0001-11");
    expect(t).toContain("Soluções contratadas: Bilhetagem, ITS");
    expect(t).toContain("Fim do contrato: 15/09/2027");
    expect(t).toContain("Reserva do deslocamento: LATAM XKQ7PL");
    expect(t).toContain("Aprovação dos custos: Aprovados por Carla Souza em 30/10/2026");
    expect(t).toContain("1. Passagem aérea: LATAM ida e volta · página 2 do PDF");
    expect(t).toContain("2. Hospedagem: página 3 do PDF");
    // o adiantamento só entra depois de registrado
    expect(t).not.toContain("Adiantamento");
  });
  it("o HTML escapa o que vem do cadastro", () => {
    expect(emailHtmlCustos(project, e, "Luiz")).toContain("VIAÇÃO &lt;TESTE&gt; &amp; CIA");
    expect(emailHtmlFinanceiro(project, e, "Luiz", comprovantes)).not.toContain("<TESTE>");
  });
});
