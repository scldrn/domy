import type { RouteEvent, ShipmentEvent } from "@domy/domain";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { renderToStaticMarkup as renderBare } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { custodyChange, RouteHistory } from "./route-history";

const john = { id: "u1", name: "John Coordinador" };
const ana = { id: "c1", name: "Ana Ruiz" };
const beto = { id: "c2", name: "Beto Gómez" };

const routeEvent = (extra: Partial<RouteEvent>): RouteEvent => ({
  id: crypto.randomUUID(),
  type: "created",
  actor: john,
  occurredAt: "2026-10-01T15:00:00.000Z",
  shipment: null,
  fromCourier: null,
  toCourier: null,
  reason: null,
  changes: null,
  onBehalf: false,
  ...extra,
});

const shipmentEvent = (extra: Partial<ShipmentEvent>): ShipmentEvent => ({
  id: crypto.randomUUID(),
  type: "status_changed",
  fromStatus: null,
  toStatus: null,
  actor: john,
  occurredAt: "2026-10-01T15:00:00.000Z",
  recordedAt: "2026-10-01T15:00:00.000Z",
  reason: null,
  changes: null,
  onBehalf: false,
  ...extra,
});

/** Links need a router; a bare one in memory is enough to build their addresses. */
const router = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory(),
});
const renderToStaticMarkup = (node: ReactNode) =>
  renderBare(<RouterContextProvider router={router}>{node}</RouterContextProvider>);

/** The text a person reads, without markup. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("RouteHistory (FR-019, FR-022)", () => {
  it("names a restored task's reversion, with its reason and dispatcher (T123, FR-039)", () => {
    const read = text(
      renderToStaticMarkup(
        <RouteHistory
          events={[
            routeEvent({
              type: "record_reverted",
              reason: "Registro equivocado",
              shipment: { id: "s1", trackingNumber: "7SMQ5M5T" },
            }),
          ]}
        />,
      ),
    );
    expect(read).toContain("Registro revertido · 7SMQ-5M5T");
    expect(read).toContain("John Coordinador");
    expect(read).toContain("Registro equivocado");
  });
  it("names each action with its author, time, couriers, shipment, and reason", () => {
    const html = renderToStaticMarkup(
      <RouteHistory
        events={[
          routeEvent({ type: "created" }),
          routeEvent({
            type: "reassigned",
            shipment: { id: "s1", trackingNumber: "7SMQ5M5T" },
            fromCourier: ana,
            toCourier: beto,
            reason: "La moto de Ana se varó",
          }),
          routeEvent({ type: "courier_set", toCourier: null }),
        ]}
      />,
    );
    expect(text(html)).toContain("Ruta creada John Coordinador · 1 oct 2026");
    expect(text(html)).toContain("Reasignación · 7SMQ-5M5T");
    // The tracking number reads like a label and leads to the shipment (design-system.md §8).
    const link = /<a [^>]+>7SMQ-5M5T<\/a>/.exec(html)?.[0] ?? "";
    expect(link).toContain('href="/envios/7SMQ5M5T"');
    expect(link).toMatch(/class="[^"]*\bguia\b/);
    expect(text(html)).toContain("Ana Ruiz → Beto Gómez La moto de Ana se varó");
    expect(html).toContain('aria-labelledby="');
  });

  it("marks a handover confirmed on the courier's behalf (FR-025, design-system.md §8)", () => {
    const html = renderToStaticMarkup(
      <RouteHistory
        events={[
          routeEvent({
            type: "handover_confirmed",
            fromCourier: ana,
            toCourier: beto,
            onBehalf: true,
          }),
          routeEvent({ type: "handover_requested", fromCourier: ana, toCourier: beto }),
        ]}
      />,
    );
    expect(text(html).match(/Registrado por despacho/g)).toHaveLength(1);
  });

  it("keeps markup in a reason as text", () => {
    const html = renderToStaticMarkup(
      <RouteHistory
        events={[routeEvent({ type: "cancelled", reason: "<img src=x onerror=alert(1)>" })]}
      />,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});

describe("custodyChange (SC-005)", () => {
  it("labels restored responsibility without claiming another pickup and skips unchanged legacy pairs (T124)", () => {
    expect(
      custodyChange(
        shipmentEvent({
          type: "record_reverted",
          changes: { custodyCourierId: [null, "Ana Ruiz"] },
        }),
      ),
    ).toBe("Se restablece la custodia de Ana Ruiz por reversión");
    expect(
      custodyChange(
        shipmentEvent({
          type: "record_reverted",
          changes: { custodyCourierId: ["Ana Ruiz", "Ana Ruiz"] },
        }),
      ),
    ).toBeNull();
    expect(
      custodyChange(
        shipmentEvent({ type: "record_reverted", changes: { custodyCourierId: [null, null] } }),
      ),
    ).toBeNull();
  });

  it("distinguishes office receipt and pickup from delivery and ordinary pickup (US4 T058)", () => {
    expect(
      custodyChange(
        shipmentEvent({
          type: "office_received",
          changes: { custodyCourierId: ["Ana Ruiz", null], heldAtOffice: [false, true] },
        }),
      ),
    ).toBe("La recibe la oficina");
    expect(
      custodyChange(
        shipmentEvent({
          toStatus: "picked_up",
          changes: { custodyCourierId: [null, "Beto Gómez"], heldAtOffice: [true, false] },
        }),
      ),
    ).toBe("La recoge Beto Gómez en la oficina");
  });

  it("tells who held the package, from pickup to delivery", () => {
    expect(custodyChange(shipmentEvent({ toStatus: "registered" }))).toBeNull();
    expect(
      custodyChange(
        shipmentEvent({ toStatus: "picked_up", changes: { custodyCourierId: [null, "Ana Ruiz"] } }),
      ),
    ).toBe("Lo recoge Ana Ruiz");
    expect(
      custodyChange(
        shipmentEvent({
          type: "handover_confirmed",
          changes: { custodyCourierId: ["Ana Ruiz", "Beto Gómez"] },
        }),
      ),
    ).toBe("Lo recibe Beto Gómez de Ana Ruiz");
    expect(
      custodyChange(
        shipmentEvent({
          toStatus: "delivered",
          changes: { custodyCourierId: ["Beto Gómez", null] },
        }),
      ),
    ).toBe("Lo entrega Beto Gómez");
  });

  it("tells a return apart from a delivery", () => {
    expect(
      custodyChange(
        shipmentEvent({ toStatus: "returned", changes: { custodyCourierId: ["Ana Ruiz", null] } }),
      ),
    ).toBe("Lo devuelve Ana Ruiz");
  });
});
