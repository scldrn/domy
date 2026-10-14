import type { UserRole } from "@domy/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "./setup/app.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
const cookies = {} as Record<UserRole, string>;

beforeAll(async () => {
  database = await startDatabase();
  t = createTestApp(database.db);
  for (const role of ["owner", "dispatcher", "courier"] as const) {
    cookies[role] = (await t.signIn(role)).cookie;
  }
});
afterAll(async () => {
  await database.stop();
});

const id = crypto.randomUUID();
const office: UserRole[] = ["owner", "dispatcher"];
const owner: UserRole[] = ["owner"];

/** Every endpoint of the contracts with the roles of 001 FR-031 and 002 FR-023. */
const endpoints: [method: string, path: string, allowed: UserRole[]][] = [
  ["GET", "/api/shipments/board", office],
  ["GET", "/api/shipments/search", office],
  ["GET", "/api/shipments/export?format=csv", owner],
  ["GET", `/api/shipments?trackingNumber=ABCD1234`, office],
  ["GET", `/api/shipments/${id}`, office],
  ["GET", `/api/shipments/duplicates?merchantId=${id}&serviceDate=2026-10-01`, office],
  ["POST", "/api/shipments", office],
  ["POST", "/api/shipments/fee-quote", office],
  ["PATCH", `/api/shipments/${id}`, office],
  ["POST", `/api/shipments/${id}/void`, office],
  ["POST", `/api/shipments/${id}/confirm-fee`, owner],
  ["POST", "/api/bulk/preview", office],
  ["POST", "/api/bulk/confirm", office],
  ["GET", "/api/merchants", office],
  ["POST", "/api/merchants", office],
  ["GET", `/api/merchants/${id}`, office],
  ["PATCH", `/api/merchants/${id}`, office],
  ["GET", `/api/merchants/${id}/pickup-points`, office],
  ["POST", `/api/merchants/${id}/pickup-points`, office],
  ["GET", `/api/merchants/${id}/recipients`, office],
  ["PATCH", `/api/pickup-points/${id}`, office],
  ["GET", "/api/couriers", office],
  ["POST", "/api/couriers", office],
  ["PATCH", `/api/couriers/${id}`, office],
  ["GET", "/api/carriers", office],
  ["POST", "/api/carriers", office],
  ["PATCH", `/api/carriers/${id}`, office],
  ["GET", "/api/neighborhoods", office],
  ["POST", "/api/neighborhoods", office],
  ["GET", `/api/neighborhoods/${id}`, office],
  ["PATCH", `/api/neighborhoods/${id}`, office],
  ["GET", "/api/municipalities", office],
  ["GET", "/api/rate-zones", office],
  ["POST", "/api/rate-zones", owner],
  ["PATCH", `/api/rate-zones/${id}`, owner],
  ["GET", "/api/rate-card", office],
  ["GET", "/api/rate-card/history", owner],
  ["POST", "/api/rate-card/entries", owner],
  ["GET", "/api/audit-events", owner],
  ["GET", "/api/export/merchants?format=csv", owner],
  ["GET", "/api/auth/admin/list-users", owner],
  // Routes and dispatch (feature 002, FR-023): the office only; couriers get their own
  // routes through feature 003.
  ["GET", "/api/shipments/unassigned?date=2026-10-01", office],
  ["GET", "/api/routes/board?date=2026-10-01", office],
  ["POST", "/api/routes", office],
  ["GET", `/api/routes/${id}`, office],
  ["PATCH", `/api/routes/${id}`, office],
  ["PUT", `/api/routes/${id}/stop-order`, office],
  ["POST", `/api/routes/${id}/shipments`, office],
  ["POST", `/api/routes/${id}/shipments/${id}/remove`, office],
  ["POST", `/api/routes/${id}/dispatch`, office],
  ["POST", `/api/routes/${id}/undo-dispatch`, office],
  ["POST", `/api/routes/${id}/cancel`, office],
  ["POST", `/api/routes/${id}/reassign`, office],
  ["POST", `/api/shipments/${id}/reassign`, office],
  ["POST", `/api/handovers/${id}/confirm`, office],
  ["POST", `/api/handovers/${id}/cancel`, office],
];

describe("permissions by role (FR-031)", () => {
  it.each(endpoints)("%s %s", async (method, path, allowed) => {
    for (const role of ["owner", "dispatcher", "courier"] as const) {
      const response = await t.request(path, {
        method,
        cookie: cookies[role],
        ...(method === "GET" ? {} : { body: {} }),
      });
      if (allowed.includes(role)) {
        expect([401, 403], `${role} ${String(response.status)}`).not.toContain(response.status);
      } else {
        expect(response.status, role).toBe(403);
      }
    }
  });

  it("refuses requests without a session", async () => {
    for (const [method, path] of endpoints) {
      const response = await t.request(path, { method, ...(method === "GET" ? {} : { body: {} }) });
      expect([401, 403], `${method} ${path}`).toContain(response.status);
    }
  });

  it("has no delete endpoints: records are deactivated or voided (FR-017)", () => {
    expect(t.app.routes.filter((route) => route.method === "DELETE")).toEqual([]);
  });
});
