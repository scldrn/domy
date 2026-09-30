import { describe, expect, it } from "vitest";
import { normalizeText } from "./text-normalization.ts";

describe("normalizeText", () => {
  it("lowercases, removes accents, and trims", () => {
    expect(normalizeText("Copàcabana ")).toBe("copacabana");
  });

  it("keeps words separated by single spaces", () => {
    expect(normalizeText("Terminal del Norte")).toBe("terminal del norte");
    expect(normalizeText("  San   Antonio\tde  Prado ")).toBe("san antonio de prado");
  });

  it("removes punctuation", () => {
    expect(normalizeText("Bello–Itagüí, (sur).")).toBe("bello itagui sur");
    expect(normalizeText("Calle 10 # 43-12")).toBe("calle 10 43 12");
  });

  it("handles ñ and uppercase accents", () => {
    expect(normalizeText("MUÑOZ ÁLVAREZ")).toBe("munoz alvarez");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeText("  ¿? ")).toBe("");
  });
});
