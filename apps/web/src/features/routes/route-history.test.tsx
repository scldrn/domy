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
import { CustodyHistory, RouteHistory } from "./route-history";

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

describe("CustodyHistory (SC-005)", () => {
  it("distinguishes office receipt and pickup from delivery and ordinary pickup (US4 T058)", () => {
    const html = renderToStaticMarkup(
      <CustodyHistory
        events={[
          shipmentEvent({
            type: "office_received",
            changes: { custodyCourierId: ["Ana Ruiz", null], heldAtOffice: [false, true] },
          }),
          shipmentEvent({
            toStatus: "picked_up",
            changes: { custodyCourierId: [null, "Beto Gómez"], heldAtOffice: [true, false] },
          }),
        ]}
      />,
    );
    expect(text(html)).toContain("La recibe la oficina");
    expect(text(html)).toContain("La recoge Beto Gómez en la oficina");
    expect(text(html)).not.toContain("Lo entrega Ana Ruiz");
  });
  it("tells who held the package, from pickup to delivery, and who recorded it", () => {
    const html = renderToStaticMarkup(
      <CustodyHistory
        events={[
          shipmentEvent({ toStatus: "registered" }),
          shipmentEvent({
            toStatus: "picked_up",
            changes: { custodyCourierId: [null, "Ana Ruiz"] },
          }),
          shipmentEvent({
            type: "handover_confirmed",
            changes: { custodyCourierId: ["Ana Ruiz", "Beto Gómez"] },
            onBehalf: true,
          }),
          shipmentEvent({
            toStatus: "delivered",
            changes: { custodyCourierId: ["Beto Gómez", null] },
          }),
        ]}
      />,
    );
    const read = text(html);
    expect(read).toContain("Lo recoge Ana Ruiz");
    expect(read).toContain("Lo recibe Beto Gómez de Ana Ruiz");
    expect(read).toContain("Lo entrega Beto Gómez");
    expect(read.match(/Registrado por despacho/g)).toHaveLength(1);
  });

  it("shows nothing while no courier has had the package", () => {
    expect(renderToStaticMarkup(<CustodyHistory events={[shipmentEvent({})]} />)).toBe("");
  });

  it("tells a return apart from a delivery", () => {
    const html = renderToStaticMarkup(
      <CustodyHistory
        events={[
          shipmentEvent({
            toStatus: "returned",
            changes: { custodyCourierId: ["Ana Ruiz", null] },
          }),
        ]}
      />,
    );
    expect(text(html)).toContain("Lo devuelve Ana Ruiz");
  });
});
