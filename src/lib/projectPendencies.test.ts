import { describe, expect, it } from "vitest";
import { childCardsLabel, countByProject, pendenciesOfProjects, pendencyAge, pendencyLabel, splitByStatus, type ProjectPendency } from "@/lib/projectPendencies";

const p = (id: string, project_id: string, status: ProjectPendency["status"] = "aberta"): ProjectPendency => ({
  id, project_id, solution_id: null, title: id, reason_kind: "decisao_cliente", reason: null, expected_date: null, status,
  created_by_name: null, created_at: "2026-09-01T12:00:00Z", resolved_at: null, resolved_by_name: null, resolution_note: null,
});

describe("cards filhos", () => {
  it("faixa de idade: até 30 dias, até 60 e acima de 60", () => {
    const now = new Date(2026, 9, 21, 15);
    expect(pendencyAge(new Date(2026, 9, 1, 9).toISOString(), now)).toEqual({ days: 20, level: "ok" });
    expect(pendencyAge(new Date(2026, 8, 6, 9).toISOString(), now)).toEqual({ days: 45, level: "warn" });
    expect(pendencyAge(new Date(2026, 7, 1, 9).toISOString(), now)).toEqual({ days: 81, level: "late" });
  });
  it("conta só os abertos por projeto (selo no card pai)", () => {
    const m = countByProject([p("a", "x"), p("b", "x"), p("c", "y", "implantada"), p("d", "z")]);
    expect(m.get("x")).toBe(2);
    expect(m.get("y")).toBeUndefined();
    expect(pendencyLabel(1)).toBe("1 pendência");
    expect(pendencyLabel(2)).toBe("2 pendências");
  });
  it("segue os filtros do quadro pelo projeto pai", () => {
    expect(pendenciesOfProjects([p("a", "x"), p("b", "y")], new Set(["y"])).map(x => x.id)).toEqual(["b"]);
  });
  it("concluídos vão para Implementado ou Cancelado, do mais recente para o mais antigo", () => {
    const done1 = { ...p("d1", "x", "implantada"), resolved_at: "2026-10-01T10:00:00Z" };
    const done2 = { ...p("d2", "y", "implantada"), resolved_at: "2026-10-20T10:00:00Z" };
    const s = splitByStatus([p("a", "x"), done1, p("c", "z", "cancelada"), done2]);
    expect(s.open.map(x => x.id)).toEqual(["a"]);
    expect(s.done.map(x => x.id)).toEqual(["d2", "d1"]);
    expect(s.cancelled.map(x => x.id)).toEqual(["c"]);
    expect(childCardsLabel(1)).toBe("+1 card filho");
    expect(childCardsLabel(3)).toBe("+3 cards filhos");
  });
});
