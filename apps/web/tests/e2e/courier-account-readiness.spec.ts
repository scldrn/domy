import type { Page } from "@playwright/test";
import { z } from "zod";
import { accessibilityViolations, expect, test } from "./fixtures";

const accountPassword = "contrasena-readiness-e2e";
const courierSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string(),
  isActive: z.boolean(),
  aliases: z.array(z.string()),
  account: z.object({ id: z.uuid(), email: z.email() }).nullable(),
});
const courierListSchema = z.object({ items: z.array(courierSchema) });

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function listCouriers(page: Page) {
  const response = await page.request.get("/api/couriers?q=");
  expect(response.status()).toBe(200);
  const payload: unknown = await response.json();
  return courierListSchema.parse(payload).items;
}

async function createLinkedCourierAccount(page: Page, suffix: string) {
  const courierId = crypto.randomUUID();
  const courierName = `Mensajero disponible ${suffix}`;
  const email = `vinculo${suffix}@example.com`;
  const createdCourier = await page.request.post("/api/couriers", {
    data: { id: courierId, name: courierName, phone: "3004445566", aliases: [] },
  });
  expect(createdCourier.status()).toBe(201);

  await page.goto("/usuarios");
  await page.getByRole("button", { name: "Nueva cuenta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre").fill(`Cuenta vinculada ${suffix}`);
  await dialog.getByLabel("Correo").fill(email);
  await chooseOption(page, "Rol", "Mensajero");
  await chooseOption(page, "Mensajero vinculado", courierName);
  await dialog.getByLabel("Contraseña inicial").fill(accountPassword);
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("row").filter({ hasText: email })).toBeVisible();

  const linked = (await listCouriers(page)).find((courier) => courier.id === courierId);
  expect(linked?.account?.email).toBe(email);
  if (!linked?.account) throw new Error("La cuenta de prueba no quedó vinculada al mensajero.");
  return { courierId, courierName, email, accountId: linked.account.id };
}

test("does not unlink an unchanged account when its courier GET resolves after Edit opens (003/T135)", async ({
  ownerPage,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const setup = await createLinkedCourierAccount(ownerPage, suffix);
  const page = await ownerPage.context().newPage();
  let releaseHeldGet: (() => void) | undefined;
  let markGetHeld: (() => void) | undefined;
  const heldGet = new Promise<void>((resolve) => {
    markGetHeld = resolve;
  });
  const responseGate = new Promise<void>((resolve) => {
    releaseHeldGet = resolve;
  });

  try {
    await page.route(
      (url) => new URL(url).pathname === "/api/couriers",
      async (route) => {
        markGetHeld?.();
        await responseGate;
        await route.continue();
      },
    );
    await page.goto("/usuarios");
    await heldGet;
    const row = page.getByRole("row").filter({ hasText: setup.email });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog");
    const courierResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/couriers",
    );
    releaseHeldGet?.();
    const response = await courierResponse;
    expect(response.status()).toBe(200);
    await expect(dialog.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    expect(await accessibilityViolations(page)).toEqual([]);

    // The owner changes nothing. The linked courier remains the authoritative relationship.
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialog).not.toBeVisible();
    const after = (await listCouriers(ownerPage)).find((courier) => courier.id === setup.courierId);
    expect(after?.account?.id).toBe(setup.accountId);
    expect(await accessibilityViolations(page)).toEqual([]);
  } finally {
    releaseHeldGet?.();
    await page.close();
  }
});

