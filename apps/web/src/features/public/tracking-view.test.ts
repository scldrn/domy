import { describe, expect, it } from "vitest";
import { formatTime } from "@/lib/format";
import { arrivalDay, arrivalWindow, queueText } from "./tracking-view";

describe("Seguimiento (approved in feature 006, US4)", () => {
  it("says when the shipment arrives", () => {
    expect(arrivalDay("delivery", "2026-10-01", "2026-10-01")).toBe(
      "Llega hoy, jueves 1 de octubre",
    );
    expect(arrivalDay("delivery", "2026-10-02", "2026-10-01")).toBe(
      "Llega mañana, viernes 2 de octubre",
    );
    expect(arrivalDay("errand", "2026-10-05", "2026-10-01")).toBe(
      "Programado para el lunes 5 de octubre",
    );
  });

  it("reads the window as a sentence", () => {
    const start = "2026-10-01T19:00:00.000Z";
    const end = "2026-10-01T22:00:00.000Z";
    expect(arrivalWindow({ start, end })).toBe(`Entre ${formatTime(start)} y ${formatTime(end)}`);
    expect(arrivalWindow({ start: null, end })).toBe(`Antes de las ${formatTime(end)}`);
    expect(arrivalWindow({ start, end: null })).toBe(`Después de las ${formatTime(start)}`);
  });

  it("counts the deliveries before yours", () => {
    expect(queueText(0)).toBe("Eres la siguiente entrega");
    expect(queueText(1)).toBe("1 entrega antes de la tuya");
    expect(queueText(2)).toBe("2 entregas antes de la tuya");
  });
});
