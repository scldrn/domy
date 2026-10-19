import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { apiPort } from "./ports";

type Role = "owner" | "dispatcher" | "courier";

const authFile = (role: Role) => new URL(`.auth/${role}.json`, import.meta.url).pathname;

/** WCAG 2.2 AA violations of the page as it is now (FR-034). */
export async function accessibilityViolations(
  page: Page,
  beforeAnalyze?: () => Promise<void>,
  beforePause?: () => Promise<void>,
): Promise<string[]> {
  const settleAnimations = () =>
    page.waitForFunction(() =>
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .every((animation) => animation.playState !== "running"),
    );
  // A closing dialog still has its role until its exit animation ends. Classify the
  // visible screen only afterward, or its background toast would escape stabilization.
  await settleAnimations();
  // T100: waiting for entrance animations alone cannot stop a dismissal during axe.
  // Sonner's native shortcut expands the stack and pauses its timer. A modal already
  // hides background notifications from the accessibility tree; never move its focus.
  const hasNotifications =
    (await page.getByRole("dialog").count()) === 0 &&
    (await page.getByRole("alertdialog").count()) === 0 &&
    (await page.locator("[data-sonner-toast]:not([data-removed=true])").count()) > 0;
  const previousFocus = hasNotifications
    ? await page.evaluateHandle(() => document.activeElement)
    : null;
  const wasInNotifications = previousFocus
    ? await previousFocus.evaluate((element) => Boolean(element?.closest("[data-sonner-toaster]")))
    : false;
  try {
    if (hasNotifications) {
      // T112: tests can advance native expiry between discovery and stabilization.
      await beforePause?.();
      // The pointer may remain where the just-closed dialog's submit button was. Keep
      // stack expansion from moving a toast away from it and firing mouseleave mid-scan.
      await page.mouse.move(0, 0);
      await page.keyboard.press("Alt+t");
      await page.waitForFunction(
        () =>
          Boolean(document.activeElement?.closest("[data-sonner-toaster]")) ||
          document.querySelector("[data-sonner-toast]:not([data-removed=true])") === null,
      );
      // Discovery and the shortcut are separate browser steps: expiry may win between them.
      // Read absence/expansion atomically; every toast still present must be stabilized.
      await expect
        .poll(() =>
          page.evaluate(() =>
            [...document.querySelectorAll("[data-sonner-toast]:not([data-removed=true])")].every(
              (toast) => toast.getAttribute("data-expanded") === "true",
            ),
          ),
        )
        .toBe(true);
    }
    await settleAnimations();
    await beforeAnalyze?.();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      // Base UI's invisible focus guards around popups take role="button" only in Safari,
      // so VoiceOver can move past them; they are never shown or named, by design.
      .exclude("[data-base-ui-focus-guard]")
      .analyze();
    return results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} (${violation.nodes.map((node) => `${node.target.join(" ")} ${node.failureSummary ?? ""} ${node.html.slice(0, 160)}`).join("; ")})`,
    );
  } finally {
    if (previousFocus) {
      if (!wasInNotifications) {
        await page.mouse.move(0, 0);
        if (
          await page.evaluate(() =>
            Boolean(document.activeElement?.closest("[data-sonner-toaster]")),
          )
        )
          await page.keyboard.press("Escape");
        await previousFocus.evaluate((element) => {
          if (element instanceof HTMLElement && element.isConnected)
            element.focus({ preventScroll: true });
        });
      }
      await previousFocus.dispose();
    }
  }
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
      await fetch(`http://127.0.0.1:${String(apiPort)}/api/test/clock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ now: instant }),
      });
    });
  },
});

export { expect };
