import { describe, expect, it } from "vitest";
import { alturaNoEmail, larguraNoEmail, validarLogo } from "@/lib/logoCliente";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

describe("validarLogo", () => {
  it("aceita PNG de até 2 MB", () => {
    expect(validarLogo({ name: "logo.png", type: "image/png", size: 150_000 }, PNG)).toBeNull();
  });
  it("recusa o que não é PNG, mesmo com a extensão trocada", () => {
    expect(validarLogo({ name: "logo.jpg", type: "image/jpeg", size: 150_000 }, JPG)).toMatch(/PNG/);
    expect(validarLogo({ name: "logo.png", type: "image/png", size: 150_000 }, JPG)).toMatch(/PNG/);
  });
  it("recusa arquivo acima de 2 MB", () => {
    expect(validarLogo({ name: "logo.png", type: "image/png", size: 3 * 1024 * 1024 }, PNG)).toBe("O arquivo tem 3,0 MB; o limite é 2 MB.");
  });
});

describe("tamanho do logo no e-mail", () => {
  it("logo grande fica com 240 px de largura, na proporção", () => {
    expect(larguraNoEmail({ largura: 1200 })).toBe(240);
    expect(alturaNoEmail({ largura: 1200, altura: 600 })).toBe(120);
  });
  it("logo pequeno não é ampliado", () => {
    expect(larguraNoEmail({ largura: 180 })).toBe(180);
    expect(alturaNoEmail({ largura: 180, altura: 90 })).toBe(90);
  });
});
