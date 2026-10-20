import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

// sem usuário logado o registro do erro não grava nada
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: () => Promise.resolve({ data: { user: null } }) }, from: () => ({ insert: () => Promise.resolve({}) }) },
}));

function Quebra({ falhar }: { falhar: boolean }) {
  if (falhar) throw new Error("falha de teste");
  return <p>tela ok</p>;
}

describe("AppErrorBoundary", () => {
  it("mostra o erro com opções de recuperar, em vez de página em branco", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<AppErrorBoundary resetKey="/a"><Quebra falhar /></AppErrorBoundary>);
    expect(screen.getByText("Esta tela encontrou um erro")).toBeTruthy();
    expect(screen.getByText("falha de teste")).toBeTruthy();
    expect(screen.getByText("Recarregar o portal")).toBeTruthy();
    spy.mockRestore();
  });

  it("ao trocar de tela, limpa o erro e mostra a nova tela", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<AppErrorBoundary resetKey="/a"><Quebra falhar /></AppErrorBoundary>);
    expect(screen.getByText("Esta tela encontrou um erro")).toBeTruthy();
    rerender(<AppErrorBoundary resetKey="/b"><Quebra falhar={false} /></AppErrorBoundary>);
    expect(screen.getByText("tela ok")).toBeTruthy();
    spy.mockRestore();
  });
});