test("shows an inactive existing link and only changes it after an explicit choice (003/T135)", async ({
  ownerPage,
}) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const setup = await createLinkedCourierAccount(ownerPage, suffix);
  const deactivated = await ownerPage.request.patch(`/api/couriers/${setup.courierId}`, {
    data: { actionId: crypto.randomUUID(), isActive: false },
  });
  expect(deactivated.status()).toBe(200);

  const page = await ownerPage.context().newPage();
  try {
    await page.goto("/usuarios");
    const row = page.getByRole("row").filter({ hasText: setup.email });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Editar" }).click();
    const dialog = page.getByRole("dialog");
    const courier = dialog.getByRole("combobox", { name: "Mensajero vinculado" });
    await expect(courier).toContainText(`${setup.courierName} (inactivo)`);
    expect(await accessibilityViolations(page)).toEqual([]);

    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(dialog).not.toBeVisible();
    let existing = (await listCouriers(ownerPage)).find((item) => item.id === setup.courierId);
    expect(existing?.account?.id).toBe(setup.accountId);

    const reactivated = await ownerPage.request.patch(`/api/couriers/${setup.courierId}`, {
      data: { actionId: crypto.randomUUID(), isActive: true },
    });
    expect(reactivated.status()).toBe(200);
    await page.reload();
    const refreshedRow = page.getByRole("row").filter({ hasText: setup.email });
    await expect(refreshedRow).toBeVisible();
    await refreshedRow.getByRole("button", { name: "Editar" }).click();
    const unlinkDialog = page.getByRole("dialog");
    await chooseOption(page, "Mensajero vinculado", "Sin vincular");
    await unlinkDialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(unlinkDialog).not.toBeVisible();
    existing = (await listCouriers(ownerPage)).find((item) => item.id === setup.courierId);
    expect(existing?.account).toBeNull();

    await refreshedRow.getByRole("button", { name: "Editar" }).click();
    const relinkDialog = page.getByRole("dialog");
    await chooseOption(page, "Mensajero vinculado", setup.courierName);
    await relinkDialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(relinkDialog).not.toBeVisible();
    existing = (await listCouriers(ownerPage)).find((item) => item.id === setup.courierId);
    expect(existing?.account?.id).toBe(setup.accountId);
    expect(await accessibilityViolations(page)).toEqual([]);
  } finally {
    await page.close();
  }
});

test("blocks courier account saves after a real GET failure until retry succeeds (003/T135)", async ({
  ownerPage,
}) => {
  const page = await ownerPage.context().newPage();
  let releaseInitialAttempt: (() => void) | undefined;
  let markFirstAttempt: (() => void) | undefined;
  let markAutomaticRetriesFailed: (() => void) | undefined;
  const initialAttempt = new Promise<void>((resolve) => {
    markFirstAttempt = resolve;
  });
  const startAutomaticRetries = new Promise<void>((resolve) => {
    releaseInitialAttempt = resolve;
  });
  const automaticRetriesFailed = new Promise<void>((resolve) => {
    markAutomaticRetriesFailed = resolve;
  });
  let attempts = 0;

  try {
    await page.route(
      (url) => new URL(url).pathname === "/api/couriers",
      async (route) => {
        attempts += 1;
        if (attempts <= 3) {
          if (attempts === 1) {
            markFirstAttempt?.();
            await startAutomaticRetries;
          }
          await route.abort("failed");
          if (attempts === 3) markAutomaticRetriesFailed?.();
          return;
        }
        await route.continue();
      },
    );
    await page.goto("/usuarios");
    await initialAttempt;
    await page.getByRole("button", { name: "Nueva cuenta" }).click();
    const dialog = page.getByRole("dialog");
    await chooseOption(page, "Rol", "Mensajero");
    releaseInitialAttempt?.();
    await automaticRetriesFailed;

    const alert = dialog.getByRole("alert");
    await expect(alert).toContainText("No pudimos confirmar el mensajero vinculado");
    const submit = dialog.getByRole("button", { name: "Crear cuenta" });
    await expect(submit).toBeDisabled();
    await expect(dialog.getByRole("combobox", { name: "Mensajero vinculado" })).toBeDisabled();
    expect(await accessibilityViolations(page)).toEqual([]);

    const listResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/couriers",
    );
    await alert.getByRole("button", { name: "Reintentar" }).click();
    await expect(dialog.getByRole("status")).toContainText("Confirmando el mensajero vinculado");
    const response = await listResponse;
    expect(response.status()).toBe(200);
    await expect(alert).toHaveCount(0);
    await expect(dialog.getByRole("combobox", { name: "Mensajero vinculado" })).toBeEnabled();
    await expect(submit).toBeEnabled();
    expect(await accessibilityViolations(page)).toEqual([]);
  } finally {
    releaseInitialAttempt?.();
    await page.close();
  }
});
