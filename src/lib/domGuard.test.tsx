import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { installDomGuard } from "./domGuard";

// Texto que some/aparece ao lado de outro texto: é o que o tradutor do navegador quebra
function Frase({ mostrar }: { mostrar: boolean }) {
  return <p>{mostrar ? "Resultado da busca " : null}Meus projetos</p>;
}

/** Faz o que o tradutor do Edge/Chrome faz: troca cada texto da página por <font>texto</font>. */
function traduzir(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textos: Text[] = [];
  while (walker.nextNode()) textos.push(walker.currentNode as Text);
  for (const t of textos) {
    const font = document.createElement("font");
    t.parentNode!.replaceChild(font, t);
    font.appendChild(t);
  }
}

describe("proteção contra tradutor do navegador", () => {
  it("sem a proteção, a tela quebra com o erro visto no Edge da usuária", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container, rerender } = render(<Frase mostrar />);
    traduzir(container);
    expect(() => rerender(<Frase mostrar={false} />)).toThrow(/removeChild|not a child/i);
    spy.mockRestore();
  });

  it("com a proteção, a página traduzida continua funcionando", () => {
    installDomGuard();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, rerender } = render(<Frase mostrar />);
    traduzir(container);
    expect(() => rerender(<Frase mostrar={false} />)).not.toThrow();
    expect(container.textContent).toContain("Meus projetos");
    warn.mockRestore();
  });
});
