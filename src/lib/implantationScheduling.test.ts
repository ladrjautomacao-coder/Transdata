import { describe, expect, it } from "vitest";
import { formatAddress, normalizeMeetingUrl, remotePeriodOf, visitFormatText } from "@/lib/implantationScheduling";

describe("normalizeMeetingUrl", () => {
  it("aceita links completos", () => {
    expect(normalizeMeetingUrl("https://meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
    expect(normalizeMeetingUrl("  https://teams.microsoft.com/l/meetup-join/19%3a?context=x  ")).toBe("https://teams.microsoft.com/l/meetup-join/19%3a?context=x");
  });
  it("completa o https quando o GP cola sem protocolo", () => {
    expect(normalizeMeetingUrl("meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
  });
  it("recusa o que não é link de reunião", () => {
    expect(normalizeMeetingUrl("")).toBeNull();
    expect(normalizeMeetingUrl("reunião amanhã")).toBeNull();
    expect(normalizeMeetingUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeMeetingUrl("ftp://arquivos.empresa.com")).toBeNull();
    expect(normalizeMeetingUrl("localhost")).toBeNull();
  });
});

describe("formatAddress", () => {
  it("monta rua, bairro e cidade/UF", () => {
    expect(formatAddress({ address_street: "Rua das Flores, 120", address_district: "Centro", address_city: "Tubarão", address_state: "SC" }))
      .toBe("Rua das Flores, 120, Centro, Tubarão/SC");
  });
  it("ignora partes vazias", () => {
    expect(formatAddress({ address_street: "Av. Brasil, 10", address_district: " ", address_city: "Lima", address_state: null }))
      .toBe("Av. Brasil, 10, Lima");
  });
});

describe("turno do treinamento remoto", () => {
  const d = (day: number, h: number) => new Date(2026, 10, day, h);
  it("reconhece manhã (09h–12h) e tarde (14h–17h), também em mais de um dia", () => {
    expect(remotePeriodOf(d(3, 9), d(3, 12))).toBe("manha");
    expect(remotePeriodOf(d(3, 14), d(5, 17))).toBe("tarde");
    expect(remotePeriodOf(d(3, 8), d(3, 18))).toBeNull();
  });
  it("monta o texto do formato", () => {
    expect(visitFormatText("remoto", d(3, 9), d(3, 12))).toBe("Remoto · Manhã, 09h às 12h");
    expect(visitFormatText("remoto", d(3, 10), d(3, 12))).toBe("Remoto");
    expect(visitFormatText("presencial", d(3, 9), d(3, 12))).toBe("Presencial");
    expect(visitFormatText(null, d(3, 9), d(3, 12))).toBeNull();
  });
});
