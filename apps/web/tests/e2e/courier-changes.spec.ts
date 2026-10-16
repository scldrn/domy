import {
  formatTrackingNumber,
  type RouteDetail,
  type Shipment,
  type ShipmentDetail,
} from "@domy/domain";
import { chromium, type Page } from "@playwright/test";
import { register } from "./api";
import { deliver, dispatch, openStop, ownSession, workerControls } from "./courier";
import { accessibilityViolations, expect, test } from "./fixtures";

const card = (page: Page, shipment: Shipment) =>
  page
    .getByRole("list", { name: "Envíos de la parada" })
    .getByRole("listitem")
    .filter({
      has: page.getByText(formatTrackingNumber(shipment.trackingNumber), { exact: true }),
    });
const notices = (page: Page) => page.getByRole("region", { name: "Cambios de tu ruta" });
async function current(office: Page, route: RouteDetail) {
  return (await (await office.request.get(`/api/routes/${route.id}`)).json()) as RouteDetail;
}
async function detail(office: Page, shipment: Shipment) {
  return (await (
    await office.request.get(`/api/shipments/${shipment.id}`)
  ).json()) as ShipmentDetail;
}
async function action(
  office: Page,
  route: RouteDetail,
  path: string,
  data: Record<string, unknown> = {},
) {
  const fresh = await current(office, route);
  const response = await office.request.post(`/api/routes/${route.id}${path}`, {
    data: { actionId: crypto.randomUUID(), version: fresh.version, ...data },
  });
  expect(response.ok(), await response.text()).toBe(true);
}
async function acknowledge(page: Page) {
  await notices(page).getByRole("button", { name: "Entendido", exact: true }).click();
  await expect(notices(page)).not.toBeVisible();
}
async function pickup(page: Page, shipment: Shipment) {
  await page
    .getByRole("list", { name: "Paradas" })
    .getByRole("link")
    .filter({ has: page.getByText("Recogida", { exact: true }) })
    .click();
  await card(page, shipment).getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(card(page, shipment)).toContainText("Recogido");
}

