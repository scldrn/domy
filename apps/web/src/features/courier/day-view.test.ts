import { formatCop as cop, type DaySummary } from "@domy/domain";
import { describe, expect, it } from "vitest";
import { cashExplanation, daySentence } from "./day-view";

const day = (values: Partial<DaySummary>): DaySummary => ({
  date: "2026-11-08",
  deliveries: 0,
  exceptions: 0,
  returns: 0,
  pendingStops: 0,
  cash: 0,
  companyTransfer: 0,
  merchantTransfer: 0,
  disbursements: 0,
  cashToHandOver: 0,
  ...values,
});
const formatCop = (amount: number) => cop(amount).replace(" ", "\u00a0");
const text = (summary: DaySummary) =>
  daySentence(summary)
    .map((part) => (part.strong ? `*${part.text}*` : part.text))
    .join("");

describe("Mi día (approved app del mensajero)", () => {
  it("says what was done and what is left, figures in bold", () => {
    expect(text(day({ deliveries: 3, exceptions: 1, pendingStops: 5 }))).toBe(
      "Llevas *3 entregas* y *1 novedad*. Te quedan *5 paradas* en la ruta.",
    );
    expect(text(day({ deliveries: 1, exceptions: 2, returns: 1, pendingStops: 1 }))).toBe(
      "Llevas *1 entrega*, *2 novedades* y *1 devolución*. Te queda *1 parada* en la ruta.",
    );
    expect(text(day({}))).toBe("Aún no registras entregas hoy. No te quedan paradas pendientes.");
    expect(text(day({ exceptions: 1 }))).toBe(
      "Llevas *1 novedad*. No te quedan paradas pendientes.",
    );
  });

  it("explains the cash to hand over", () => {
    expect(cashExplanation(day({}))).toBeNull();
    expect(cashExplanation(day({ cash: 100_000, cashToHandOver: 100_000 }))).toBe(
      `${formatCop(100_000)} recibidos en efectivo.`,
    );
    expect(
      cashExplanation(day({ cash: 140_000, disbursements: 12_000, cashToHandOver: 128_000 })),
    ).toBe(
      `${formatCop(140_000)} recibidos en efectivo, menos ${formatCop(12_000)} que pagaste por cuenta del cliente.`,
    );
    expect(cashExplanation(day({ cash: 0, disbursements: 12_000, cashToHandOver: -12_000 }))).toBe(
      `Pagaste ${formatCop(12_000)} por cuenta del cliente y recibiste ${formatCop(0)} en efectivo: la empresa te debe ${formatCop(12_000)}.`,
    );
  });
});
