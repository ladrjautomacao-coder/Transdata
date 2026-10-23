import { describe, expect, it } from "vitest";
import { holidaysByDay } from "@/lib/holidays";
import { vacationFor, type ImplantationRequest, type Technician } from "@/lib/implantationScheduling";
import {
  candidatesFor, checksFor, computeAlerts, distanceKm, fmtDayRange, fmtWeekRange, loadCityIndex, placeLabel, placeOf, techLoad,
  visitKindOf, visitOrdinal, workdaysIn,
} from "@/lib/agendaTecnica";

const tech = (id: string, full_name: string): Technician => ({ id, full_name, email: null, area: null, active: true });
const at = (d: number, m: number, h = 8) => new Date(2026, m - 1, d, h).toISOString();
let seq = 0;
function visit(company: string, city: string, state: string, purpose: string, start: string, end: string, techs: Technician[], status: "aprovada" | "pendente" = "aprovada"): ImplantationRequest {
  seq++;
  return {
    id: `r${seq}`, project_id: `p${seq}`, requested_by: null, requester_name: "GP", visit_purpose: purpose, visit_purpose_is_custom: false,
    requested_start: start, requested_end: end, location: `${city}/${state}`, notes: null, status,
    approved_start: status === "aprovada" ? start : null, approved_end: status === "aprovada" ? end : null,
    reviewer_name: null, reviewed_at: null, rejection_reason: null, attendance: null, attendance_note: null, attended_by_name: null,
    attended_at: null, cancel_reason: null, created_at: start,
    project: { id: `p${seq}`, company_name: company, project_code: null, city, state, country_code: "BR", manager: null },
    members: techs.map(t => ({ technician: t })),
  };
}

const AP = tech("ap", "Ana Prado"), MA = tech("ma", "Marcos Almeida"), FG = tech("fg", "Felipe Gomes"), LA = tech("la", "Lucas Araújo");
const holidays = holidaysByDay([2026], []);
const today = new Date(2026, 9, 15);

describe("cidade da visita", () => {
  const base = () => visit("Viação A", "Tubarão", "SC", "1ª Visita - Bilhetagem", at(20, 10), at(21, 10, 18), [AP]);
  it("presencial com endereço usa a cidade do treinamento", () => {
    const r = { ...base(), visit_format: "presencial" as const, address_street: "Rua das Flores, 120", address_district: "Centro", address_city: "Laguna", address_state: "SC" };
    expect(placeLabel(placeOf(r))).toBe("Laguna/SC");
  });
  it("remoto e solicitação antiga usam a cidade do projeto", () => {
    expect(placeLabel(placeOf({ ...base(), visit_format: "remoto" as const, meeting_url: "https://meet.google.com/x" }))).toBe("Tubarão/SC");
    expect(placeLabel(placeOf(base()))).toBe("Tubarão/SC");
  });
});

describe("tipo e número da visita", () => {
  it("reconhece o tipo pelo objetivo", () => {
    expect(visitKindOf("2ª Visita - ITS / Gestão de Frotas")).toBe("its");
    expect(visitKindOf("1ª Visita - Bilhetagem")).toBe("bilhetagem");
    expect(visitKindOf("Projeto Executivo")).toBe("executivo");
    expect(visitKindOf("Rede de Vendas")).toBe("rede_vendas");
    expect(visitKindOf("Vistoria pós-instalação")).toBe("outro");
  });
  it("extrai o número da visita", () => {
    expect(visitOrdinal("3ª Visita - Bilhetagem")).toBe("3ª");
    expect(visitOrdinal("Projeto Executivo")).toBeNull();
  });
});

describe("datas", () => {
  it("formata faixas de dias e semanas", () => {
    expect(fmtDayRange(new Date(2026, 9, 14), new Date(2026, 9, 15))).toBe("14 e 15/10");
    expect(fmtDayRange(new Date(2026, 9, 31), new Date(2026, 10, 2))).toBe("31/10 a 02/11");
    expect(fmtWeekRange(new Date(2026, 9, 26), new Date(2026, 10, 1))).toBe("26 out – 1 nov");
  });
  it("conta dias úteis sem fins de semana e feriados nacionais", () => {
    // 15/10 a 06/11/2026: 17 dias de semana, menos Finados (02/11)
    expect(workdaysIn(today, new Date(2026, 10, 6), holidays)).toHaveLength(16);
  });
});

describe("deslocamento", () => {
  it("calcula km em linha reta entre municípios", async () => {
    const idx = await loadCityIndex();
    const km = distanceKm(idx, { city: "Leme", state: "SP", country_code: "BR" }, { city: "Gramado", state: "RS", country_code: "BR" });
    expect(km).toBeGreaterThan(860);
    expect(km).toBeLessThan(885);
    expect(distanceKm(idx, { city: "São José do Rio Preto", state: "SP", country_code: "BR" }, { city: "sao jose do rio preto", state: "SP", country_code: "BR" })).toBe(0);
    expect(distanceKm(idx, { city: "Cidade Inexistente", state: "SP", country_code: "BR" }, { city: "Leme", state: "SP", country_code: "BR" })).toBeNull();
  });
});

