import { describe, expect, it } from "vitest";
import {
  addMonths, monthsAndDays, remainingShort, remainingText, toneOf,
} from "../../supabase/functions/_shared/deadlineDates.ts";
import {
  renderAlertEmail, renderContratoDigest, renderDzeroReminder, renderImplantacaoDigest, renderPendenciesDigest, sampleAlert, sampleDzero, samplePendencies,
  type DeadlineAlert, type DzeroPending, type EmailContext,
} from "../../supabase/functions/_shared/deadlineEmail.ts";

const ctx = (today: string, extra: Partial<EmailContext> = {}): EmailContext => ({
  today, portalUrl: "https://portal.exemplo", logoUrl: "https://portal.exemplo/email/logo.png",
  recipients: ["projetos@itstransdata.com"], includesManager: false, ...extra,
});

const impl: DeadlineAlert = {
  project_id: "p1", company_name: "Expresso Modelo S.A.", project_code: "EXMSC-0034", city: "Joinville", state: "SC",
  status: "implantacao", sub_phase: null, manager_name: "Carlos Mendes", executive_name: null,
  contract_date: "2026-05-19", kind: "implantacao", milestone: "30d", deadline_days: 180, due_date: "2026-11-15", days_left: 30,
};
const contr: DeadlineAlert = {
  project_id: "p2", company_name: "Rodoviária Exemplo Ltda", project_code: "RDXPR-0021", city: "Curitiba", state: "PR",
  status: "encerrado", sub_phase: null, manager_name: "Ana Ribeiro", executive_name: "Rafael Costa",
  contract_date: "2025-04-16", kind: "contrato", milestone: "6m", deadline_days: 730, due_date: "2027-04-16", days_left: 182,
};

describe("datas dos alertas", () => {
  it("soma meses como o Postgres (fim de mês vira o último dia)", () => {
    expect(addMonths("2027-04-16", -6)).toBe("2026-10-16");
    expect(addMonths("2027-08-31", -6)).toBe("2027-02-28");
  });
  it("conta meses e dias de calendário", () => {
    expect(monthsAndDays("2026-10-16", "2027-04-16")).toEqual({ months: 6, days: 0 });
    expect(monthsAndDays("2026-10-19", "2027-04-16")).toEqual({ months: 5, days: 28 });
  });
  it("descreve quanto falta", () => {
    expect(remainingText("implantacao", "2026-10-16", "2026-11-15")).toBe("vence em 30 dias");
    expect(remainingText("implantacao", "2026-11-15", "2026-11-15")).toBe("vence hoje");
    expect(remainingText("contrato", "2026-10-16", "2027-04-16")).toBe("termina em 6 meses");
    expect(remainingText("contrato", "2026-10-19", "2027-04-16")).toBe("termina em 5 meses e 28 dias");
    expect(remainingShort("2026-10-19", "2027-01-19")).toBe("em 3 meses");
    expect(remainingShort("2026-10-19", "2026-11-06")).toBe("em 18 dias");
  });
  it("usa a cor do marco", () => {
    expect(toneOf("implantacao", "30d")).toBe("amber");
    expect(toneOf("contrato", "12m")).toBe("purple");
    expect(toneOf("contrato", "3m")).toBe("orange");
  });
});

describe("e-mail de prazo de implantação", () => {
  const email = renderAlertEmail(impl, ctx("2026-10-16"));
  it("tem assunto padronizado", () => {
    expect(email.subject).toBe("[Prazo de implantação] Expresso Modelo S.A. · vence em 30 dias (15/11/2026)");
  });
  it("mostra prazo, dia da semana e quanto já passou", () => {
    expect(email.html).toContain("15/11/2026 · domingo");
    expect(email.html).toContain("150 de 180 dias");
    expect(email.html).toContain("83%");
    // "Abrir projeto" leva ao acompanhamento; "Ver cronograma" à linha do tempo de visitas do projeto
    expect(email.html).toContain("https://portal.exemplo/comercial?projeto=p1");
    expect(email.html).toContain("https://portal.exemplo/projetos/cronograma?projeto=p1");
    expect(email.text).toContain("Finalização prevista: 15/11/2026");
  });
  it("diz para quem foi enviado", () => {
    expect(email.html).toContain("Enviado para projetos@itstransdata.com.");
  });
  it("escapa o nome do cliente", () => {
    const evil = renderAlertEmail({ ...impl, company_name: "<script>x</script>" }, ctx("2026-10-16"));
    expect(evil.html).not.toContain("<script>x</script>");
    expect(evil.html).toContain("&lt;script&gt;");
  });
});

