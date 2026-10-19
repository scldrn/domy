import type { Browser, Page } from "@playwright/test";
import { accessibilityViolations, expect, test } from "./fixtures";
import { apiPort } from "./ports";

const password = "contrasena-de-prueba";
const unique = () => String(Date.now()).slice(-6);
const startOfSuite = "2026-10-01T15:00:00Z";

test.afterEach(async ({ setServerNow }) => {
  await setServerNow(startOfSuite);
});

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** The owner creates an account on the users screen. */
async function createAccount(page: Page, name: string, email: string, role: string) {
  await page.goto("/usuarios");
  await page.getByRole("button", { name: "Nueva cuenta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre").fill(name);
  await dialog.getByLabel("Correo").fill(email);
  await chooseOption(page, "Rol", role);
  await dialog.getByLabel("Contraseña inicial").fill(password);
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("row").filter({ hasText: email })).toBeVisible();
}

async function signInAs(browser: Browser, email: string, secret = password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/ingresar");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(secret);
  await page.getByRole("button", { name: "Ingresar" }).click();
  return page;
}

test("gives each role its own access (scenario 13)", async ({ ownerPage, browser }) => {
  const run = unique();
  await createAccount(
    ownerPage,
    `Coordinadora ${run}`,
    `coordinadora${run}@example.com`,
    "Coordinador de despacho",
  );
  await createAccount(ownerPage, `Mensajero ${run}`, `mensajero${run}@example.com`, "Mensajero");

  const dispatcher = await signInAs(browser, `coordinadora${run}@example.com`);
  await expect(dispatcher.getByRole("heading", { name: "Tablero de despacho" })).toBeVisible();
  await expect(dispatcher.getByRole("link", { name: "Clientes" })).toBeVisible();
  await expect(dispatcher.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
  await expect(dispatcher.getByRole("link", { name: "Auditoría" })).toHaveCount(0);
  await dispatcher.goto("/tarifario");
  await expect(dispatcher.getByRole("heading", { name: "Tarifario" })).toBeVisible();
  await expect(dispatcher.getByRole("button", { name: "Nueva tarifa" })).toHaveCount(0);
  await dispatcher.goto("/usuarios");
  await expect(dispatcher).toHaveURL(/\/$/);

  const courier = await signInAs(browser, `mensajero${run}@example.com`);
  await expect(courier).toHaveURL(/\/mensajero$/);
  // The courier app (feature 003), not the panel.
  await expect(courier.getByRole("heading", { name: "Mi ruta" })).toBeVisible();
  // A new account is not linked to its courier yet: the app says so (FR-002).
  await expect(courier.getByText("Tu cuenta no está vinculada a un mensajero.")).toBeVisible();
  const navigation = courier.getByRole("navigation", { name: "Navegación principal" });
  await expect(navigation.getByRole("link", { name: "Mi ruta" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(navigation.getByRole("link", { name: "Mi día" })).toBeVisible();
  await courier.goto("/historial");
  await expect(courier).toHaveURL(/\/mensajero$/);
});

test("links a courier account to its courier (feature 003, FR-002)", async ({
  ownerPage,
  browser,
}) => {
  const run = unique();
  const name = `Mensajera ${run}`;
  const created = await ownerPage.request.post("/api/couriers", {
    data: { id: crypto.randomUUID(), name, phone: "3004445566", aliases: [] },
  });
  expect(created.status()).toBe(201);

  await ownerPage.goto("/usuarios");
  await ownerPage.getByRole("button", { name: "Nueva cuenta" }).click();
  const dialog = ownerPage.getByRole("dialog");
  await dialog.getByLabel("Nombre").fill(name);
  await dialog.getByLabel("Correo").fill(`mensajera${run}@example.com`);
  await chooseOption(ownerPage, "Rol", "Mensajero");
  await chooseOption(ownerPage, "Mensajero vinculado", name);
  await dialog.getByLabel("Contraseña inicial").fill(password);
  await dialog.getByRole("button", { name: "Crear cuenta" }).click();
  const row = ownerPage.getByRole("row").filter({ hasText: `mensajera${run}@example.com` });
  await expect(row).toContainText(name);

  // The courier's app shows their route, not the warning of an unlinked account.
  const courier = await signInAs(browser, `mensajera${run}@example.com`);
  await expect(courier.getByText("No tienes una ruta despachada")).toBeVisible();

  // "Mensajeros" shows the account, read only.
  await ownerPage.goto("/mensajeros");
  await expect(ownerPage.getByRole("row").filter({ hasText: name })).toContainText(
    `mensajera${run}@example.com`,
  );
});

// T099: observe the transient synchronization frame, not just its settled result (FR-002).
test("presents an unlinked account's refusal once during and after synchronization", async ({
  ownerPage,
  browser,
}) => {
  const run = unique();
  const email = `sinvinculo${run}@example.com`;
  await createAccount(ownerPage, `Sin vínculo ${run}`, email, "Mensajero");
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const refusal = "Tu cuenta no está vinculada a un mensajero.";
    new MutationObserver(() => {
      const count = Array.from(document.querySelectorAll("p")).filter((p) =>
        p.textContent.includes(refusal),
      ).length;
      document.documentElement.dataset["maxRefusals"] = String(
        Math.max(Number(document.documentElement.dataset["maxRefusals"] ?? 0), count),
      );
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/ingresar");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText(/Tu acceso fue retirado/)).toBeVisible();
  await expect(page.getByText("Tu cuenta no está vinculada a un mensajero.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-max-refusals", "1");
  await page.getByRole("link", { name: "Pendientes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pendientes por sincronizar" })).toBeVisible();
  await expect(page.getByText("Tu cuenta no está vinculada a un mensajero.")).toBeVisible();
  // T102: the pending page has its own retry; exercise the refusal's unique action.
  const refusal = page
    .getByRole("alert")
    .filter({ hasText: "Tu cuenta no está vinculada a un mensajero." });
  await expect(refusal).toHaveCount(1);
  const retry = refusal.getByRole("button", { name: "Reintentar sincronización", exact: true });
  await expect(retry).toBeVisible();
  const retried = page.waitForResponse(
    (response) => response.url().endsWith("/api/courier/route") && response.status() === 403,
  );
  await retry.click();
  await retried;
  await expect(refusal).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-max-refusals", "1");
  expect(await accessibilityViolations(page)).toEqual([]);
  await context.close();
});

// T100: advance beyond the real notification's lifetime while axe is about to scan it.
test("keeps visible notifications stable and restores focus during accessibility scans", async ({
  ownerPage: page,
}) => {
  const run = unique();
  await page.clock.install();
  await createAccount(page, `Aviso ${run}`, `aviso${run}@example.com`, "Coordinador de despacho");
  const notification = page.getByText(`Cuenta de Aviso ${run} creada`, { exact: true });
  await expect(notification).toBeVisible();
  const button = page.getByRole("button", { name: "Nueva cuenta" });
  await button.focus();
  expect(
    await accessibilityViolations(page, async () => {
      // Freeze only after normal keyboard/animation handling, then advance past expiry.
      await page.clock.pauseAt(new Date(Date.now() + 100));
      await page.clock.runFor(5_000);
      await expect(notification).toBeVisible();
      await page.clock.resume();
    }),
  ).toEqual([]);
  await expect(button).toBeFocused();
});

test("scans and restores focus when a notification expires before it can be paused", async ({
  ownerPage: page,
}) => {
  const run = unique();
  await page.clock.install();
  await createAccount(page, `Caduca ${run}`, `caduca${run}@example.com`, "Coordinador de despacho");
  const notification = page.getByText(`Cuenta de Caduca ${run} creada`, { exact: true });
  await expect(notification).toBeVisible();
  const button = page.getByRole("button", { name: "Nueva cuenta" });
  await button.focus();
  let scanned = false;
  let expired = false;
  expect(
    await accessibilityViolations(
      page,
      async () => {
        scanned = true;
        await expect(notification).toHaveCount(0);
      },
      async () => {
        // No wall-clock wait: expire Sonner's real timer before its native pause shortcut.
        await page.clock.pauseAt(new Date(Date.now() + 100));
        await page.clock.runFor(5_000);
        await expect(notification).toHaveCount(0);
        expired = true;
        await page.clock.resume();
      },
    ),
  ).toEqual([]);
  expect(expired).toBe(true);
  expect(scanned).toBe(true);
  await expect(button).toBeFocused();
});

test("keeps notification scans stable with a modal and restores normal expiry (T154)", async ({
  ownerPage: page,
}) => {
  const run = unique();
  await page.clock.install();
  await createAccount(page, `Modal ${run}`, `modal${run}@example.com`, "Coordinador de despacho");
  const notification = page.getByText(`Cuenta de Modal ${run} creada`, { exact: true });
  await expect(notification).toBeVisible();
  await page.getByRole("button", { name: "Nueva cuenta" }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByLabel("Nombre");
  await input.fill("Borrador sin guardar");
  await expect(input).toBeFocused();
  let scanned = false;
  expect(
    await accessibilityViolations(page, async () => {
      scanned = true;
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      try {
        // T154: the real notification must stay readable throughout a modal audit.
        await page.clock.runFor(5_000);
        await expect(notification).toBeVisible();
        await expect(dialog).toBeVisible();
        await expect(input).toBeFocused();
        await expect(input).toHaveValue("Borrador sin guardar");
      } finally {
        await page.clock.resume();
      }
    }),
  ).toEqual([]);
  expect(scanned).toBe(true);
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  // Cleanup must not close the modal or leave the real notification paused forever.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  try {
    await page.clock.runFor(5_000);
    await expect(notification).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("Borrador sin guardar");
  } finally {
    await page.clock.resume();
  }
});

test("restores a collapsed notification stack when focus was already inside it (T154)", async ({
  ownerPage: page,
}) => {
  const run = unique();
  await page.clock.install();
  await createAccount(page, `Foco ${run}`, `foco${run}@example.com`, "Coordinador de despacho");
  const notification = page.getByText(`Cuenta de Foco ${run} creada`, { exact: true });
  const toast = page.locator("[data-sonner-toast]");
  const stack = page.locator("[data-sonner-toaster]");
  await expect(notification).toBeVisible();
  await stack.focus();
  await expect(stack).toBeFocused();
  await expect(toast).toHaveAttribute("data-expanded", "false");
  expect(await accessibilityViolations(page)).toEqual([]);
  await expect(stack).toBeFocused();
  await expect(toast).toHaveAttribute("data-expanded", "false");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  try {
    await page.clock.runFor(5_000);
    await expect(notification).toHaveCount(0);
  } finally {
    await page.clock.resume();
  }
});

test("restores modal focus and expiry when scan preparation fails (T154)", async ({
  ownerPage: page,
}) => {
  const run = unique();
  await page.clock.install();
  await createAccount(
    page,
    `Limpieza ${run}`,
    `limpieza${run}@example.com`,
    "Coordinador de despacho",
  );
  const notification = page.getByText(`Cuenta de Limpieza ${run} creada`, { exact: true });
  await expect(notification).toBeVisible();
  await page.getByRole("button", { name: "Nueva cuenta" }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByLabel("Nombre");
  await input.fill("Borrador conservado");
  await expect(
    accessibilityViolations(page, () =>
      Promise.reject(new Error("Synthetic scanner interruption")),
    ),
  ).rejects.toThrow("Synthetic scanner interruption");
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Borrador conservado");
  await expect(page.locator("[data-sonner-toast][data-expanded=true]")).toHaveCount(0);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  try {
    await page.clock.runFor(5_000);
    await expect(notification).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();
  } finally {
    await page.clock.resume();
  }
});

test("keeps alertdialog focus during a notification scan and normal expiry afterward (T154)", async ({
  ownerPage: page,
}) => {
  const run = unique();
  const email = `confirmacion${run}@example.com`;
  await page.clock.install();
  await createAccount(page, `Confirmación ${run}`, email, "Coordinador de despacho");
  const notification = page.getByText(`Cuenta de Confirmación ${run} creada`, { exact: true });
  await expect(notification).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: email })
    .getByRole("button", { name: "Desactivar", exact: true })
    .click();
  const dialog = page.getByRole("alertdialog");
  const cancel = dialog.getByRole("button", { name: "Volver", exact: true });
  await cancel.focus();
  expect(
    await accessibilityViolations(page, async () => {
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      try {
        await page.clock.runFor(5_000);
        await expect(notification).toBeVisible();
        await expect(dialog).toBeVisible();
        await expect(cancel).toBeFocused();
      } finally {
        await page.clock.resume();
      }
    }),
  ).toEqual([]);
  await expect(dialog).toBeVisible();
  await expect(cancel).toBeFocused();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  try {
    await page.clock.runFor(5_000);
    await expect(notification).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(cancel).toBeFocused();
  } finally {
    await page.clock.resume();
  }
});

test("handles native notification expiry before a modal scan can pause it (T154)", async ({
  ownerPage: page,
}) => {
  const run = unique();
  await page.clock.install();
  await createAccount(
    page,
    `Caduca modal ${run}`,
    `caducamodal${run}@example.com`,
    "Coordinador de despacho",
  );
  const notification = page.getByText(`Cuenta de Caduca modal ${run} creada`, { exact: true });
  await expect(notification).toBeVisible();
  await page.getByRole("button", { name: "Nueva cuenta" }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByLabel("Nombre");
  await input.fill("Borrador vigente");
  let expired = false;
  expect(
    await accessibilityViolations(
      page,
      async () => {
        expect(expired).toBe(true);
        await expect(notification).toHaveCount(0);
        await expect(input).toBeFocused();
      },
      async () => {
        await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
        try {
          await page.clock.runFor(5_000);
          await expect(notification).toHaveCount(0);
          expired = true;
        } finally {
          await page.clock.resume();
        }
      },
    ),
  ).toEqual([]);
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Borrador vigente");
});

test("locks sign-in after five failures and says when to retry (scenario 14)", async ({
  ownerPage,
  browser,
  setServerNow,
}) => {
  const timeFormat = new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });

  const baselineInstant = "2026-10-01T15:00:00.000Z";
  await setServerNow(baselineInstant);

  const run = unique();
  await createAccount(
    ownerPage,
    `Bloqueo ${run}`,
    `bloqueo${run}@example.com`,
    "Coordinador de despacho",
  );
  const page = await signInAs(browser, `bloqueo${run}@example.com`, "equivocada");
  for (let i = 1; i < 4; i++) {
    await expect(page.getByText("El correo o la contraseña no son correctos.")).toBeVisible();
    await page.getByRole("button", { name: "Ingresar" }).click();
  }
  await expect(page.getByText("El correo o la contraseña no son correctos.")).toBeVisible();

  const lockResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/auth/sign-in/email") && response.status() === 423,
  );
  await page.getByRole("button", { name: "Ingresar" }).click();
  const lockResponse = await lockResponsePromise;
  const lockBody = (await lockResponse.json()) as {
    error: { code: string; retryAt: string; message: string };
  };
  expect(lockBody.error.code).toBe("account_locked");

  const retryAt = new Date(lockBody.error.retryAt);
  const lockDurationMs = retryAt.getTime() - Date.parse(baselineInstant);
  expect(lockDurationMs).toBeGreaterThanOrEqual(15 * 60 * 1000);
  expect(lockDurationMs).toBeLessThanOrEqual(15 * 60 * 1000 + 10_000);

  const formattedTime = timeFormat.format(retryAt);
  await expect(
    page.getByText(
      new RegExp(`Podrás ingresar de nuevo a las ${formattedTime.replace(".", "\\.")}`),
    ),
  ).toBeVisible();

  // Rollover across minute boundaries: baseline at 10:01 calculates retry at 10:16.
  const rolloverInstant = "2026-10-01T15:01:15.000Z";
  await setServerNow(rolloverInstant);

  const run2 = `${unique()}b`;
  await createAccount(
    ownerPage,
    `Bloqueo Rollover ${run2}`,
    `bloqueo${run2}@example.com`,
    "Coordinador de despacho",
  );
  const page2 = await signInAs(browser, `bloqueo${run2}@example.com`, "equivocada");
  for (let i = 1; i < 4; i++) {
    await expect(page2.getByText("El correo o la contraseña no son correctos.")).toBeVisible();
    await page2.getByRole("button", { name: "Ingresar" }).click();
  }
  await expect(page2.getByText("El correo o la contraseña no son correctos.")).toBeVisible();

  const rolloverResponsePromise = page2.waitForResponse(
    (response) => response.url().includes("/api/auth/sign-in/email") && response.status() === 423,
  );
  await page2.getByRole("button", { name: "Ingresar" }).click();
  const rolloverResponse = await rolloverResponsePromise;
  const rolloverBody = (await rolloverResponse.json()) as {
    error: { code: string; retryAt: string; message: string };
  };
  expect(rolloverBody.error.code).toBe("account_locked");

  const rolloverRetryAt = new Date(rolloverBody.error.retryAt);
  const rolloverDurationMs = rolloverRetryAt.getTime() - Date.parse(rolloverInstant);
  expect(rolloverDurationMs).toBeGreaterThanOrEqual(15 * 60 * 1000);
  expect(rolloverDurationMs).toBeLessThanOrEqual(15 * 60 * 1000 + 10_000);

  const rolloverFormattedTime = timeFormat.format(rolloverRetryAt);
  expect(rolloverFormattedTime).toMatch(/10:16/);
  await expect(
    page2.getByText(
      new RegExp(`Podrás ingresar de nuevo a las ${rolloverFormattedTime.replace(".", "\\.")}`),
    ),
  ).toBeVisible();
});

test("refuses to deactivate the only owner (scenario 17)", async ({ ownerPage: page }) => {
  await page.goto("/usuarios");
  const row = page.getByRole("row").filter({ hasText: "propietario@example.com" });
  await row.getByRole("button", { name: "Desactivar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Desactivar cuenta" }).click();
  await expect(page.getByText("Debe quedar al menos un propietario activo.")).toBeVisible();
  await expect(row).toContainText("Activa");
});

test("recovers access with the emailed link", async ({ ownerPage, browser }) => {
  const run = unique();
  const email = `recupera${run}@example.com`;
  await createAccount(ownerPage, `Recupera ${run}`, email, "Coordinador de despacho");

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/ingresar");
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
  await expect(page.getByRole("heading", { name: "Recuperar contraseña" })).toBeVisible();
  await page.getByLabel("Correo").fill(email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByText(/Si el correo está registrado, te enviamos un enlace/)).toBeVisible();

  const emails = (await (
    await fetch(`http://localhost:${String(apiPort)}/api/test/emails`)
  ).json()) as {
    items: { email: string; url: string }[];
  };
  const link = emails.items.findLast((item) => item.email === email)?.url ?? "";
  await page.goto(link);
  await expect(page).toHaveURL(/\/restablecer\?token=/);
  await page.getByLabel("Nueva contraseña").fill("contrasena-renovada");
  await page.getByLabel("Repite la contraseña").fill("contrasena-renovada");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText("Tu contraseña se actualizó.")).toBeVisible();

  const signedIn = await signInAs(browser, email, "contrasena-renovada");
  await expect(signedIn.getByRole("heading", { name: "Tablero de despacho" })).toBeVisible();
});
