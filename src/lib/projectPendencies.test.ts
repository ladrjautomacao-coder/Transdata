import { describe, expect, it } from "vitest";
import { countByProject, pendenciesOfProjects, pendencyAge, pendencyLabel, type ProjectPendency } from "@/lib/projectPendencies";

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
});
