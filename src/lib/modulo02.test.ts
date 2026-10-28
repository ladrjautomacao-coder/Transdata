import { describe, expect, it } from "vitest";
import type { GerProject } from "@/lib/gerenciamento";
import {
  bloqueio02, contaCustos, diasAtePe, faltandoCustos, linhasCustos, moeda, modulo02Vazio, noitesEntre, normalizarModulo02, prazoPe, situacao02, valorBr,
  type Modulo02Estado,
} from "@/lib/modulo02";
import { emailHtmlCustos, emailHtmlFinanceiro, emailTextoCustos, emailTextoFinanceiro, periodoViagem } from "@/lib/visitaPeEmail";

const custos = (patch: Partial<Modulo02Estado["custos"]>): Modulo02Estado["custos"] => ({ ...modulo02Vazio().custos, ...patch });

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

describe("custos da visita", () => {
  it("diárias são as noites entre a ida e a volta", () => {
    expect(noitesEntre("2026-11-10", "2026-11-13")).toBe(3);
    expect(noitesEntre("2026-11-10", "2026-11-10")).toBe(0);
    expect(noitesEntre("2026-11-13", "2026-11-10")).toBe(0);
    expect(noitesEntre("", "2026-11-10")).toBe(0);
  });
  it("soma deslocamento, hospedagem (diárias × diária) e outros", () => {
    const c = custos({ ida: "2026-11-10", volta: "2026-11-13", meio: "aereo", deslocamento: "1.980,40", diaria: "320", outros: "150,00", outrosDescricao: "Táxi" });
    expect(contaCustos(c)).toMatchObject({ noites: 3, deslocamento: 1980.4, hospedagem: 960, outros: 150, total: 3090.4 });
    expect(linhasCustos(c).map(l => l.item)).toEqual(["Deslocamento", "Hospedagem", "Outros"]);
    expect(linhasCustos(c)[1].detalhe).toBe("3 diárias × R$ 320,00");
  });
  it("ida e volta no mesmo dia: sem hospedagem e sem diária obrigatória", () => {
    const c = custos({ ida: "2026-11-10", volta: "2026-11-10", meio: "carro", deslocamento: "400" });
    expect(faltandoCustos(c)).toEqual([]);
    expect(linhasCustos(c).map(l => l.item)).toEqual(["Deslocamento"]);
    expect(periodoViagem(c)).toBe("10/11/2026 (sem pernoite)");
  });
  it("diz o que falta para salvar", () => {
    expect(faltandoCustos(custos({}))).toEqual(["datas de ida e volta", "meio de deslocamento", "valor do deslocamento"]);
    expect(faltandoCustos(custos({ ida: "2026-11-13", volta: "2026-11-10", meio: "aereo", deslocamento: "100" }))).toEqual(["volta depois da ida"]);
    expect(faltandoCustos(custos({ ida: "2026-11-10", volta: "2026-11-12", meio: "aereo", deslocamento: "100" }))).toEqual(["valor da diária"]);
    expect(faltandoCustos(custos({ ida: "2026-11-10", volta: "2026-11-10", meio: "aereo", deslocamento: "100", outros: "50" }))).toEqual(["o que são os outros custos"]);
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
    const e = normalizarModulo02({ contato: { reuniaoPe: "2026-11-10T09:00", registradoEm: "2026-10-28T10:00:00Z" }, custos: { ida: "2026-11-10" } });
    expect(e.contato.reuniaoPe).toBe("2026-11-10T09:00");
    expect(e.contato.local).toBe("");
    expect(e.custos.ida).toBe("2026-11-10");
    expect(e.custos.onfly).toBe(false);
    expect(e.software).toEqual(modulo02Vazio().software);
  });
});

describe("e-mails da visita de PE", () => {
  const project = {
    id: "p1", company_name: "Viação <Teste> & Cia", project_code: "CACSCASNEW0008-VIACAO", city: "Caçador", state: "SC", country_code: "BR",
    manager: { full_name: "Luiz Alves" }, client_manager_name: "Carla Souza", operation_cities: [],
  } as unknown as GerProject;
  const e = modulo02Vazio();
  e.contato = { com: "", reuniaoPe: "2026-11-10T09:00", local: "Garagem central", registradoEm: "2026-10-28T10:00:00Z", por: "Luiz" };
  e.custos = custos({ ida: "2026-11-09", volta: "2026-11-11", meio: "aereo", deslocamento: "1.980,40", diaria: "320" });
  e.aprovacao = { para: "carla@cliente.com", enviadoEm: null, aprovadoPor: "Carla Souza", aprovadoEm: "2026-10-30", registradoEm: "2026-10-30T12:00:00Z" };
  e.reservas = { deslocamento: "LATAM XKQ7PL", hospedagem: "Hotel Central", registradoEm: "2026-10-31T09:00:00Z", por: "Luiz" };

  it("custos ao cliente: saudação ao GP no cliente, visita, custos e total", () => {
    const t = emailTextoCustos(project, e, "Luiz Alves");
    expect(t).toContain("Olá, Carla,");
    expect(t).toContain("Reunião de Projeto Executivo: 10/11/2026 às 09:00, Garagem central");
    expect(t).toContain("Período da viagem: 09/11/2026 a 11/11/2026 (2 diárias)");
    expect(t).toContain("- Hospedagem (2 diárias × R$ 320,00): R$ 640,00");
    expect(t).toContain("TOTAL: R$ 2.620,40");
  });
  it("comprovantes ao Financeiro: reservas e aprovação do cliente", () => {
    const t = emailTextoFinanceiro(project, e, "Luiz Alves");
    expect(t).toContain("Reserva do deslocamento: LATAM XKQ7PL");
    expect(t).toContain("Aprovação: Aprovados por Carla Souza em 30/10/2026");
  });
  it("o HTML escapa o que vem do cadastro", () => {
    expect(emailHtmlCustos(project, e, "Luiz")).toContain("VIAÇÃO &lt;TESTE&gt; &amp; CIA");
    expect(emailHtmlFinanceiro(project, e, "Luiz")).not.toContain("<TESTE>");
  });
});
