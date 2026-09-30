import { test as base, type Page } from "@playwright/test";
import { apiPort } from "./ports";

type Role = "owner" | "dispatcher" | "courier";

const authFile = (role: Role) => new URL(`.auth/${role}.json`, import.meta.url).pathname;

/** Pages signed in as each role, and control of the server's clock. */
export const test = base.extend<{
  ownerPage: Page;
  dispatcherPage: Page;
  courierPage: Page;
  setServerNow: (instant: string) => Promise<void>;
}>({
  ownerPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: authFile("owner") });
    await use(await context.newPage());
    await context.close();
  },
  dispatcherPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: authFile("dispatcher") });
    await use(await context.newPage());
    await context.close();
  },
  courierPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: authFile("courier") });
    await use(await context.newPage());
    await context.close();
  },
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures destructure their dependencies.
  setServerNow: async ({}, use) => {
    await use(async (instant) => {
      await fetch(`http://localhost:${String(apiPort)}/api/test/clock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ now: instant }),
      });
    });
  },
});

export { expect } from "@playwright/test";
