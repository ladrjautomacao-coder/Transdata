import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import DsvCaseForm from "./DsvCaseForm";
import type { DsvCase } from "@/lib/dsvCases";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "gp-1" } }) }));
const api = vi.hoisted(() => ({ createDsvCase: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/dsvCases", async orig => ({ ...(await orig<typeof import("@/lib/dsvCases")>()), ...api }));

const existing = [{ id: "c1", url: "https://dev.azure.com/t/p/_workitems/edit/111", azure_id: 111, status: "aberto" } as DsvCase];
const link = () => screen.getByLabelText(/Link do caso no Azure/) as HTMLInputElement;

describe("registrar caso DSV", () => {
  beforeEach(() => api.createDsvCase.mockClear());

  it("pede link, tipo e título antes de registrar", () => {
    render(<DsvCaseForm projectId="p1" existing={[]} onCreated={() => {}} />);
    fireEvent.click(screen.getByText("Registrar caso"));
    expect(screen.getByText("Cole o link do caso no Azure.")).toBeTruthy();
    expect(screen.getByText(/Escolha se o caso é de suporte/)).toBeTruthy();
    expect(screen.getByText("Dê um título curto para o caso.")).toBeTruthy();
    expect(api.createDsvCase).not.toHaveBeenCalled();
  });

  it("mostra o nº do Azure e avisa quando o link não é do Azure", () => {
    render(<DsvCaseForm projectId="p1" existing={[]} onCreated={() => {}} />);
    fireEvent.change(link(), { target: { value: "https://dev.azure.com/t/p/_workitems/edit/4821" } });
    expect(screen.getByText("Caso #4821 do Azure DevOps.")).toBeTruthy();
    fireEvent.change(link(), { target: { value: "https://outro.site/ticket/9" } });
    expect(screen.getByText(/não parece do Azure DevOps/)).toBeTruthy();
  });

  it("não deixa registrar o mesmo caso duas vezes no projeto", () => {
    render(<DsvCaseForm projectId="p1" existing={existing} onCreated={() => {}} />);
    fireEvent.change(link(), { target: { value: "dev.azure.com/t/p/_workitems/edit/111" } });
    fireEvent.click(screen.getByRole("radio", { name: /Suporte técnico/ }));
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "Repetido" } });
    fireEvent.click(screen.getByText("Registrar caso"));
    expect(screen.getByText("Este caso já está registrado neste projeto.")).toBeTruthy();
    expect(api.createDsvCase).not.toHaveBeenCalled();
  });

  it("registra com o nº tirado do link", async () => {
    const onCreated = vi.fn();
    render(<DsvCaseForm projectId="p1" existing={existing} onCreated={onCreated} />);
    fireEvent.change(link(), { target: { value: "https://dev.azure.com/t/p/_workitems/edit/222" } });
    fireEvent.click(screen.getByRole("radio", { name: /Desenvolvimento/ }));
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "  Ajuste no relatório  " } });
    await act(async () => { fireEvent.click(screen.getByText("Registrar caso")); });
    expect(api.createDsvCase).toHaveBeenCalledWith({
      project_id: "p1", url: "https://dev.azure.com/t/p/_workitems/edit/222", azure_id: 222, kind: "desenvolvimento", title: "Ajuste no relatório",
    });
    expect(onCreated).toHaveBeenCalled();
  });
});
