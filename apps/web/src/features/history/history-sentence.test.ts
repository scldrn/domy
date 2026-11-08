import { describe, expect, it } from "vitest";
import { historySentence, shownLine } from "./history-sentence";

const text = (parts: { text: string }[]) => parts.map((part) => part.text).join("");
const today = "2026-11-03";

describe("historySentence (approved «Historial»)", () => {
  it("counts a date range and the fees to review", () => {
    const parts = historySentence({
      filters: { from: "2026-11-01", to: "2026-11-03" },
      counts: { total: 38, feeReview: 3 },
      today,
    });
    expect(text(parts)).toBe("38 envíos del 1 al 3 de noviembre; 3 tienen la tarifa por revisar.");
    expect(parts.filter((part) => part.strong).map((part) => part.text)).toEqual([
      "38 envíos",
      "3 tienen la tarifa por revisar",
    ]);
    expect(parts.find((part) => part.text.startsWith("3 tienen"))?.tone).toBe("warning");
  });

  it("reads one day, open ranges, ranges across months and years", () => {
    const counts = { total: 1, feeReview: 0 };
    const read = (from?: string, to?: string) =>
      text(historySentence({ filters: { from, to }, counts, today }));
    expect(read("2026-11-03", "2026-11-03")).toBe("1 envío del 3 de noviembre.");
    expect(read("2026-10-28", "2026-11-03")).toBe("1 envío del 28 de octubre al 3 de noviembre.");
    expect(read("2025-12-28", "2026-01-03")).toBe(
      "1 envío del 28 de diciembre de 2025 al 3 de enero.",
    );
    expect(read("2026-11-01")).toBe("1 envío desde el 1 de noviembre.");
    expect(read(undefined, "2025-11-03")).toBe("1 envío hasta el 3 de noviembre de 2025.");
  });

  it("says when the search narrows the list, and when it is the fee filter", () => {
    expect(
      text(
        historySentence({
          filters: { q: "laura", status: "delivered" },
          counts: { total: 1240, feeReview: 1 },
          today,
        }),
      ),
    ).toBe("1.240 envíos coinciden con la búsqueda; 1 tiene la tarifa por revisar.");
    expect(
      text(
        historySentence({
          filters: { feeReview: "true" },
          counts: { total: 3, feeReview: 3 },
          today,
        }),
      ),
    ).toBe("3 envíos con la tarifa por revisar.");
  });

  it("reads every shipment, none at all, and none found", () => {
    expect(text(historySentence({ filters: {}, counts: { total: 52, feeReview: 0 }, today }))).toBe(
      "52 envíos registrados.",
    );
    expect(text(historySentence({ filters: {}, counts: { total: 0, feeReview: 0 }, today }))).toBe(
      "Todavía no hay envíos registrados.",
    );
    expect(
      text(historySentence({ filters: { q: "x" }, counts: { total: 0, feeReview: 0 }, today })),
    ).toBe("Ningún envío coincide con la búsqueda.");
  });
});

describe("shownLine", () => {
  it("says how many of the total are on the page", () => {
    expect(shownLine(50, 1240)).toBe("Mostrando 50 de 1.240 envíos");
    expect(shownLine(1, 1)).toBe("Mostrando 1 de 1 envío");
  });
});