describe("alertas e recomendação", () => {
  const list = [
    visit("Viação Montenegro", "Montenegro", "RS", "AtlasMob", at(13, 10, 11), at(14, 10, 18), [FG]),
    visit("Translocave", "Birigui", "SP", "Reciclagem", at(15, 10), at(15, 10, 18), [FG]),
    visit("Translocave", "Lucas do Rio Verde", "MT", "2ª Visita - ITS / Gestão de Frotas", at(13, 10, 11), at(16, 10, 18), [MA]),
    visit("Cachoeira do Sul", "Cachoeira do Sul", "RS", "3ª Visita - Bilhetagem", at(19, 10), at(23, 10, 18), [MA]),
    visit("J&M", "São Sebastião do Paraíso", "MG", "2ª Visita - Bilhetagem", at(26, 10), at(30, 10, 18), [MA]),
    visit("Panambiense", "Panambi", "RS", "2ª Visita - ITS / Gestão de Frotas", at(3, 11), at(6, 11, 18), [MA]),
    visit("EMPRESA TESTE", "Tubarão", "SC", "2ª Visita - Bilhetagem", at(24, 10), at(25, 10, 18), [LA]),
  ];
  const pending = visit("Expresso Itamarati", "São José do Rio Preto", "SP", "Rede de Vendas", at(5, 11), at(6, 11, 18), [], "pendente");

  it("aponta viagem sem folga, técnico sem dia livre e trabalho no fim de semana", async () => {
    const index = await loadCityIndex();
    const alerts = computeAlerts({ techs: [AP, MA, FG, LA], approved: list, from: new Date(2026, 9, 12), to: new Date(2026, 10, 8), today, holidays, custom: [], index });
    const kinds = alerts.map(a => `${a.kind}:${a.techId}`);
    expect(kinds).toContain("sem_folga:fg");
    expect(kinds).toContain("sem_dia_livre:ma");
    expect(kinds).toContain("fim_de_semana:la");
    expect(kinds.some(k => k.startsWith("conflito"))).toBe(false);
    // a sugestão de troca oferece um técnico livre no período da visita
    expect(alerts.find(a => a.kind === "sem_dia_livre")?.suggestion?.text).toMatch(/está livre de .* e pode assumir/);
  });

  it("recomenda quem está livre e com menos carga no mês", () => {
    const start = new Date(pending.requested_start), end = new Date(pending.requested_end);
    const cands = candidatesFor({ request: pending, start, end, techs: [AP, MA, FG, LA], requests: [...list, pending], holidays, index: null });
    expect(cands.find(c => c.tech.id === "ma")?.free).toBe(false);
    const rec = cands.find(c => c.recommended);
    expect(rec?.free).toBe(true);
    expect(rec?.tech.id).not.toBe("ma");
  });
});

describe("férias do técnico", () => {
  // Ana de férias de 02 a 13/11; Lucas livre
  const anaFerias: Technician = { ...AP, vacations: [{ id: "v1", start_date: "2026-11-02", end_date: "2026-11-13", note: "férias anuais" }] };
  const pending = visit("Expresso Itamarati", "São José do Rio Preto", "SP", "Rede de Vendas", at(5, 11), at(6, 11, 18), [], "pendente");

  it("técnico de férias não fica livre nem é recomendado, e a verificação explica o motivo", () => {
    const start = new Date(pending.requested_start), end = new Date(pending.requested_end);
    const cands = candidatesFor({ request: pending, start, end, techs: [anaFerias, LA], requests: [pending], holidays, index: null });
    const ana = cands.find(c => c.tech.id === "ap");
    expect(ana?.free).toBe(false);
    expect(ana?.vacation?.start_date).toBe("2026-11-02");
    expect(cands.find(c => c.recommended)?.tech.id).toBe("la");
    const checks = checksFor({ request: pending, start, end, chosen: [ana!], custom: [], index: null });
    expect(checks.find(c => c.level === "error")?.text).toBe("Ana Prado está de férias de 02/11 a 13/11.");
  });

  it("visita que termina à meia-noite do dia anterior às férias não conta como dentro delas", () => {
    expect(vacationFor(anaFerias, new Date(2026, 9, 31, 8), new Date(2026, 10, 2, 0, 0))).toBeNull();
    expect(vacationFor(anaFerias, new Date(2026, 10, 13, 8), new Date(2026, 10, 13, 18))?.id).toBe("v1");
    expect(vacationFor(anaFerias, new Date(2026, 10, 14, 8), new Date(2026, 10, 14, 18))).toBeNull();
  });

  it("visita aprovada nas férias vira alerta, e dias de férias não contam como livres", () => {
    const approved = [visit("Viação Garcia", "Londrina", "PR", "1ª Visita - Bilhetagem", at(10, 11), at(11, 11, 18), [anaFerias])];
    const alerts = computeAlerts({ techs: [anaFerias, LA], approved, from: new Date(2026, 10, 2), to: new Date(2026, 10, 15), today, holidays, custom: [], index: null });
    const ferias = alerts.find(a => a.kind === "ferias");
    expect(ferias?.techId).toBe("ap");
    expect(ferias?.text).toMatch(/cai nas férias de 02\/11 a 13\/11/);
    // 02 a 13/11: 9 dias úteis (Finados no dia 02), todos de férias
    const load = techLoad(anaFerias, approved, new Date(2026, 10, 2), new Date(2026, 10, 13), holidays, today);
    expect(load.workdays).toBe(0);
    expect(load.off).toBe(9);
    expect(load.vacation?.now).toBe(false);
  });
});
