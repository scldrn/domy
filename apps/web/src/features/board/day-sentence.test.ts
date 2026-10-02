import type { BoardShipment, ShipmentStatus } from "@domy/domain";
import { describe, expect, it } from "vitest";
import { daySentence } from "./day-sentence";

const now = new Date("2026-10-01T15:40:00Z"); // 10:40 in Bogotá

let next = 0;
function shipment(status: ShipmentStatus, extra: Partial<BoardShipment> = {}): BoardShipment {
  next++;
  return {
    id: String(next),
    trackingNumber: `T${String(next)}`,
    kind: "delivery",
    status,
    serviceDate: "2026-10-01",
    merchant: { id: "m", name: "Amy Tecnology" },
    recipientName: "Laura Gómez",
    recipientNeighborhood: null,
    rateZone: null,
    windowStart: null,
    windowEnd: null,
    codAmount: 0,
    feeNeedsReview: false,
    ...extra,
  };
}

const text = (input: Parameters<typeof daySentence>[0]) =>
  daySentence(input)
    .map((segment) => segment.text)
    .join("");

describe("daySentence", () => {
  it("tells today's count, deliveries, pending, attention, and cash in plain Spanish", () => {
    expect(
      text({
        isToday: true,
        shipments: [
          shipment("delivered", { codAmount: 50000 }),
          shipment("registered", { codAmount: 85000 }),
          shipment("dispatched", { windowEnd: "2026-10-01T16:00:00Z", codAmount: 120000 }),
          shipment("voided", { codAmount: 999000 }),
        ],
        pending: [
          shipment("registered", { serviceDate: "2026-09-30", windowEnd: "2026-09-30T17:00:00Z" }),
        ],
        now,
      }),
    ).toBe(
      "Hoy hay 3 envíos y 1 ya se entregó. Además hay 1 pendiente de días anteriores. " +
        "1 está atrasado y 1 está en riesgo de llegar tarde. Falta recaudar $ 205.000.",
    );
  });

  it("uses plurals and says when nothing needs attention", () => {
    expect(
      text({
        isToday: true,
        shipments: [shipment("delivered"), shipment("delivered")],
        pending: [],
        now,
      }),
    ).toBe("Hoy hay 2 envíos y ya se entregaron todos. Ninguno está atrasado ni en riesgo.");
    expect(text({ isToday: true, shipments: [shipment("registered")], pending: [], now })).toBe(
      "Hoy hay 1 envío y todavía no se ha entregado ninguno. Ninguno está atrasado ni en riesgo.",
    );
  });

  it("speaks of another date without saying today, and of an empty day", () => {
    expect(text({ isToday: false, shipments: [], pending: [], now })).toBe(
      "Este día no tiene envíos.",
    );
    expect(
      text({
        isToday: false,
        shipments: [shipment("delivered"), shipment("registered"), shipment("registered")],
        pending: [],
        now,
      }),
    ).toBe("Este día tiene 3 envíos y 1 ya se entregó. Ninguno está atrasado ni en riesgo.");
  });

  it("marks the late count as the one to act on", () => {
    const segments = daySentence({
      isToday: true,
      shipments: [
        shipment("registered", { windowEnd: "2026-10-01T14:00:00Z" }),
        shipment("assigned", { windowEnd: "2026-10-01T15:00:00Z" }),
      ],
      pending: [],
      now,
    });
    expect(segments).toContainEqual({ text: "2 están atrasados", strong: true, tone: "error" });
  });
});
