import { formatTrackingNumber } from "@domy/domain";
import { readFile } from "node:fs/promises";
import { readSheet } from "read-excel-file/node";
import { register } from "./api";
import { expect, test } from "./fixtures";

test("finds shipments by recipient phone, newest first, and exports them (scenario 11)", async ({
  dispatcherPage,
  ownerPage: page,
}) => {
  const phone = `31${String(Date.now()).slice(-8)}`;
  const older = await register(dispatcherPage, { recipientPhone: phone, merchantReference: "H-1" });
  await register(dispatcherPage);
  const newer = await register(dispatcherPage, { recipientPhone: phone, merchantReference: "H-2" });

  await page.goto("/historial");
  await page.getByLabel("Buscar", { exact: true }).fill(`${phone.slice(0, 3)} ${phone.slice(3)}`);
  await page.getByLabel("Buscar", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/q=/);
  const rows = page.getByRole("row").filter({ hasText: "Laura Gómez" });
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(formatTrackingNumber(newer.trackingNumber));
  await expect(rows.last()).toContainText(formatTrackingNumber(older.trackingNumber));

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar Excel" }).click();
  const file = await (await download).path();
  const sheet = await readSheet(await readFile(file));
  expect(sheet[0]?.slice(0, 3)).toEqual(["Guía", "Fecha", "Estado"]);
  expect(sheet.slice(1).map((row) => row[0])).toEqual([
    formatTrackingNumber(newer.trackingNumber),
    formatTrackingNumber(older.trackingNumber),
  ]);

  // Opening a result shows its detail and history.
  await rows.first().getByRole("link").click();
  await expect(page.getByRole("region", { name: "Historial de cambios" })).toContainText("Creado");
});

test("shows export only to the owner and filters fees to review", async ({
  dispatcherPage: page,
}) => {
  const review = await register(
    page,
    { fee: 35000, feeOverrideReason: "Tarifa de Girardota sin definir" },
    "Girardota",
  );
  await page.goto("/historial");
  await expect(page.getByRole("link", { name: "Exportar Excel" })).toHaveCount(0);
  await page.getByRole("button", { name: "Tarifa por revisar" }).click();
  await expect(page).toHaveURL(/feeReview=true/);
  await expect(
    page.getByRole("row").filter({ hasText: formatTrackingNumber(review.trackingNumber) }),
  ).toBeVisible();
  await expect(page.getByRole("row").filter({ hasNotText: "Tarifa por revisar" })).toHaveCount(1);
});
