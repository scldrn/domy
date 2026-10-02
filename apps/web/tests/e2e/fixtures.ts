import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { apiPort } from "./ports";

type Role = "owner" | "dispatcher" | "courier";

const authFile = (role: Role) => new URL(`.auth/${role}.json`, import.meta.url).pathname;

/** WCAG 2.2 AA violations of the page as it is now (FR-034). */
export async function accessibilityViolations(page: Page): Promise<string[]> {
  // Dialogs and snackbars fade in and out: measure contrast once their animations end.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .every((animation) => animation.playState !== "running"),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // Base UI's invisible focus guards around popups take role="button" only in Safari, so
    // VoiceOver can move past them; they are never shown or named, by design.
    .exclude("[data-base-ui-focus-guard]")
    .analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => `${node.target.join(" ")} ${node.failureSummary ?? ""} ${node.html.slice(0, 160)}`).join("; ")})`,
  );
}

/**
 * A page signed in as a role. When the test passed, the screen it ended on is checked for
 * accessibility, so every end-to-end scenario also checks its screens.
 */
async function rolePage(browser: Browser, role: Role, use: (page: Page) => Promise<void>) {
  const context = await browser.newContext({ storageState: authFile(role) });
  const page = await context.newPage();
  await use(page);
  const info = test.info();
  if (info.status === info.expectedStatus && !page.isClosed() && page.url().startsWith("http")) {
    expect(await accessibilityViolations(page), `accessibility of ${page.url()}`).toEqual([]);
  }
  await context.close();
}

/** Pages signed in as each role, and control of the server's clock. */
export const test = base.extend<{
  ownerPage: Page;
  dispatcherPage: Page;
  courierPage: Page;
  setServerNow: (instant: string) => Promise<void>;
}>({
  ownerPage: async ({ browser }, use) => {
    await rolePage(browser, "owner", use);
  },
  dispatcherPage: async ({ browser }, use) => {
    await rolePage(browser, "dispatcher", use);
  },
  courierPage: async ({ browser }, use) => {
    await rolePage(browser, "courier", use);
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

export { expect };
