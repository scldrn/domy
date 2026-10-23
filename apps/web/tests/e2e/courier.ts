import type { RouteDetail, Shipment } from "@domy/domain";
import type { Page } from "@playwright/test";
import { z } from "zod";
import { expect } from "./fixtures";
import { webPort } from "./ports";

const phone = { width: 390, height: 844 };
const password = "contrasena-e2e-segura";

export async function ownSession(page: Page, owner: Page) {
  // Independent accounts and routes keep these cases runnable in any order, including alone.
  const session = await owner.request.get("/api/auth/get-session");
  expect(session.ok()).toBe(true);
  const actorId = z
    .object({ user: z.object({ id: z.uuid() }) })
    .parse((await session.json()) as unknown).user.id;
  const id = crypto.randomUUID();
  const email = `offline-${id}@example.com`;
  const created = await owner.request.post("/api/auth/admin/create-user", {
    headers: {
      origin: `http://127.0.0.1:${String(webPort)}`,
      "X-Domy-Actor-Id": actorId,
    },
    data: { id: crypto.randomUUID(), email, password, name: "Mensajero offline", role: "courier" },
  });
  expect(created.ok()).toBe(true);
  const account = z
    .object({ user: z.object({ id: z.uuid() }) })
    .parse((await created.json()) as unknown);
  expect(
    (
      await owner.request.post("/api/couriers", {
        data: { id, name: `Mensajero ${id}`, phone: "3004445566", aliases: [] },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await owner.request.put(`/api/couriers/accounts/${account.user.id}`, {
        headers: {
          origin: `http://127.0.0.1:${String(webPort)}`,
          "X-Domy-Actor-Id": actorId,
        },
        data: { actionId: crypto.randomUUID(), courierId: id },
      })
    ).ok(),
  ).toBe(true);
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  expect(response.ok()).toBe(true);
  await page.setViewportSize(phone);
  return { courierId: id, email, password };
}

export async function dispatch(page: Page, shipment: Shipment | Shipment[], courierId: string) {
  const id = crypto.randomUUID();
  const created = await page.request.post("/api/routes", {
    data: {
      id,
      actionId: id,
      serviceDate: "2026-10-01",
      shipmentIds: (Array.isArray(shipment) ? shipment : [shipment]).map((item) => item.id),
      courierId,
    },
  });
  expect(created.status()).toBe(201);
  const route = (await created.json()) as RouteDetail;
  expect(
    (
      await page.request.post(`/api/routes/${route.id}/dispatch`, {
        data: { actionId: crypto.randomUUID(), version: route.version },
      })
    ).ok(),
  ).toBe(true);
  return route;
}

export async function workerControls(page: Page) {
  // T043 requires the built app, not a development-server approximation of offline mode.
  await page.evaluate(() =>
    Promise.race([
      navigator.serviceWorker.ready.then(() => undefined),
      new Promise<void>((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error("The app's service worker did not activate"));
        }, 5000);
      }),
    ]),
  );
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, {
    timeout: 5000,
  });
}

export async function openStop(page: Page, address: string) {
  await page.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
  await page
    .getByRole("list", { name: "Paradas" })
    .getByRole("link")
    .filter({ hasText: address })
    .click();
}

export async function deliver(page: Page, photo: boolean) {
  await page.getByRole("button", { name: "Registrar entrega" }).click();
  const sheet = page.getByRole("dialog");
  if (photo) {
    const image = await page.screenshot({ type: "jpeg", quality: 40 });
    const chooser = page.waitForEvent("filechooser");
    await sheet.getByRole("button", { name: "Tomar foto" }).click();
    await (await chooser).setFiles({ name: "prueba.jpg", mimeType: "image/jpeg", buffer: image });
    await expect(sheet.getByRole("img", { name: "Foto 1" })).toBeVisible();
  }
  await sheet.getByRole("button", { name: "Guardar entrega" }).click();
  await expect(sheet).not.toBeVisible();
}
