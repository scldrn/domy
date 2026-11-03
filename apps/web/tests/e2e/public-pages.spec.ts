import type { CourierRecordInput } from "@domy/domain";
import type { Page } from "@playwright/test";
import { accessibilityViolations, expect, test } from "./fixtures";
import { workerControls } from "./courier";

const publicPages = [
  { path: "/seguimiento/t007-shell", heading: "Seguimiento de envío" },
  { path: "/cliente/t007-shell", heading: "Envíos del cliente" },
] as const;

const publicPathAliases = [
  { path: "/SEGUIMIENTO/t007-uppercase", heading: "Seguimiento de envío" },
  { path: "/%73eguimiento/t007-percent", heading: "Seguimiento de envío" },
  { path: "/CLIENTE/t007-uppercase", heading: "Envíos del cliente" },
  { path: "/%63liente/t007-percent", heading: "Envíos del cliente" },
] as const;

async function savePendingRecord(page: Page, record: CourierRecordInput): Promise<void> {
  await page.evaluate(async (input) => {
    const request = indexedDB.open("domy-mensajero");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("Could not open courier data"));
      };
    });
    try {
      const transaction = database.transaction("outbox", "readwrite");
      const saved = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
          resolve();
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Could not preserve pending courier work"));
        };
        transaction.onabort = () => {
          reject(transaction.error ?? new Error("Pending courier work was not saved"));
        };
      });
      transaction.objectStore("outbox").add({ type: "record", record: input });
      await saved;
    } finally {
      database.close();
    }
  }, record);
}

async function readCourierStorage(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("domy-mensajero");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("Could not open courier data"));
      };
    });
    try {
      const transaction = database.transaction("outbox", "readonly");
      const outbox = await new Promise<unknown[]>((resolve, reject) => {
        const count = transaction.objectStore("outbox").getAll();
        count.onsuccess = () => {
          resolve(count.result);
        };
        count.onerror = () => {
          reject(count.error ?? new Error("Could not read courier outbox"));
        };
      });
      return {
        outbox,
        cacheNames: (await caches.keys()).sort(),
        controlled: Boolean(navigator.serviceWorker.controller),
      };
    } finally {
      database.close();
    }
  });
}

test("every brand asset is served and the link preview shows only the product (FR-012)", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const html = await (await context.request.get("/")).text();
  expect(html).toContain('<meta property="og:title" content="Domy" />');
  const image = /<meta property="og:image" content="(https?:[^"]+)"/u.exec(html)?.[1];
  expect(image).toMatch(/\/icons\/link-preview\.png$/u);
  expect(html).not.toContain("__PUBLIC_BASE_URL__");

  const manifest = (await (await context.request.get("/manifest.webmanifest")).json()) as {
    icons: { src: string; purpose?: string }[];
  };
  expect(manifest.icons.map((icon) => icon.purpose)).toContain("monochrome");
  for (const path of [
    ...manifest.icons.map((icon) => icon.src),
    "/icons/favicon.svg",
    "/icons/logo.svg",
    "/icons/wordmark.svg",
    "/icons/apple-touch-icon.png",
    "/icons/link-preview.png",
  ]) {
    expect((await context.request.get(path)).status(), path).toBe(200);
  }
  await context.close();
});

test("public pages open anonymously at 320 px with no unset support actions", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 800 } });
  const headings: string[] = [];
  try {
    for (const target of publicPages) {
      const page = await context.newPage();
      const response = await page.goto(target.path);
      expect(response?.status()).toBe(200);
      headings.push((await page.locator("h1").textContent()) ?? "");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
      expect(await page.locator('a[href^="tel:"], a[href^="https://wa.me/"]').count()).toBe(0);
      expect(await accessibilityViolations(page)).toEqual([]);
      await page.close();
    }
    expect(headings).toEqual(publicPages.map((target) => target.heading));
  } finally {
    await context.close();
  }
});

test("a new public visitor does not register the courier service worker", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      Object.defineProperty(navigator.serviceWorker, "register", {
        configurable: true,
        value: (...args: [string | URL, RegistrationOptions?]) => {
          const count = Number(
            document.documentElement.dataset["workerRegistrationAttempts"] ?? "0",
          );
          document.documentElement.dataset["workerRegistrationAttempts"] = String(count + 1);
          return originalRegister(...args);
        },
      });
    });
    for (const target of [...publicPages, ...publicPathAliases]) {
      const page = await context.newPage();
      await page.goto(target.path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { name: target.heading })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.dataset["workerRegistrationAttempts"]),
      ).toBeUndefined();
      expect(
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
      ).toBe(0);
      await page.close();
    }
  } finally {
    await context.close();
  }
});

test("a controlled courier browser fetches public pages and keeps its outbox and caches", async ({
  courierPage: page,
}) => {
  await page.goto("/mensajero");
  await workerControls(page);

  // Leave the installable courier screen before adding a pending record, so its sync loop cannot
  // consume the fixture when connectivity returns for the public-page navigation.
  await page.context().clearCookies();
  await page.goto("/ingresar");
  await expect(page.getByRole("heading", { name: "Ingresar" })).toBeVisible();

  const pendingRecord: CourierRecordInput = {
    id: crypto.randomUUID(),
    shipmentId: crypto.randomUUID(),
    kind: "problem",
    occurredAt: "2026-10-22T15:00:00.000Z",
    note: "Registro pendiente de prueba",
  };
  await savePendingRecord(page, pendingRecord);
  const before = await readCourierStorage(page);
  const responsesFromServiceWorker: boolean[] = [];
  let after = before;
  for (const target of [...publicPages, ...publicPathAliases]) {
    const response = await page.goto(target.path);
    responsesFromServiceWorker.push(response?.fromServiceWorker() ?? false);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: target.heading })).toBeVisible();
    after = await readCourierStorage(page);
  }

  expect({
    responsesFromServiceWorker,
    outboxBefore: before.outbox,
    outboxAfter: after.outbox,
    cacheNamesBefore: before.cacheNames,
    cacheNamesAfter: after.cacheNames,
    stillControlled: after.controlled,
  }).toEqual({
    responsesFromServiceWorker: [false, false, false, false, false, false],
    outboxBefore: [{ type: "record", record: pendingRecord }],
    outboxAfter: [{ type: "record", record: pendingRecord }],
    cacheNamesBefore: before.cacheNames,
    cacheNamesAfter: before.cacheNames,
    stillControlled: true,
  });
});