/** US5/T064: quickstart 14, including an offline, persistent acknowledgment. */
test("shows route changes until understood, preserves offline acknowledgment and reflects it on the board", async ({
  courierPage: phone,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const account = await ownSession(phone, owner);
  const removed = await register(office, { recipientAddress: "Calle 50 # 40-01" });
  const kept = await register(office, { recipientAddress: "Calle 51 # 40-02" });
  const route = await dispatch(office, [removed, kept], account.courierId);
  await phone.clock.install();
  await phone.goto("/mensajero");
  await expect(notices(phone)).toContainText("Te despacharon la Ruta");
  await acknowledge(phone);
  const added = await register(office, { recipientAddress: "Calle 52 # 40-03" });
  await office.bringToFront();
  await action(office, route, "/shipments", { shipmentIds: [added.id] });
  await action(office, route, `/shipments/${removed.id}/remove`);
  const fresh = await current(office, route);
  expect(
    (
      await office.request.put(`/api/routes/${route.id}/stop-order`, {
        data: {
          actionId: crypto.randomUUID(),
          version: fresh.version,
          stopIds: [
            fresh.stops[0]?.id,
            ...fresh.stops
              .slice(1)
              .reverse()
              .map((s) => s.id),
          ],
        },
      })
    ).ok(),
  ).toBe(true);
  const editable = await detail(office, added);
  expect(
    (
      await office.request.patch(`/api/shipments/${added.id}`, {
        data: {
          actionId: crypto.randomUUID(),
          version: editable.version,
          recipientAddress: "Calle 53 # 40-04",
          instructions: "Llamar en portería",
        },
      })
    ).ok(),
  ).toBe(true);
  await phone.bringToFront();
  // Exercise the existing 30-second poll with controlled browser time, not a sleep.
  await phone.clock.runFor(30_000);
  await expect(notices(phone)).toContainText("Envío agregado");
  await expect(notices(phone)).toContainText("Envío quitado");
  await expect(notices(phone)).toContainText("cambió el orden de las paradas");
  await expect(notices(phone)).toContainText("Envío actualizado");
  expect(await accessibilityViolations(phone)).toEqual([]);
  await phone.screenshot({
    path: test.info().outputPath("route-notices-phone.png"),
    fullPage: true,
  });
  await expect(phone.getByRole("list", { name: "Paradas" })).toContainText("Calle 53 # 40-04");
  await expect(phone.getByRole("list", { name: "Paradas" })).not.toContainText("Calle 50 # 40-01");
  await workerControls(phone);
  await phone.context().setOffline(true);
  await acknowledge(phone);
  await phone.reload();
  await expect(phone.getByRole("heading", { name: `Ruta ${String(route.number)}` })).toBeVisible();
  await expect(notices(phone)).not.toBeVisible();
  await phone.context().setOffline(false);
  await expect
    .poll(async () => {
      const board = (await (await office.request.get("/api/routes/board")).json()) as {
        routes: { id: string; unacknowledgedNotices: number; courierLastSyncedAt: string | null }[];
      };
      return board.routes.find((r) => r.id === route.id);
    })
    .toMatchObject({ unacknowledgedNotices: 0, courierLastSyncedAt: expect.any(String) });
  await office.goto("/rutas");
  await expect(office.getByText(/Última sincronización/).first()).toBeVisible();
});

/** Quickstart 15: two independent phones, receiver confirmation persisted offline first. */
test("keeps a handover blocked until the receiving courier confirms it, then permits delivery", async ({
  browser,
  courierPage: giver,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const receivingContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const receiver = await receivingContext.newPage();
  try {
    const a = await ownSession(giver, owner);
    const b = await ownSession(receiver, owner);
    const shipment = await register(office, { recipientAddress: "Calle 54 # 40-05" });
    await dispatch(office, [shipment, await register(office)], a.courierId);
    await giver.goto("/mensajero");
    await expect(giver.getByRole("list", { name: "Paradas" })).toBeVisible();
    await pickup(giver, shipment);
    await expect.poll(async () => (await detail(office, shipment)).status).toBe("picked_up");
    const target = await dispatch(office, await register(office), b.courierId);
    expect(
      (
        await office.request.post(`/api/shipments/${shipment.id}/reassign`, {
          data: {
            actionId: crypto.randomUUID(),
            toRouteId: target.id,
            reason: "Cambio de sector de entrega",
          },
        })
      ).ok(),
    ).toBe(true);
    await giver.goto("/mensajero");
    await expect(giver.getByText(/Entregar a /)).toBeVisible();
    await receiver.goto("/mensajero");
    await expect(receiver.getByRole("list", { name: "Paradas" })).toContainText("Calle 54 # 40-05");
    await workerControls(receiver);
    await openStop(receiver, "Calle 54 # 40-05");
    await expect(card(receiver, shipment)).toContainText("Traspaso pendiente");
    expect(await accessibilityViolations(receiver)).toEqual([]);
    await receiver.screenshot({
      path: test.info().outputPath("pending-handover-phone.png"),
      fullPage: true,
    });
    await expect(
      card(receiver, shipment).getByRole("button", { name: "Registrar entrega" }),
    ).toHaveCount(0);
    await receiver.context().setOffline(true);
    await card(receiver, shipment)
      .getByRole("button", { name: "Recibí el paquete", exact: true })
      .click();
    await expect(card(receiver, shipment)).not.toContainText("Traspaso pendiente");
    await receiver.reload();
    await expect(
      card(receiver, shipment).getByRole("button", { name: "Registrar entrega" }),
    ).toBeVisible();
    // T121: reconnect before an already-started offline send reports its failure.
    const release = Promise.withResolvers<undefined>();
    let held = false;
    await receiver.route("**/api/courier/records", async (request) => {
      if (!held) {
        held = true;
        await release.promise;
        await request.abort("internetdisconnected");
      } else await request.continue();
    });
    try {
      await deliver(receiver, false);
      await expect.poll(() => held).toBe(true);
      await receiver.evaluate(() => {
        window.addEventListener(
          "online",
          () => {
            document.documentElement.setAttribute("data-t121-online", "true");
          },
          { once: true },
        );
      });
      await receiver.context().setOffline(false);
      await expect(receiver.locator("html")).toHaveAttribute("data-t121-online", "true");
    } finally {
      release.resolve(undefined);
    }
    await expect.poll(async () => (await detail(office, shipment)).status).toBe("delivered");
    const stored = await detail(office, shipment);
    expect(stored.records.filter((r) => r.kind === "handover_confirmation")).toEqual([
      expect.objectContaining({ outcome: "applied", onBehalf: false }),
    ]);
    expect(stored.records.filter((r) => r.kind === "delivery")).toEqual([
      expect.objectContaining({ outcome: "applied", onBehalf: false }),
    ]);
    expect(stored.custodyCourier).toBeNull();
    await giver.reload();
    await expect(giver.getByText(/Entregar a /)).toHaveCount(0);
    expect(await accessibilityViolations(receiver)).toEqual([]);
  } finally {
    await receivingContext.close();
  }
});

/** Quickstart 16/17: the dispatcher changes the server while the phone retains its facts. */
test("synchronizes a removed pickup and allows dispatch to clear its review without changing custody", async ({
  courierPage: phone,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const account = await ownSession(phone, owner);
  const shipment = await register(office, { recipientAddress: "Calle 55 # 40-06" });
  const route = await dispatch(office, [shipment, await register(office)], account.courierId);
  await phone.goto("/mensajero");
  await expect(phone.getByRole("list", { name: "Paradas" })).toBeVisible();
  await workerControls(phone);
  await phone.context().setOffline(true);
  await pickup(phone, shipment);
  await action(office, route, `/shipments/${shipment.id}/remove`);
  await phone.context().setOffline(false);
  await expect.poll(async () => (await detail(office, shipment)).status).toBe("picked_up");
  await office.goto(`/envios/${shipment.trackingNumber}`);
  await expect(office.getByText("Por revisar", { exact: true }).first()).toBeVisible();
  await office.getByRole("button", { name: "Marcar revisado", exact: true }).click();
  const dialog = office.getByRole("dialog");
  await dialog.getByLabel("Nota").fill("Recogida verificada con el mensajero");
  expect(await accessibilityViolations(office)).toEqual([]);
  await office.screenshot({
    path: test.info().outputPath("clear-review-dialog.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Guardar revisión", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await detail(office, shipment)).toMatchObject({
    status: "picked_up",
    needsReview: false,
    custodyCourier: { id: account.courierId },
  });
});

test("applies an offline delivery after reassignment and removes the receiving phone's blocked stop", async ({
  browser,
  courierPage: phone,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const context = await browser.newContext();
  const other = await context.newPage();
  try {
    const a = await ownSession(phone, owner);
    const b = await ownSession(other, owner);
    const shipment = await register(office, { recipientAddress: "Calle 56 # 40-07" });
    await dispatch(office, [shipment, await register(office)], a.courierId);
    const target = await dispatch(office, await register(office), b.courierId);
    await phone.goto("/mensajero");
    await expect(phone.getByRole("list", { name: "Paradas" })).toBeVisible();
    await pickup(phone, shipment);
    await expect.poll(async () => (await detail(office, shipment)).status).toBe("picked_up");
    await workerControls(phone);
    await phone.context().setOffline(true);
    await openStop(phone, "Calle 56 # 40-07");
    await deliver(phone, false);
    expect(
      (
        await office.request.post(`/api/shipments/${shipment.id}/reassign`, {
          data: {
            actionId: crypto.randomUUID(),
            toRouteId: target.id,
            reason: "Cambio de sector de entrega",
          },
        })
      ).ok(),
    ).toBe(true);
    await other.goto("/mensajero");
    await expect(other.getByRole("list", { name: "Paradas" })).toContainText("Calle 56 # 40-07");
    await phone.context().setOffline(false);
    await expect.poll(async () => (await detail(office, shipment)).status).toBe("delivered");
    await other.reload();
    await expect(other.getByRole("list", { name: "Paradas" })).not.toContainText(
      "Calle 56 # 40-07",
    );
    await expect(notices(other)).toContainText("Envío quitado");
    expect(
      (await detail(office, shipment)).records.filter((r) => r.kind === "delivery"),
    ).toHaveLength(1);
    expect(await accessibilityViolations(other)).toEqual([]);
  } finally {
    await context.close();
  }
});

test("ignores the same courier's second phone delivery without raising review (quickstart 18)", async ({
  browser,
  courierPage: first,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const account = await ownSession(first, owner);
  const context = await browser.newContext();
  const second = await context.newPage();
  try {
    expect(
      (
        await second.request.post("/api/auth/sign-in/email", {
          data: { email: account.email, password: account.password },
        })
      ).ok(),
    ).toBe(true);
    await second.setViewportSize({ width: 390, height: 844 });
    const shipment = await register(office, { recipientAddress: "Calle 57 # 40-08" });
    await dispatch(office, [shipment, await register(office)], account.courierId);
    await first.goto("/mensajero");
    await expect(first.getByRole("list", { name: "Paradas" })).toBeVisible();
    await pickup(first, shipment);
    await expect.poll(async () => (await detail(office, shipment)).status).toBe("picked_up");
    await second.goto("/mensajero");
    await expect(second.getByRole("list", { name: "Paradas" })).toBeVisible();
    await workerControls(second);
    await context.setOffline(true);
    await openStop(second, "Calle 57 # 40-08");
    await deliver(second, false);
    await openStop(first, "Calle 57 # 40-08");
    await deliver(first, false);
    await expect.poll(async () => (await detail(office, shipment)).status).toBe("delivered");
    await context.setOffline(false);
    await expect
      .poll(
        async () =>
          (await detail(office, shipment)).records.filter((r) => r.kind === "delivery").length,
      )
      .toBe(2);
    const saved = await detail(office, shipment);
    expect(saved.needsReview).toBe(false);
    expect(saved.attempts).toHaveLength(1);
    expect(
      saved.records
        .filter((r) => r.kind === "delivery")
        .map((r) => r.outcome)
        .sort(),
    ).toEqual(["applied", "duplicate"]);
    expect(await accessibilityViolations(second)).toEqual([]);
  } finally {
    await context.close();
  }
});

test("shows a private-data-free phone notification from the real service worker with the app closed", async ({
  dispatcherPage: office,
  ownerPage: owner,
  baseURL,
}) => {
  // Full Chromium's new headless mode supports real notification permissions, unlike headless-shell.
  const context = await chromium.launchPersistentContext(test.info().outputPath("push-profile"), {
    channel: "chromium",
    ...(baseURL && { baseURL }),
    viewport: { width: 390, height: 844 },
  });
  const phone = await context.newPage();
  try {
    const account = await ownSession(phone, owner);
    const shipment = await register(office);
    const route = await dispatch(office, shipment, account.courierId);
    const cdp = await phone.context().newCDPSession(phone);
    let registrationId: string | undefined;
    cdp.on(
      "ServiceWorker.workerRegistrationUpdated",
      (event: { registrations: { registrationId: string; scopeURL: string }[] }) => {
        registrationId = event.registrations.find((registration) =>
          registration.scopeURL.endsWith("/"),
        )?.registrationId;
      },
    );
    await cdp.send("ServiceWorker.enable");
    await phone.goto("/mensajero");
    await phone
      .context()
      .grantPermissions(["notifications"], { origin: new URL(phone.url()).origin });
    await workerControls(phone);
    const worker = phone.context().serviceWorkers()[0];
    if (!worker) throw new Error("The actual built service worker is missing");
    expect(await worker.evaluate(() => Notification.permission)).toBe("granted");
    const origin = new URL(phone.url()).origin;
    await expect.poll(() => registrationId).toEqual(expect.any(String));
    if (!registrationId) throw new Error("The built service worker has no Chromium registration");
    // Keep only an about:blank inspection tab; no app page remains open.
    await phone.goto("about:blank");
    await cdp.send("ServiceWorker.deliverPushMessage", {
      origin,
      registrationId,
      data: JSON.stringify({ type: "shipment_added", routeNumber: route.number }),
    });
    await expect
      .poll(() =>
        worker.evaluate(async () =>
          (
            await (
              globalThis as unknown as ServiceWorkerGlobalScope
            ).registration.getNotifications()
          ).map((n) => ({ title: n.title, body: n.body })),
        ),
      )
      .toEqual([
        { title: `Domy · Ruta ${String(route.number)}`, body: "Envío agregado a tu ruta." },
      ]);
    const shown = await worker.evaluate(async () =>
      (await (globalThis as unknown as ServiceWorkerGlobalScope).registration.getNotifications())
        .map((n) => `${n.title} ${n.body}`)
        .join(" "),
    );
    expect(shown).not.toContain("Laura Gómez");
    expect(shown).not.toContain("3001234567");
    expect(shown).not.toContain("Calle 10");
  } finally {
    await context.close();
  }
});
