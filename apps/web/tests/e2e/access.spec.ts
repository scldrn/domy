import type { Browser, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { apiPort } from "./ports";

const password = "contrasena-de-prueba";
const unique = () => String(Date.now()).slice(-6);

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
  const navigation = courier.getByRole("navigation", { name: "Navegación principal" });
  await expect(navigation.getByRole("link", { name: "Mi ruta" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(navigation.getByRole("link", { name: "Mi día" })).toBeVisible();
  await courier.goto("/historial");
  await expect(courier).toHaveURL(/\/mensajero$/);
});

test("locks sign-in after five failures and says when to retry (scenario 14)", async ({
  ownerPage,
  browser,
}) => {
  const run = unique();
  await createAccount(
    ownerPage,
    `Bloqueo ${run}`,
    `bloqueo${run}@example.com`,
    "Coordinador de despacho",
  );
  const page = await signInAs(browser, `bloqueo${run}@example.com`, "equivocada");
  for (let i = 1; i < 5; i++) {
    await expect(page.getByText("El correo o la contraseña no son correctos.")).toBeVisible();
    await page.getByRole("button", { name: "Ingresar" }).click();
  }
  // The server clock is 10:00 a. m. in Bogotá.
  await expect(page.getByText(/Podrás ingresar de nuevo a las 10:15 a\. m\./)).toBeVisible();
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
