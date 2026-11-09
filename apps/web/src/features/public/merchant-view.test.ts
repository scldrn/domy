import type { MerchantDay } from "@domy/domain";
import { describe, expect, it } from "vitest";
import { merchantDaySentence } from "./merchant-view";

const byStatus = (values: Partial<MerchantDay["totals"]["byStatus"]>) => ({
  registered: 0,
  assigned: 0,
  dispatched: 0,
  picked_up: 0,
  delivered: 0,
  exception: 0,
  returned: 0,
  voided: 0,
  ...values,
});
const day = (
  count: number,
  values: Partial<MerchantDay["totals"]["byStatus"]>,
  date = "2026-10-01",
) =>
  ({
    date,
    shipments: Array.from({ length: count }),
    totals: { byStatus: byStatus(values) },
  }) as unknown as MerchantDay;
const text = (parts: ReturnType<typeof merchantDaySentence>) =>
  parts.map((part) => (part.strong ? `*${part.text}*` : part.text)).join("");

describe("Enlace del cliente (approved in feature 006, US4)", () => {
  it("tells the day's shipments by state, delivered first", () => {
    expect(
      text(
        merchantDaySentence(
          day(5, { delivered: 2, dispatched: 1, exception: 1, registered: 1 }),
          "2026-10-01",
        ),
      ),
    ).toBe(
      "*5 envíos* hoy, jueves 1 de octubre: *2 entregados*, 1 en ruta, 1 con novedad y 1 registrado.",
    );
    expect(text(merchantDaySentence(day(1, { delivered: 1 }, "2026-09-30"), "2026-10-01"))).toBe(
      "*1 envío* el miércoles 30 de septiembre: *1 entregado*.",
    );
    expect(text(merchantDaySentence(day(0, {}), "2026-10-01"))).toBe(
      "Sin envíos hoy, jueves 1 de octubre.",
    );
  });
});
