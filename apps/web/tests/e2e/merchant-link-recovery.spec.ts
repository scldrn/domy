import { z } from "zod";
import { accessibilityViolations, expect, test } from "./fixtures";

const actionInputSchema = z.object({ actionId: z.uuid() });
const linkCodeSchema = z.object({ linkCode: z.string().regex(/^[A-Za-z0-9_-]{22}$/u) });
const uncertainNotice = "No pudimos confirmar si el enlace cambió. Reintenta para comprobarlo.";

test("recovers an uncertain link replacement with the same action after closing the dialog", async ({
  ownerPage: page,
}) => {
  test.setTimeout(120_000);
  const merchantId = crypto.randomUUID();
  const name = `Cliente recovery ${crypto.randomUUID().slice(0, 8)}`;
  const created = await page.request.post("/api/merchants", { data: { id: merchantId, name } });
  expect(created.status()).toBe(201);

  const detail = await page.request.get(`/api/merchants/${merchantId}`);
  expect(detail.ok()).toBe(true);
  const originalCode = linkCodeSchema.parse(await detail.json()).linkCode;
  const committedCodes: string[] = [];
  const actionIds: string[] = [];

  await page.goto(`/clientes/${merchantId}`);
  await expect(page.getByRole("heading", { name: "Enlace del cliente" })).toBeVisible();
  await page.route(`**/api/merchants/${merchantId}/replace-link`, async (route) => {
    const parsedAction = actionInputSchema.safeParse(route.request().postDataJSON());
    if (!parsedAction.success) {
      await route.abort();
      throw new Error("The replacement request did not include a valid action ID");
    }
    actionIds.push(parsedAction.data.actionId);

    if (actionIds.length === 1) {
      const realResponse = await route.fetch();
      expect(realResponse.status()).toBe(200);
      const committedCode = linkCodeSchema.parse(await realResponse.json()).linkCode;
      committedCodes.push(committedCode);
      expect(committedCode === originalCode).toBe(false);
      await route.abort("failed");
      return;
    }

    await route.continue();
  });

  await page.getByRole("button", { name: "Reemplazar enlace", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Reemplazar enlace", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);

  await dialog.getByRole("button", { name: "Volver", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(uncertainNotice, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar enlace del cliente" })).toBeDisabled();
  const recoveryButton = page.getByRole("button", { name: "Reintentar reemplazo", exact: true });
  await expect(recoveryButton).toBeVisible();
  await expect(recoveryButton).toBeEnabled();
  expect(actionIds).toHaveLength(1);
  expect(await accessibilityViolations(page)).toEqual([]);

  await recoveryButton.click();
  const retryDialog = page.getByRole("alertdialog");
  await expect(retryDialog).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(retryDialog).toHaveCount(0);
  await expect(recoveryButton).toBeFocused();
  expect(actionIds).toHaveLength(1);

  await recoveryButton.click();
  await expect(retryDialog).toBeVisible();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/api/merchants/${merchantId}/replace-link`,
  );
  await retryDialog.getByRole("button", { name: "Reintentar reemplazo", exact: true }).click();
  const retryResponse = await responsePromise;
  expect(retryResponse.status()).toBe(200);
  const replayCode = linkCodeSchema.parse(await retryResponse.json()).linkCode;
  const firstCommittedCode = committedCodes[0];
  if (!firstCommittedCode) throw new Error("The first rotation did not reach the server");
  expect(actionIds).toHaveLength(2);
  expect(actionIds[0] === actionIds[1]).toBe(true);
  expect(replayCode === firstCommittedCode).toBe(true);
  await expect(retryDialog).toHaveCount(0);
  await expect(page.getByText(uncertainNotice, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copiar enlace del cliente" })).toBeEnabled();

  const currentDetail = await page.request.get(`/api/merchants/${merchantId}`);
  expect(currentDetail.ok()).toBe(true);
  const currentCode = linkCodeSchema.parse(await currentDetail.json()).linkCode;
  expect(currentCode === replayCode).toBe(true);
  const oldPublicPage = await page.request.get(`/api/public/merchant/${originalCode}`);
  const currentPublicPage = await page.request.get(`/api/public/merchant/${currentCode}`);
  expect(oldPublicPage.status()).toBe(404);
  expect(currentPublicPage.status()).toBe(200);
});
