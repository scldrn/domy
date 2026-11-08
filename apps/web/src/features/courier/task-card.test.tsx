import { courierSnapshot, courierTask, type CourierSnapshot, type CourierTask } from "@domy/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskCard } from "./task-card";

const userId = "00000000-0000-4000-8000-000000000001";
const merchantId = "00000000-0000-4000-8000-000000000002";
const shipmentId = "00000000-0000-4000-8000-000000000003";
const routeId = "00000000-0000-4000-8000-000000000004";
const stopId = "00000000-0000-4000-8000-000000000005";
const when = "2026-10-21T15:00:00.000Z";

const task = (extra: Partial<CourierTask> = {}): CourierTask =>
  courierTask.parse({
    id: "00000000-0000-4000-8000-000000000006",
    shipmentId,
    kind: "delivery",
    status: "pending",
    trackingNumber: "7SMQ5M5T",
    shipmentKind: "delivery",
    shipmentStatus: "picked_up",
    merchant: { id: merchantId, name: "Bullish Hype" },
    recipientName: "Laura Gómez",
    recipientPhone: "3001234567",
    carrier: null,
    destinationTown: null,
    errandDescription: null,
    instructions: null,
    packageCount: null,
    packageSize: null,
    windowStart: null,
    windowEnd: null,
    codAmount: 0,
    blockedByHandover: null,
    problemNote: null,
    ...extra,
  });

const snapshot = (tasks: CourierTask[]): CourierSnapshot =>
  courierSnapshot.parse({
    serverTime: when,
    sessionExpiresAt: "2026-10-31T15:00:00.000Z",
    route: {
      id: routeId,
      number: 17,
      serviceDate: "2026-10-21",
      status: "in_progress",
      stops: [
        {
          id: stopId,
          position: 0,
          kind: "delivery",
          address: "Calle 10 # 20-30",
          neighborhood: null,
          contactPhone: "3001234567",
          tasks,
        },
      ],
    },
    handoversToGive: [],
    heldOffRoute: [],
    notices: [],
    summary: {
      date: "2026-10-21",
      deliveries: 0,
      exceptions: 0,
      returns: 0,
      pendingStops: 0,
      cash: 0,
      companyTransfer: 0,
      merchantTransfer: 0,
      disbursements: 0,
      cashToHandOver: 0,
    },
  });

const read = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const renderTask = (visibleTask: CourierTask, routeTasks: CourierTask[] = [visibleTask]) =>
  read(
    renderToStaticMarkup(
      <TaskCard task={visibleTask} userId={userId} view={snapshot(routeTasks)} />,
    ),
  );

const completedTasks: { label: string; task: CourierTask }[] = [
  {
    label: "recogida",
    task: task({ kind: "pickup", status: "completed", shipmentStatus: "picked_up" }),
  },
  {
    label: "diligencia",
    task: task({
      kind: "errand",
      status: "completed",
      shipmentKind: "errand",
      shipmentStatus: "delivered",
    }),
  },
  {
    label: "devolución",
    task: task({ kind: "return", status: "completed", shipmentStatus: "returned" }),
  },
];

describe("courier stop actions (FR-006–FR-014, FR-012)", () => {
  it("shows pickup and problem actions on a pending pickup, plus the route disbursement", () => {
    const text = renderTask(
      task({ kind: "pickup", status: "pending", shipmentStatus: "dispatched" }),
    );

    expect(text).toContain("Confirmar recogida");
    expect(text).toContain("Reportar problema");
    expect(text).toContain("Registrar pago por cuenta del cliente");
    expect(text).not.toContain("Registrar entrega");
  });

  it("asks for pickup before delivery and keeps delivery and exception actions unavailable", () => {
    const text = renderTask(task({ shipmentStatus: "dispatched" }));

    expect(text).toContain("Primero confirma la recogida de este envío.");
    expect(text).toContain("Confirmar recogida");
    expect(text).not.toContain("Registrar entrega");
    expect(text).not.toContain("Reportar novedad");
  });

  it("offers delivery, exception and disbursement for a picked-up pending delivery", () => {
    const text = renderTask(task({ shipmentStatus: "picked_up" }));

    expect(text).toContain("Registrar entrega");
    expect(text).toContain("Reportar novedad");
    expect(text).toContain("Destinatario ausente");
    expect(text).toContain("Dirección errada");
    expect(text).toContain("Rechazado");
    expect(text).not.toContain("Otro");
    expect(text).toContain("Registrar pago por cuenta del cliente");
  });

  it("keeps disbursement available after a delivery task is completed", () => {
    const text = renderTask(task({ status: "completed", shipmentStatus: "delivered" }));

    expect(text).not.toContain("Registrar entrega");
    expect(text).not.toContain("Reportar novedad");
    expect(text).toContain("Registrar pago por cuenta del cliente");
  });

  it("offers completion and problem actions for a pending errand", () => {
    const text = renderTask(
      task({ kind: "errand", shipmentKind: "errand", shipmentStatus: "dispatched" }),
    );

    expect(text).toContain("Completar diligencia");
    expect(text).toContain("Reportar problema");
    expect(text).toContain("Registrar pago por cuenta del cliente");
    expect(text).not.toContain("Registrar entrega");
  });

  it.each(completedTasks)(
    "keeps disbursement available after a completed $label stop",
    ({ task: completedTask }) => {
      expect(renderTask(completedTask)).toContain("Registrar pago por cuenta del cliente");
    },
  );

  it("offers a return only after office pickup is confirmed", () => {
    const pickup = task({
      id: "00000000-0000-4000-8000-000000000007",
      kind: "pickup",
      status: "pending",
      shipmentStatus: "exception",
    });
    const returning = task({
      id: "00000000-0000-4000-8000-000000000008",
      kind: "return",
      status: "pending",
      shipmentStatus: "exception",
    });
    const officeHeld = renderTask(returning, [pickup, returning]);
    const readyToReturn = renderTask(returning);

    expect(officeHeld).toContain("Primero confirma la recogida en oficina.");
    expect(officeHeld).not.toContain("Confirmar devolución");
    expect(officeHeld).toContain("Reportar problema");
    expect(officeHeld).toContain("Registrar pago por cuenta del cliente");
    expect(readyToReturn).toContain("Confirmar devolución");
    expect(readyToReturn).toContain("Registrar pago por cuenta del cliente");
  });

  it("keeps the handover confirmation gate and offers no delivery action before receipt", () => {
    const text = renderTask(
      task({
        blockedByHandover: {
          id: "00000000-0000-4000-8000-000000000009",
          fromCourier: { id: "00000000-0000-4000-8000-000000000010", name: "Ana Ruiz" },
        },
      }),
    );

    expect(text).toContain("Traspaso pendiente");
    expect(text).toContain("Recibí el paquete");
    expect(text).not.toContain("Registrar entrega");
    expect(text).not.toContain("Reportar novedad");
  });

  it("does not offer a disbursement for an annulled shipment", () => {
    const text = renderTask(task({ status: "failed", shipmentStatus: "voided" }));

    expect(text).not.toContain("Registrar pago por cuenta del cliente");
  });

  it("does not render route actions without an authenticated courier", () => {
    const pickup = task({ kind: "pickup", shipmentStatus: "dispatched" });
    const html = renderToStaticMarkup(
      <TaskCard task={pickup} userId={null} view={snapshot([pickup])} />,
    );

    expect(html).toBe("");
  });
});
