import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import PendencyDialog, { type PendencyDialogMode } from "./PendencyDialog";
import type { ProjectPendency } from "@/lib/projectPendencies";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "gp-1" } }) }));
const api = vi.hoisted(() => ({ createPendency: vi.fn(() => Promise.resolve()), deletePendency: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/projectPendencies", async orig => ({ ...(await orig<typeof import("@/lib/projectPendencies")>()), ...api }));

const mode = (id = "p1"): PendencyDialogMode => ({
  kind: "criar",
  project: { id, company_name: "ATV - Associação de Transporte Vino", status: "implantacao", solutions: [{ id: "s-bio", name: "Biometria facial" }] },
  openTitles: [],
});
const open = (m: PendencyDialogMode | null) => render(<PendencyDialog mode={m} onOpenChange={() => {}} onDone={() => {}} />);
const detail = () => screen.getByPlaceholderText(/Detalhe \(opcional\)/) as HTMLTextAreaElement;

describe("card filho: rascunho", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("o GP fecha a janela para buscar uma informação e, ao voltar, o que preencheu continua lá", () => {
    const first = open(mode());
    fireEvent.click(screen.getByRole("radio", { name: /Biometria facial/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Decisão do cliente/ }));
    fireEvent.change(detail(), { target: { value: "Cliente vai licitar as câmeras em 2027." } });
    act(() => { vi.advanceTimersByTime(500); });
    first.unmount();

    open(mode());
    expect(screen.getByRole("radio", { name: /Biometria facial/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Decisão do cliente/ }).getAttribute("aria-checked")).toBe("true");
    expect(detail().value).toBe("Cliente vai licitar as câmeras em 2027.");
    expect(screen.getByText(/Rascunho recuperado de/)).toBeTruthy();
  });

  it("o rascunho é de cada projeto e some ao descartar", () => {
    const first = open(mode("p1"));
    fireEvent.change(detail(), { target: { value: "Rascunho do projeto 1" } });
    act(() => { vi.advanceTimersByTime(500); });
    first.unmount();

    const other = open(mode("p2"));
    expect(detail().value).toBe("");
    other.unmount();

    open(mode("p1"));
    fireEvent.click(screen.getByText("Descartar"));
    expect(detail().value).toBe("");
    act(() => { vi.advanceTimersByTime(500); });
    expect(Object.keys(localStorage).filter(k => k.startsWith("transdata:card-filho"))).toEqual([]);
  });
});

describe("card filho: confirmar antes de criar e excluir", () => {
  beforeEach(() => { localStorage.clear(); api.createPendency.mockClear(); api.deletePendency.mockClear(); });

  it("mostra a revisão e só grava depois de o GP confirmar", async () => {
    open(mode());
    fireEvent.click(screen.getByRole("radio", { name: /Biometria facial/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Decisão do cliente/ }));
    fireEvent.click(screen.getByText("Revisar e criar"));
    expect(screen.getByText("Confira antes de criar")).toBeTruthy();
    expect(api.createPendency).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Voltar e corrigir"));
    expect(screen.getByRole("radio", { name: /Biometria facial/ }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByText("Revisar e criar"));
    await act(async () => { fireEvent.click(screen.getByText("Confirmar e criar")); });
    expect(api.createPendency).toHaveBeenCalledWith(expect.objectContaining({ project_id: "p1", title: "Biometria facial", reason_kind: "decisao_cliente" }));
  });

  it("exclui o card filho aberto por engano depois de confirmar", async () => {
    const pendency = { id: "x1", title: "Biometria facial", status: "aberta" } as ProjectPendency;
    open({ kind: "excluir", pendency, projectName: "ATV" });
    expect(screen.getByText(/aberto por engano/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Excluir card filho/ })); });
    expect(api.deletePendency).toHaveBeenCalledWith("x1");
  });
});