describe("e-mail de prazo de contrato", () => {
  const email = renderAlertEmail(contr, ctx("2026-10-16"));
  it("tem assunto padronizado", () => {
    expect(email.subject).toBe("[Prazo de contrato] Rodoviária Exemplo Ltda · termina em 6 meses (16/04/2027)");
  });
  it("mostra a vigência e os três avisos", () => {
    expect(email.html).toContain("548 de 730 dias");
    expect(email.html).toContain("75%");
    expect(email.html).toContain("aviso de 16/04/2026");
    expect(email.html).toContain("este aviso · 16/10/2026");
    expect(email.html).toContain("previsto para 16/01/2027");
    expect(email.html).toContain("Rafael Costa");
  });
  it("no aviso de 3 meses diz que é o último", () => {
    const last = renderAlertEmail({ ...contr, milestone: "3m" }, ctx("2027-01-16"));
    expect(last.text).toContain("Este é o último aviso antes do fim");
  });
});

describe("resumo semanal de implantação", () => {
  const monday = ctx("2026-10-19");
  const rows: DeadlineAlert[] = [
    impl, // 15/11: em 27 dias
    { ...impl, project_id: "p4", company_name: "Transportes Demonstração Ltda", due_date: "2026-11-06" }, // em 18 dias
    { ...impl, project_id: "p5", company_name: "Viação Aurora Exemplo Ltda", due_date: "2026-10-23" }, // em 4 dias
    contr, // contrato não entra
  ];
  const email = renderImplantacaoDigest(rows, monday);
  it("tem assunto e faixas só de implantação", () => {
    expect(email.subject).toBe("[Prazo de implantação] Resumo semanal: 3 implantações terminam em até 30 dias");
    expect(email.preheader).toBe("Até 7 dias: 1 · 8 a 15 dias: 0 · 16 a 30 dias: 2 · segunda-feira, 19 de outubro de 2026");
    expect(email.html).toContain("3 implantações terminam nos próximos 30 dias");
    expect(email.html).not.toContain("Rodoviária Exemplo");
  });
  it("lista pela data de finalização", () => {
    const pos = ["Viação Aurora", "Transportes Demonstração", "Expresso Modelo"].map(s => email.html.indexOf(s));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    expect(email.html).toContain("em 4 dias");
  });
  it("sem implantações no período, diz isso", () => {
    const empty = renderImplantacaoDigest([contr], monday);
    expect(empty.html).toContain("Nenhuma implantação termina nos próximos 30 dias");
  });
});

describe("resumo semanal de contrato", () => {
  const monday = ctx("2026-10-19");
  const rows: DeadlineAlert[] = [
    contr, // 16/04/2027: faixa 3 a 6 meses
    { ...contr, project_id: "p3", company_name: "Viação Exemplo Ltda", milestone: "3m", due_date: "2027-01-19" },
    { ...contr, project_id: "p6", company_name: "Expresso Litoral Exemplo Ltda", milestone: "12m", due_date: "2027-08-30", executive_name: null },
    impl, // implantação não entra
  ];
  const email = renderContratoDigest(rows, monday);
  it("tem assunto e faixas só de contrato", () => {
    expect(email.subject).toBe("[Prazo de contrato] Resumo semanal: 3 contratos terminam em até 12 meses");
    expect(email.preheader).toBe("Até 3 meses: 1 · 3 a 6 meses: 1 · 6 a 12 meses: 1 · segunda-feira, 19 de outubro de 2026");
    expect(email.html).not.toContain("Expresso Modelo");
  });
  it("agrupa por faixa, da mais próxima para a mais distante, com GP e Executivo", () => {
    const pos = ["Terminam em até 3 meses", "Viação Exemplo", "Em 3 a 6 meses", "Rodoviária Exemplo", "Em 6 a 12 meses", "Expresso Litoral"]
      .map(s => email.html.lastIndexOf(s));
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    expect(email.html).toContain("Rafael Costa");
    expect(email.text).toContain("Executivo Rafael Costa");
  });
  it("usa o singular com um contrato só", () => {
    expect(renderContratoDigest([contr], monday).subject).toBe("[Prazo de contrato] Resumo semanal: 1 contrato termina em até 12 meses");
  });
  it("marca o teste no assunto e no corpo", () => {
    const test = renderContratoDigest([], ctx("2026-10-19", { test: true }));
    expect(test.subject.startsWith("[Teste] ")).toBe(true);
    expect(test.html).toContain("E-mail de teste enviado pelo portal");
    expect(test.html).toContain("Nenhum contrato termina nos próximos 12 meses");
  });
});

