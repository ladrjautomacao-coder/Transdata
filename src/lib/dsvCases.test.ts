import { describe, expect, it } from "vitest";
import { dsvCountLabel, parseAzureLink, summarize } from "@/lib/dsvCases";

describe("link do caso DSV", () => {
  it("lê o nº do item no Azure DevOps (nuvem e endereço antigo)", () => {
    expect(parseAzureLink("https://dev.azure.com/transdata/Bilhetagem/_workitems/edit/48213")).toEqual({
      url: "https://dev.azure.com/transdata/Bilhetagem/_workitems/edit/48213", isAzure: true, azureId: 48213,
    });
    expect(parseAzureLink("transdata.visualstudio.com/Projeto/_workitems/edit/77/")).toMatchObject({ isAzure: true, azureId: 77 });
    expect(parseAzureLink("https://dev.azure.com/t/p/_boards/board/t/Time/Stories?workitem=901")).toMatchObject({ isAzure: true, azureId: 901 });
  });
  it("aceita outro link, mas avisa que não é do Azure", () => {
    expect(parseAzureLink("https://suporte.exemplo.com/ticket/55")).toEqual({ url: "https://suporte.exemplo.com/ticket/55", isAzure: false, azureId: null });
  });
  it("recusa texto que não é link", () => {
    expect(parseAzureLink("").url).toBeNull();
    expect(parseAzureLink("caso 123 do azure").url).toBeNull();
    expect(parseAzureLink("javascript:alert(1)").url).toBeNull();
  });
});

describe("resumo para o Kanban", () => {
  it("conta abertos e total por projeto", () => {
    const s = summarize([
      { project_id: "a", status: "aberto" }, { project_id: "a", status: "resolvido" }, { project_id: "a", status: "aberto" },
      { project_id: "b", status: "resolvido" },
    ]);
    expect(s.get("a")).toEqual({ open: 2, total: 3 });
    expect(s.get("b")).toEqual({ open: 0, total: 1 });
    expect(dsvCountLabel(s.get("a")!)).toBe("2 abertos");
    expect(dsvCountLabel({ open: 1, total: 1 })).toBe("1 aberto");
    expect(dsvCountLabel(s.get("b")!)).toBe("1 resolvido");
  });
});
