import { defineConfig, devices } from "@playwright/test";

// T152 builds isolated native reporters itself, without reading .env or starting providers.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "reporting-privacy.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { locale: "es-CO", timezoneId: "America/Bogota", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
