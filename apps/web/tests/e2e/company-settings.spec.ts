import { companySettingsInput } from "@domy/domain";
import { expect, test } from "./fixtures";

test("saves and clears support contact without changing the office", async ({ ownerPage }) => {
  await ownerPage.setViewportSize({ width: 390, height: 844 });
  await ownerPage.goto("/configuracion");

  const phone = ownerPage.getByLabel("Celular de soporte");
  const companyName = ownerPage.getByLabel("Nombre de la empresa");
  const officeAddress = ownerPage.getByLabel("Dirección de la oficina");
  const officeNeighborhood = ownerPage.getByLabel("Barrio de la oficina");
  const save = ownerPage.getByRole("button", { name: "Guardar datos de soporte" });
  await expect(phone).toBeVisible();
  await expect(companyName).toBeVisible();
  const originalPhone = await phone.inputValue();
  const originalName = await companyName.inputValue();
  const originalAddress = await officeAddress.inputValue();
  const originalNeighborhood = await officeNeighborhood.inputValue();
  let changedSettings = false;

  const saveSupport = async () => {
    const responsePromise = ownerPage.waitForResponse(
      (response) =>
        response.url().endsWith("/api/settings") && response.request().method() === "PATCH",
    );
    await save.click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    await expect(ownerPage.getByText("Configuración guardada", { exact: true })).toBeVisible();
    return companySettingsInput.parse(response.request().postDataJSON());
  };

  try {
    await phone.fill("3012345678");
    await companyName.fill("Cohex Mensajería");
    const savedInput = await saveSupport();
    changedSettings = true;
    expect(savedInput).toMatchObject({
      supportPhone: "3012345678",
      companyName: "Cohex Mensajería",
    });
    expect(savedInput).not.toHaveProperty("officeAddress");
    expect(savedInput).not.toHaveProperty("officeNeighborhoodId");

    await ownerPage.reload();
    await expect(phone).toHaveValue("3012345678");
    await expect(companyName).toHaveValue("Cohex Mensajería");
    await expect(officeAddress).toHaveValue(originalAddress);
    await expect(officeNeighborhood).toHaveValue(originalNeighborhood);

    await phone.fill("");
    const clearedInput = await saveSupport();
    expect(clearedInput.supportPhone).toBeNull();
    expect(clearedInput).not.toHaveProperty("officeAddress");
    expect(clearedInput).not.toHaveProperty("officeNeighborhoodId");

    await ownerPage.reload();
    await expect(phone).toHaveValue("");
    await expect(companyName).toHaveValue("Cohex Mensajería");
    await expect(officeAddress).toHaveValue(originalAddress);
    await expect(officeNeighborhood).toHaveValue(originalNeighborhood);
  } finally {
    if (changedSettings) {
      await ownerPage.goto("/configuracion");
      await expect(phone).toBeVisible();
      await phone.fill(originalPhone);
      await companyName.fill(originalName);
      await saveSupport();
    }
  }
});
