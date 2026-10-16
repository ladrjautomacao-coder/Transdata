import { describe, expect, it } from "vitest";
import { formatAddress, normalizeMeetingUrl } from "@/lib/implantationScheduling";

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
