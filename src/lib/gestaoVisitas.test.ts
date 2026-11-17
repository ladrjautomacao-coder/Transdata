import { describe, expect, it } from "vitest";
import { diasAte, periodoDaVisita, resumoVisitas, situacaoVisita, visitasDoProjeto } from "./gestaoVisitas";
import type { ImplantationRequest } from "./implantationScheduling";

const tec = (id: string, full_name: string) => ({ id, full_name, email: null, area: null, active: true });
const req = (id: string, status: ImplantationRequest["status"], ini: string | null, fim: string | null, extra: Partial<ImplantationRequest> = {}): ImplantationRequest => ({
  id, project_id: "p1", requested_by: null, requester_name: null, visit_purpose: `Visita ${id}`, visit_purpose_is_custom: false,
  requested_start: ini ?? "2026-11-01T08:00:00-03:00", requested_end: fim ?? "2026-11-01T18:00:00-03:00", location: null, visit_format: "presencial",
  notes: null, status, approved_start: ini, approved_end: fim, reviewer_name: null, reviewed_at: null, rejection_reason: null,
  attendance: null, attendance_note: null, attended_by_name: null, attended_at: null, cancel_reason: null, created_at: "2026-10-01T00:00:00Z",
  project: null, members: [{ technician: tec("t1", "João Silva") }], ...extra,
});
const agora = new Date("2026-11-16T12:00:00-03:00");

describe("situacaoVisita", () => {
  const ini = new Date("2026-11-16T08:00:00-03:00"), fim = new Date("2026-11-16T18:00:00-03:00");
  it("realizada quando o fim já passou", () => expect(situacaoVisita(ini, fim, new Date("2026-11-16T18:00:01-03:00"))).toBe("realizada"));
  it("acontecendo do início ao fim (inclusive)", () => {
    expect(situacaoVisita(ini, fim, ini)).toBe("acontecendo");
    expect(situacaoVisita(ini, fim, fim)).toBe("acontecendo");
  });
  it("próxima antes do início", () => expect(situacaoVisita(ini, fim, new Date("2026-11-16T07:59:59-03:00"))).toBe("proxima"));
});

describe("visitasDoProjeto", () => {
  const lista = visitasDoProjeto([
    req("prox", "aprovada", "2026-12-01T08:00:00-03:00", "2026-12-03T18:00:00-03:00"),
    req("pend", "pendente", null, null),
    req("repr", "reprovada", null, null),
    req("canc", "cancelada", "2026-11-20T08:00:00-03:00", "2026-11-20T18:00:00-03:00"),
    req("semdata", "aprovada", null, null),
    req("agora", "aprovada", "2026-11-16T08:00:00-03:00", "2026-11-18T18:00:00-03:00"),
    // horário local (sem fuso), como o turno é lido: 09h às 12h vale em qualquer fuso de quem roda o teste
    req("feita", "aprovada", "2026-10-27T09:00:00", "2026-10-27T12:00:00", {
      visit_format: "presencial", attendance: "remoto", attended_by_name: "Carlos Eduardo", attended_at: "2026-10-27T15:00:00-03:00", attendance_note: "Cliente pediu remoto",
    }),
  ], agora);

  it("só as aprovadas com data, em ordem de data", () => expect(lista.map(v => v.id)).toEqual(["feita", "agora", "prox"]));
  it("situação de cada uma pela data", () => expect(lista.map(v => v.situacao)).toEqual(["realizada", "acontecendo", "proxima"]));
  it("o registro da coordenação vale mais que o formato pedido", () => {
    expect(lista[0].formato).toBe("remoto");
    expect(lista[0].registro).toEqual({ por: "Carlos Eduardo", em: "2026-10-27T15:00:00-03:00", nota: "Cliente pediu remoto" });
    expect(lista[1].formato).toBe("presencial");
    expect(lista[1].registro).toBeNull();
  });
  it("turno da visita remota e técnicos", () => {
    expect(lista[0].turno).toBe("Manhã, 09h às 12h");
    expect(lista[1].turno).toBeNull();
    expect(lista[2].tecnicos.map(t => t.full_name)).toEqual(["João Silva"]);
  });
  it("tipo vem do agendamento", () => expect(lista[2].tipo).toBe("Visita prox"));
});

describe("resumoVisitas", () => {
  it("conta por situação e a próxima pendente é a que está acontecendo", () => {
    const lista = visitasDoProjeto([
      req("a", "aprovada", "2026-10-01T08:00:00-03:00", "2026-10-01T18:00:00-03:00"),
      req("b", "aprovada", "2026-11-16T08:00:00-03:00", "2026-11-17T18:00:00-03:00"),
      req("c", "aprovada", "2026-12-01T08:00:00-03:00", "2026-12-01T18:00:00-03:00"),
      req("d", "aprovada", "2026-12-10T08:00:00-03:00", "2026-12-10T18:00:00-03:00"),
    ], agora);
    const r = resumoVisitas(lista);
    expect([r.realizadas, r.acontecendo, r.proximas]).toEqual([1, 1, 2]);
    expect(r.proxima?.id).toBe("b");
  });
  it("sem nada acontecendo, a próxima é a mais perto; sem pendentes, nenhuma", () => {
    expect(resumoVisitas(visitasDoProjeto([
      req("d", "aprovada", "2026-12-10T08:00:00-03:00", "2026-12-10T18:00:00-03:00"),
      req("c", "aprovada", "2026-12-01T08:00:00-03:00", "2026-12-01T18:00:00-03:00"),
    ], agora)).proxima?.id).toBe("c");
    expect(resumoVisitas([]).proxima).toBeNull();
  });
});

describe("periodoDaVisita", () => {
  // horário local (sem fuso), como é mostrado
  const p = (a: string, b: string) => periodoDaVisita(new Date(a), new Date(b));
  it("um dia só", () => expect(p("2026-10-27T09:00:00", "2026-10-27T12:30:00")).toEqual({ curto: "27/10", completo: "27/10/2026", horas: "09h às 12h30" }));
  it("vários dias no mesmo mês", () => expect(p("2026-11-03T08:00:00", "2026-11-05T18:00:00")).toEqual({ curto: "03 a 05/11", completo: "03 a 05/11/2026", horas: "08h às 18h" }));
  it("virando o mês", () => expect(p("2026-11-28T08:00:00", "2026-12-02T18:00:00").curto).toBe("28/11 a 02/12"));
});

describe("diasAte", () => {
  it("conta dias de calendário", () => {
    expect(diasAte(new Date("2026-11-17T08:00:00-03:00"), agora)).toBe(1);
    expect(diasAte(new Date("2026-12-01T08:00:00-03:00"), agora)).toBe(15);
    expect(diasAte(new Date("2026-11-16T20:00:00-03:00"), agora)).toBe(0);
  });
});
