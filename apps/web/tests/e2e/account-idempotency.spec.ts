import type { Page } from "@playwright/test";
import { z } from "zod";
import { accessibilityViolations, expect, test } from "./fixtures";

const password = "contrasena-prueba-durable";
async function openNew(page: Page, name: string, email: string) {
  await page.goto("/usuarios");
  await page.getByRole("button", { name: "Nueva cuenta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre").fill(name);
  await dialog.getByLabel("Correo").fill(email);
  await dialog.getByLabel("Contraseña inicial").fill(password);
  await expect(dialog.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
  return dialog;
}

async function currentActorId(page: Page) {
  const actorId = await page.evaluate(async () => {
    const response = await fetch("/api/auth/get-session", { credentials: "include" });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("user" in body)) return null;
    const user = body.user;
    if (typeof user !== "object" || user === null || !("id" in user)) return null;
    return typeof user.id === "string" ? user.id : null;
  });
  return actorId === null ? null : z.uuid().parse(actorId);
}

async function signInInBrowser(page: Page, email: string, password: string): Promise<boolean> {
  return page.evaluate(
    async ({ email, password }) => {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return response.ok;
    },
    { email, password },
  );
}

async function nativeAdminPost(
  page: Page,
  path: string,
  actorId: string,
  body: Record<string, string>,
) {
  return page.evaluate(
    async ({ requestPath, expectedActorId, requestBody }) => {
      const response = await fetch(`/api/auth/${requestPath}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "X-Domy-Actor-Id": expectedActorId,
        },
        body: JSON.stringify(requestBody),
      });
      const body: unknown = await response.json().catch(() => null);
      const error =
        typeof body === "object" && body !== null && "error" in body ? body.error : null;
      const errorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : null;
      return { ok: response.ok, status: response.status, errorCode };
    },
    { requestPath: path, expectedActorId: actorId, requestBody: body },
  );
}

test("keeps actor A's fresh account draft when a second tab signs in as owner B", async ({
  ownerPage: page,
}) => {
  await page.goto("/usuarios");
  const actorId = await currentActorId(page);
  expect(actorId).not.toBeNull();
  if (!actorId) throw new Error("No se pudo verificar la sesión de la cuenta propietaria.");
  const secondOwnerEmail = `actor-b-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const secondOwnerPassword = "contrasena-actor-b-prueba";
  const createOwner = await nativeAdminPost(page, "admin/create-user", actorId, {
    id: crypto.randomUUID(),
    email: secondOwnerEmail,
    password: secondOwnerPassword,
    name: "Propietaria B",
    role: "owner",
  });
  expect(createOwner, JSON.stringify(createOwner)).toMatchObject({ ok: true });

  const email = `actor-draft-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const dialog = await openNew(page, "Borrador de la sesión A", email);
  const other = await page.context().newPage();
  try {
    await other.goto("/");
    expect(await signInInBrowser(other, secondOwnerEmail, secondOwnerPassword)).toBe(true);
    await other.reload();
    await expect(other.getByRole("heading", { name: "Tablero de despacho" })).toBeVisible();

    const intentIds: string[] = [];
    await page.route("**/api/auth/admin/create-user", async (route) => {
      const body: unknown = route.request().postDataJSON();
      const identity = z.object({ id: z.uuid() }).safeParse(body);
      if (identity.success) intentIds.push(identity.data.id);
      await route.continue();
    });
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/auth/admin/create-user"),
    );
    await dialog.getByRole("button", { name: "Crear cuenta" }).click();
    const response = await responsePromise;
    const body: unknown = await response.json().catch(() => null);
    const actorError = z.object({ error: z.object({ code: z.string() }) }).safeParse(body);
    await expect
      .poll(
        async () => (await dialog.count()) === 0 || (await dialog.getByRole("alert").isVisible()),
      )
      .toBe(true);
    const alert = dialog.getByRole("alert");
    const alertMessage =
      (await alert.count()) > 0 ? ((await alert.textContent())?.trim() ?? null) : null;
    const pendingMetadata = await page.evaluate(
      ({ actor, secret, expectedEmail }) => {
        const keys = Object.keys(localStorage).filter(
          (key) => key.startsWith("domy:account-") && key.includes(actor),
        );
        const values = keys.map((key) => localStorage.getItem(key) ?? "");
        return {
          count: keys.length,
          hasDraft: values.some((value) => value.includes(expectedEmail)),
          containsPassword: values.some((value) => value.includes(secret)),
        };
      },
      { actor: actorId, secret: password, expectedEmail: email },
    );

    await other.goto("/usuarios");
    await expect(other.getByRole("heading", { name: "Usuarios", exact: true })).toBeVisible();
    await expect(other.getByRole("row").filter({ hasText: secondOwnerEmail })).toBeVisible();
    const effectCount = await other.getByRole("row").filter({ hasText: email }).count();
    expect(await accessibilityViolations(page)).toEqual([]);
    expect(await accessibilityViolations(other)).toEqual([]);
    expect({
      status: response.status(),
      errorCode: actorError.success ? actorError.data.error.code : null,
      dialogStayedOpen: (await dialog.count()) === 1,
      alertMessage,
      pendingMetadata,
      effectCount,
    }).toEqual({
      status: 409,
      errorCode: "actor_changed",
      dialogStayedOpen: true,
      alertMessage:
        "La sesión cambió de cuenta. Reabre la cuenta original para recuperar o continuar el cambio pendiente.",
      pendingMetadata: { count: expect.any(Number), hasDraft: true, containsPassword: false },
      effectCount: 0,
    });
    expect(pendingMetadata.count).toBeGreaterThan(0);

    expect(await signInInBrowser(other, "propietario@example.com", "contrasena-e2e-segura")).toBe(
      true,
    );
    await other.reload();
    await expect(other.getByRole("heading", { name: "Usuarios", exact: true })).toBeVisible();
    expect(await currentActorId(other)).toBe(actorId);
    const retryResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/auth/admin/create-user"),
    );
    await dialog.getByRole("button", { name: "Crear cuenta" }).click();
    const retryResponse = await retryResponsePromise;
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: email })).toBeVisible();
    expect(retryResponse.ok()).toBe(true);
    expect(intentIds).toHaveLength(2);
    expect(intentIds[1]).toBe(intentIds[0]);
    await other.goto("/usuarios");
    await expect(other.getByRole("row").filter({ hasText: email })).toBeVisible();
    expect(await accessibilityViolations(page)).toEqual([]);
    expect(await accessibilityViolations(other)).toEqual([]);
  } finally {
    await other.close();
  }
});

/** 001/T132: actual built browser + real API commit, then deliberately lose its response. */
test("retains a committed creation identity across response loss and reload", async ({
  ownerPage: page,
}) => {
  const email = `durable-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const ids: string[] = [];
  let drop = true;
  await page.route("**/api/auth/admin/create-user", async (route) => {
    const body: unknown = route.request().postDataJSON();
    // Inspect only the public UUID; never log or persist the request password.
    if (typeof body === "object" && body !== null && "id" in body && typeof body.id === "string")
      ids.push(body.id);
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    if (drop) {
      drop = false;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  let dialog = await openNew(page, "Cuenta durable", email);
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(dialog.getByRole("alert")).toContainText("conexión");
  const persisted = await page.evaluate(() =>
    Object.entries(localStorage).filter(([key]) => key.startsWith("domy:account-")),
  );
  expect(persisted.length).toBeGreaterThan(0);
  expect(JSON.stringify(persisted)).not.toContain(password);
  await page.reload();
  await page.getByRole("button", { name: "Nueva cuenta" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Correo")).toHaveValue(email);
  await expect(dialog.getByLabel("Contraseña inicial")).toHaveValue("");
  await dialog.getByLabel("Contraseña inicial").fill(password);
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: email })).toHaveCount(1);
  expect(ids).toHaveLength(2);
  expect(ids[1]).toBe(ids[0]);
  expect(
    await page.evaluate(
      () => Object.keys(localStorage).filter((key) => key.startsWith("domy:account-")).length,
    ),
  ).toBe(0);
});

test("resumes an acknowledged create and lost link ACK without recreating or requesting a password", async ({
  ownerPage: page,
}) => {
  const tag = crypto.randomUUID().slice(0, 8);
  const name = `Mensajera durable ${tag}`;
  const email = `link-${tag}@example.com`;
  const created = await page.request.post("/api/couriers", {
    data: { id: crypto.randomUUID(), name, phone: "3004445566", aliases: [] },
  });
  expect(created.status()).toBe(201);
  let creates = 0;
  const links: string[] = [];
  let drop = true;
  await page.route("**/api/auth/admin/create-user", async (route) => {
    creates++;
    await route.continue();
  });
  await page.route("**/api/couriers/accounts/*", async (route) => {
    const body: unknown = route.request().postDataJSON();
    if (
      typeof body === "object" &&
      body !== null &&
      "actionId" in body &&
      typeof body.actionId === "string"
    )
      links.push(body.actionId);
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    if (drop) {
      drop = false;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  let dialog = await openNew(page, name, email);
  await page.getByRole("combobox", { name: "Rol", exact: true }).click();
  await page.getByRole("option", { name: "Mensajero", exact: true }).click();
  await page.getByRole("combobox", { name: "Mensajero vinculado", exact: true }).click();
  await page.getByRole("option", { name, exact: true }).click();
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(page.getByText(`Cuenta de ${name} creada`, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: email })).toContainText(
    "Reabre Nueva cuenta",
  );
  await page.getByRole("button", { name: "Nueva cuenta" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Correo")).toHaveValue(email);
  await expect(dialog.getByLabel("Contraseña inicial")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(dialog).toHaveCount(0);
  expect(creates).toBe(1);
  expect(links).toHaveLength(2);
  expect(links[1]).toBe(links[0]);
  const resumedRow = page.getByRole("row").filter({ hasText: email });
  await expect(resumedRow).toContainText(name);
  await expect(
    resumedRow.getByRole("button", { name: "Cerrar sesiones", exact: true }),
  ).toBeEnabled();
});

test("refuses networking when local persistence is blocked", async ({ ownerPage: page }) => {
  await page.addInitScript(() => {
    const native = Storage.prototype.setItem.bind(localStorage);
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("domy:account-"))
        throw new DOMException("Synthetic storage refusal", "QuotaExceededError");
      native(key, value);
    };
  });
  let sends = 0;
  await page.route("**/api/auth/admin/create-user", async (route) => {
    sends++;
    await route.continue();
  });
  const dialog = await openNew(
    page,
    "Sin almacenamiento",
    `blocked-${crypto.randomUUID().slice(0, 8)}@example.com`,
  );
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(dialog.getByRole("alert")).toContainText("almacenamiento");
  expect(sends).toBe(0);
});

test("shares a creation UUID across two tabs while both network requests are pending", async ({
  ownerPage: page,
}) => {
  const other = await page.context().newPage();
  const email = `tabs-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const ids: string[] = [];
  let release: (() => void) | undefined;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.context().route("**/api/auth/admin/create-user", async (route) => {
    const body: unknown = route.request().postDataJSON();
    if (typeof body === "object" && body !== null && "id" in body && typeof body.id === "string")
      ids.push(body.id);
    await barrier;
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.fulfill({ response });
  });
  const first = await openNew(page, "Dos pestañas", email);
  const second = await openNew(other, "Dos pestañas", email);
  try {
    await first.getByRole("button", { name: "Crear cuenta" }).click();
    await second.getByRole("button", { name: "Crear cuenta" }).click();
    await expect.poll(() => ids.length).toBe(2);
    expect(ids[1]).toBe(ids[0]);
  } finally {
    release?.();
  }
  // Either tab may win the ACK race. Both must finish or show the conservative recovery alert.
  await expect
    .poll(async () => {
      const a = await first.count();
      const b = await second.count();
      return (
        (a === 0 || b === 0) &&
        (a === 0 || (await first.getByRole("alert").isVisible())) &&
        (b === 0 || (await second.getByRole("alert").isVisible()))
      );
    })
    .toBe(true);
  expect(ids).toHaveLength(2);
  expect(await accessibilityViolations(page)).toEqual([]);
  expect(await accessibilityViolations(other)).toEqual([]);
  const completedPage = (await first.count()) === 0 ? page : other;
  await expect(completedPage.getByRole("row").filter({ hasText: email })).toHaveCount(1);
  if (await first.count()) await first.getByRole("button", { name: "Volver", exact: true }).click();
  await other.close();
});

test("recovers an uncertain ban before unban and a genuinely new ban after reload", async ({
  ownerPage: page,
}) => {
  const email = `ban-cycle-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const dialog = await openNew(page, "Ciclo de cuenta", email);
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(dialog).toHaveCount(0);
  const ids: string[] = [];
  let drop = true;
  await page.route("**/api/auth/admin/ban-user", async (route) => {
    const body: unknown = route.request().postDataJSON();
    if (
      typeof body === "object" &&
      body !== null &&
      "actionId" in body &&
      typeof body.actionId === "string"
    )
      ids.push(body.actionId);
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    if (drop) {
      drop = false;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  const row = page.getByRole("row").filter({ hasText: email });
  await row.getByRole("button", { name: "Desactivar", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Desactivar cuenta", exact: true })
    .click();
  await expect(
    page.getByText("No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(row).toContainText("Inactiva");
  await expect(row.getByRole("button", { name: "Reactivar", exact: true })).toBeDisabled();
  await row.getByRole("button", { name: "Reintentar cambio pendiente", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Reintentar cambio pendiente", exact: true }),
  ).toHaveCount(0);
  expect(ids).toHaveLength(2);
  expect(ids[1]).toBe(ids[0]);
  await row.getByRole("button", { name: "Reactivar", exact: true }).click();
  await expect(row.getByRole("button", { name: "Desactivar", exact: true })).toBeEnabled();
  await row.getByRole("button", { name: "Desactivar", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Desactivar cuenta", exact: true })
    .click();
  await expect(row).toContainText("Inactiva");
  expect(ids).toHaveLength(3);
  expect(ids[2]).not.toBe(ids[0]);
});
