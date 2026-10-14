import type { CourierSnapshot } from "@domy/domain";
import type { Db } from "../../src/db/client.ts";
import { couriers } from "../../src/db/schema/index.ts";
import type { createTestApp } from "./app.ts";
import { send } from "./routes.ts";

/** Courier app helpers for integration tests (feature 003). */

type TestApp = ReturnType<typeof createTestApp>;

export type CourierAccount = { id: string; userId: string; name: string; cookie: string };

/** A courier with a signed-in account, as the courier app has (FR-001, FR-002). */
export async function courierWithAccount(
  t: TestApp,
  db: Db,
  name = "Ana Ruiz",
): Promise<CourierAccount> {
  const { user, cookie } = await t.signIn("courier", { name });
  const id = crypto.randomUUID();
  await db.insert(couriers).values({ id, name, phone: "3004445566", userId: user.id });
  return { id, userId: user.id, name, cookie };
}

export function snapshot(t: TestApp, courier: { cookie: string }) {
  return send<CourierSnapshot>(t, courier.cookie, "/api/courier/route");
}

/** Sends records as the phone does, with the phone's clock equal to the server's by default. */
export function sendRecords(
  t: TestApp,
  courier: { cookie: string },
  records: Record<string, unknown>[],
  deviceNow = t.now().toISOString(),
) {
  return send<{ results: { id: string; outcome: string }[] }>(
    t,
    courier.cookie,
    "/api/courier/records",
    {
      deviceNow,
      records: records.map((record) => ({
        id: crypto.randomUUID(),
        occurredAt: deviceNow,
        ...record,
      })),
    },
  );
}