describe("lembrete de D-zero", () => {
  const pend: DzeroPending = {
    project_id: "p9", company_name: "Viação Sinal Exemplo Ltda", project_code: "VSXSC-0050", city: "Joinville", state: "SC",
    status: "comercial", sub_phase: "cobranca_dzero", manager_name: "Ana Ribeiro", executive_name: "Rafael Costa",
    registered_on: "2026-10-13", contract_date: "2026-10-13", d_zero_date: null, days_waiting: 6, reminders_sent: 2,
  };
  const email = renderDzeroReminder(pend, ctx("2026-10-19"));
  it("tem assunto amigável e padronizado", () => {
    expect(email.subject).toBe("[Lembrete D-zero] Viação Sinal Exemplo Ltda aguarda o pagamento do sinal há 6 dias");
  });
  it("explica o D-zero e mostra o número do lembrete e a etapa atual", () => {
    expect(email.html).toContain("Lembrete nº 3");
    expect(email.html).toContain("pagamento do sinal que o cliente faz à Transdata");
    expect(email.html).toContain("Cobrança D-zero emitida");
    expect(email.html).toContain("etapa atual");
    expect(email.html).toContain("https://portal.exemplo/comercial?projeto=p9");
    expect(email.text).toContain("Data D-zero: não informada");
    expect(email.text).toContain("Pagamento D-zero efetuado");
  });
  it("tem exemplo para o teste quando nenhum projeto aguarda o D-zero", () => {
    expect(renderDzeroReminder(sampleDzero("2026-10-19"), ctx("2026-10-19", { test: true })).subject)
      .toBe("[Teste] [Lembrete D-zero] Projeto de exemplo aguarda o pagamento do sinal há 6 dias");
  });
});

describe("exemplo do teste", () => {
  it("gera prazos coerentes com o marco", () => {
    expect(sampleAlert("implantacao", "2026-10-16").due_date).toBe("2026-11-15");
    const c = sampleAlert("contrato", "2026-10-16");
    expect(c.due_date).toBe("2027-04-16");
    expect(renderAlertEmail(c, ctx("2026-10-16")).html).toContain('href="https://portal.exemplo/comercial"');
  });
});

describe("resumo de implantações pendentes (cards filhos)", () => {
  const today = "2026-10-26";
  it("só entram os abertos há mais de 30 dias, do mais antigo para o mais novo", () => {
    const rows = samplePendencies(today);
    const recent = { ...rows[1], pendency_id: "s3", company_name: "Recente", days_open: 12 };
    const e = renderPendenciesDigest([recent, ...rows], ctx(today));
    expect(e.subject).toBe("[Implantação pendente] Resumo semanal: 2 soluções aguardam ativação do cliente");
    expect(e.text).not.toContain("Recente");
    expect(e.text.indexOf("Biometria facial")).toBeLessThan(e.text.indexOf("Integração com a prefeitura"));
    expect(e.html).toContain("Cliente vai ativar após a troca das câmeras.");
    expect(e.html).toContain('href="https://portal.exemplo/projetos/gestao"');
  });
  it("leva ao detalhe do projeto, onde fica a seção do card filho", () => {
    const [r] = samplePendencies(today);
    const e = renderPendenciesDigest([{ ...r, project_id: "abc" }], ctx(today));
    expect(e.html).toContain('href="https://portal.exemplo/projetos/abc"');
  });
});
