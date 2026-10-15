import { type CourierRecord } from "@domy/domain";
import { register } from "./api";
import { accessibilityViolations, expect, test } from "./fixtures";
import { ownSession, dispatch, workerControls, openStop, deliver } from "./courier";

/** US2 T043: real app shell, IndexedDB, API, PostgreSQL, and photos (scenarios 8–10, 21). */
test("reopens offline, keeps records and photos, and retries a response lost after commit exactly once", async ({
  courierPage: page,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  test.setTimeout(90_000);
  const account = await ownSession(page, owner);
  const shipment = await register(office, { recipientAddress: "Calle 14 # 40-04" });
  const route = await dispatch(office, shipment, account.courierId);
  await page.goto("/mensajero");
  await expect(page.getByRole("heading", { name: `Ruta ${String(route.number)}` })).toBeVisible();
  await workerControls(page);
  await page.context().setOffline(true);
  await page.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  await page.getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(page.getByText("Recogido", { exact: true })).toBeVisible();
  await openStop(page, "Calle 14 # 40-04");
  await deliver(page, true);
  await expect(page.getByText("Entregado", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Pendientes/ }).click();
  await expect(
    page.getByRole("list", { name: "Registros pendientes" }).getByRole("listitem"),
  ).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Pendientes/ })).toContainText("2 · 1 foto");
  // Collapsed notification cards hide their actions; expand through the accessible shortcut.
  await page.keyboard.press("Alt+t");
  // The accessibility helper waits for finite animations before measuring the screen.
  expect(await accessibilityViolations(page)).toEqual([]);
  const retryTarget = await page
    .getByRole("button", { name: "Reintentar", exact: true })
    .boundingBox();
  expect(retryTarget?.height).toBeGreaterThanOrEqual(48);
  expect(retryTarget?.width).toBeGreaterThanOrEqual(48);
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).first().click();
  await expect(page.getByText(/Tienes .*pendientes.*sincronizar/)).toBeVisible();
  await expect(page).toHaveURL(/mensajero\/pendientes/);

  const reopened = await page.context().newPage();
  await page.close();
  const started = performance.now();
  await reopened.goto("/mensajero");
  await expect(
    reopened.getByRole("heading", { name: `Ruta ${String(route.number)}` }),
  ).toBeVisible();
  expect(performance.now() - started).toBeLessThan(3000);
  await reopened.getByRole("link", { name: /Pendientes/ }).click();
  await expect(
    reopened.getByRole("list", { name: "Registros pendientes" }).getByRole("listitem"),
  ).toHaveCount(2);

  let lost = false;
  await reopened.route("**/api/courier/records", async (request) => {
    if (!lost) {
      expect((await request.fetch()).ok()).toBe(true);
      lost = true;
      await request.abort("failed");
    } else await request.continue();
  });
  await reopened.context().setOffline(false);
  await expect.poll(() => lost).toBe(true);
  await expect(
    reopened.getByRole("list", { name: "Registros pendientes" }).getByRole("listitem"),
  ).toHaveCount(2);
  await reopened.context().setOffline(true);
  await reopened.context().setOffline(false);
  await expect(reopened.getByText("No tienes registros pendientes")).toBeVisible({
    timeout: 60_000,
  });
  await expect(reopened.getByRole("list", { name: "Fotos pendientes" })).not.toBeVisible();
  await expect(reopened.getByText("Pendientes sincronizados.", { exact: true })).toBeVisible();

  const detail = await office.request.get(`/api/shipments/${shipment.id}`);
  const records = ((await detail.json()) as { records: CourierRecord[] }).records;
  expect(records.filter((record) => record.kind === "pickup")).toHaveLength(1);
  expect(records.filter((record) => record.kind === "delivery")).toHaveLength(1);
  await office.goto(`/envios/${shipment.trackingNumber}`);
  await expect(office.getByRole("region", { name: "Registros del mensajero" })).toContainText(
    "Recibió",
  );
  await expect(office.getByRole("img", { name: "Prueba de entrega" })).toBeVisible();
  expect(await accessibilityViolations(reopened)).toEqual([]);
  await reopened.getByRole("button", { name: "Cerrar sesión", exact: true }).first().click();
  await expect(reopened).toHaveURL(/ingresar/);
  const stored = await reopened.evaluate(async () => {
    const request = indexedDB.open("domy-mensajero");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("Could not open the test database"));
      };
    });
    const sizes = await Promise.all(
      ["outbox", "photos", "snapshot", "meta"].map(
        (name) =>
          new Promise<number>((resolve, reject) => {
            const count = database.transaction(name).objectStore(name).count();
            count.onsuccess = () => {
              resolve(count.result);
            };
            count.onerror = () => {
              reject(count.error ?? new Error("Could not read the test database"));
            };
          }),
      ),
    );
    database.close();
    return sizes;
  });
  expect(stored).toEqual([0, 0, 0, 0]);
  await reopened.close();
});

