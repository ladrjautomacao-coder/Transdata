import { describe, expect, it } from "vitest";
import {
  addMonths, monthsAndDays, remainingShort, remainingText, toneOf,
} from "../../supabase/functions/_shared/deadlineDates.ts";
import {
  renderAlertEmail, renderDigestEmail, sampleAlert, type DeadlineAlert, type EmailContext,
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
    expect(email.html).toContain("https://portal.exemplo/projetos/p1");
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

describe("resumo semanal", () => {
  it("resume implantações e contratos", () => {
    const other: DeadlineAlert = { ...contr, project_id: "p3", company_name: "Viação Exemplo Ltda", milestone: "3m", due_date: "2027-01-19" };
    const email = renderDigestEmail([contr, impl, other, { ...impl, project_id: "p4", company_name: "Transportes Demonstração Ltda", due_date: "2026-11-06" }], ctx("2026-10-19"));
    expect(email.subject).toBe("[Resumo de prazos] 2 implantações em 30 dias · 2 contratos em 12 meses");
    expect(email.html).toContain("4 projetos com prazos se aproximando");
    expect(email.html).toContain("Segunda-feira, 19 de outubro de 2026");
    // ordenado pelo prazo: Transportes (06/11) antes de Expresso (15/11)
    expect(email.html.indexOf("Transportes Demonstração")).toBeLessThan(email.html.indexOf("Expresso Modelo"));
  });
  it("sem prazos, avisa que está tudo em dia", () => {
    const email = renderDigestEmail([], ctx("2026-10-19"));
    expect(email.html).toContain("Nenhum prazo se aproximando");
    expect(email.html).toContain("Nenhuma implantação termina nos próximos 30 dias.");
  });
  it("marca o teste no assunto e no corpo", () => {
    const email = renderDigestEmail([], ctx("2026-10-19", { test: true }));
    expect(email.subject.startsWith("[Teste] ")).toBe(true);
    expect(email.html).toContain("E-mail de teste enviado pelo portal");
  });
});

describe("exemplo do teste", () => {
  it("gera prazos coerentes com o marco", () => {
    expect(sampleAlert("implantacao", "2026-10-16").due_date).toBe("2026-11-15");
    const c = sampleAlert("contrato", "2026-10-16");
    expect(c.due_date).toBe("2027-04-16");
    expect(renderAlertEmail(c, ctx("2026-10-16")).html).toContain("https://portal.exemplo/projetos/lista");
  });
});
