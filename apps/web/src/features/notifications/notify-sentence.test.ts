import { describe, expect, it } from "vitest";
import { notifySentence } from "./notify-sentence";

const text = (parts: { text: string }[]) => parts.map((part) => part.text).join("");
const date = "2026-11-03";

describe("notifySentence (approved «Notificar clientes»)", () => {
  it("counts the merchants and shipments still to notify, and those up to date", () => {
    const parts = notifySentence({
      date,
      today: date,
      merchants: [
        { pending: 6, upToDate: false },
        { pending: 4, upToDate: false },
        { pending: 3, upToDate: false },
        { pending: 2, upToDate: false },
        { pending: 0, upToDate: true },
      ],
    });
    expect(text(parts)).toBe(
      "Martes 3 de noviembre: 4 clientes tienen 15 envíos sin notificar; 1 cliente ya está al día.",
    );
    expect(parts.filter((part) => part.strong).map((part) => part.text)).toEqual([
      "4 clientes",
      "15 envíos",
    ]);
  });

  it("reads one merchant and none up to date", () => {
    expect(
      text(notifySentence({ date, today: date, merchants: [{ pending: 1, upToDate: false }] })),
    ).toBe("Martes 3 de noviembre: 1 cliente tiene 1 envío sin notificar.");
  });

  it("reads a day already notified and a day without shipments", () => {
    expect(
      text(
        notifySentence({
          date,
          today: date,
          merchants: [
            { pending: 0, upToDate: true },
            { pending: 0, upToDate: true },
          ],
        }),
      ),
    ).toBe("Martes 3 de noviembre: todos los clientes ya recibieron sus enlaces.");
    expect(text(notifySentence({ date: "2026-11-02", today: date, merchants: [] }))).toBe(
      "Lunes 2 de noviembre: ningún envío por notificar.",
    );
  });
});
