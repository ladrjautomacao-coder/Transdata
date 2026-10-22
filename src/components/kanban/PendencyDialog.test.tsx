import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import PendencyDialog, { type PendencyDialogMode } from "./PendencyDialog";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "gp-1" } }) }));

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