test("explains a first offline route load and retries when connectivity returns", async ({
  courierPage: page,
  ownerPage: owner,
}) => {
  await ownSession(page, owner);
  await page.route("**/api/courier/route", (request) => request.abort("internetdisconnected"));
  await page.goto("/mensajero");
  await expect(
    page.getByText("Tu ruta aún no se ha cargado en este teléfono.", { exact: false }),
  ).toBeVisible();
  await workerControls(page);
  await page.context().setOffline(true);
  await page.reload();
  await expect(
    page.getByText("Tu ruta aún no se ha cargado en este teléfono.", { exact: false }),
  ).toBeVisible();
  await page.unroute("**/api/courier/route");
  await page.context().setOffline(false);
  await expect(page.getByText("No tienes una ruta despachada")).toBeVisible();
});

test("keeps a loaded route usable after an expired-session response and resumes as the same courier", async ({
  courierPage: page,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  test.setTimeout(90_000);
  const account = await ownSession(page, owner);
  const shipment = await register(office, {
    recipientAddress: "Calle 15 # 40-05",
    paymentMode: "merchant_account",
    codAmount: 0,
  });
  await dispatch(office, shipment, account.courierId);
  await page.goto("/mensajero");
  await expect(page.getByRole("list", { name: "Paradas" })).toBeVisible();
  await workerControls(page);
  const serverSnapshot = await page.request.get("/api/courier/route");
  const { sessionExpiresAt } = (await serverSnapshot.json()) as { sessionExpiresAt: string };
  let expired = true;
  // Controlled auth transport: business-time overrides do not change Better Auth's clock.
  await page.route("**/api/courier/records", (request) =>
    expired
      ? request.fulfill({
          status: 401,
          headers: { date: new Date(Date.parse(sessionExpiresAt) + 1000).toUTCString() },
          json: { error: { code: "unauthenticated", message: "Inicia sesión de nuevo." } },
        })
      : request.continue(),
  );
  await page.route("**/api/auth/get-session", (request) =>
    expired ? request.fulfill({ json: null }) : request.continue(),
  );
  await page.route("**/api/auth/sign-in/email", async (request) => {
    expired = false;
    await request.continue();
  });
  await page.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  await page.getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(page.getByText(/Tu sesión venció/)).toBeVisible();
  await openStop(page, "Calle 15 # 40-05");
  await deliver(page, false);
  await page.goto("/ingresar");
  await page.getByLabel("Correo").fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/mensajero/);
  await expect(page.getByText("No tienes una ruta despachada")).toBeVisible({ timeout: 60_000 });
});

test("keeps its cached route and pending work when the server is temporarily unavailable", async ({
  courierPage: page,
  dispatcherPage: office,
  ownerPage: owner,
}) => {
  const account = await ownSession(page, owner);
  const shipment = await register(office, {
    recipientAddress: "Calle 16 # 40-06",
    paymentMode: "merchant_account",
    codAmount: 0,
  });
  const route = await dispatch(office, shipment, account.courierId);
  await page.goto("/mensajero");
  await expect(page.getByRole("heading", { name: `Ruta ${String(route.number)}` })).toBeVisible();
  await workerControls(page);
  await page.route("**/api/**", (request) =>
    request.fulfill({ status: 503, json: { error: { message: "Servicio no disponible." } } }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: `Ruta ${String(route.number)}` })).toBeVisible();
  await page.getByRole("list", { name: "Paradas" }).getByRole("link").first().click();
  await page.getByRole("button", { name: "Confirmar recogida" }).click();
  await expect(page.getByText("Recogido", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Pendientes/ }).click();
  await expect(
    page.getByRole("list", { name: "Registros pendientes" }).getByRole("listitem"),
  ).toHaveCount(1);
  await page.unroute("**/api/**");
  await page.context().setOffline(true);
  await page.context().setOffline(false);
  await expect(page.getByText("No tienes registros pendientes")).toBeVisible();
  await openStop(page, "Calle 16 # 40-06");
  await deliver(page, false);
  await page.getByRole("link", { name: "Mi ruta", exact: true }).first().click();
  await expect(page.getByText("No tienes una ruta despachada")).toBeVisible();
});
