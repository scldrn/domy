import type { Courier } from "@domy/domain";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditEvents, couriers } from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { send } from "./setup/routes.ts";

let database: TestDatabase;
let t: ReturnType<typeof createTestApp>;
let owner: { cookie: string };

beforeAll(async () => {
  database = await startDatabase();
});
afterAll(async () => {
  await database.stop();
});
beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db);
  owner = await t.signIn("owner");
});

async function courier(name: string): Promise<string> {
  const id = crypto.randomUUID();
  const created = await send(t, owner.cookie, "/api/couriers", {
    id,
    name,
    phone: "3004445566",
    aliases: [],
  });
  expect(created.status).toBe(201);
  return id;
}

type Failure = { error: { code: string; message: string } };

function link(userId: string, courierId: string | null, actionId = crypto.randomUUID()) {
  return send<{ courier: Courier | null } & Partial<Failure>>(
    t,
    owner.cookie,
    `/api/couriers/accounts/${userId}`,
    { actionId, courierId },
    "PUT",
  );
}

const linkedUser = async (courierId: string) =>
  (await database.db.select().from(couriers).where(eq(couriers.id, courierId)))[0]?.userId;

/** The courier's audit events that changed its account. */
const auditOf = async (courierId: string) =>
  (
    await database.db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.entityType, "courier"), eq(auditEvents.entityId, courierId)))
      .orderBy(auditEvents.id)
  ).filter((event) => Object.hasOwn(event.changes ?? {}, "userId"));

/** Linking a courier account to its courier (feature 003, FR-002, tasks.md T094). */
describe("PUT /api/couriers/accounts/:userId", () => {
  it("links a courier account, which then reaches the courier app", async () => {
    const carlos = await courier("Carlos Pérez");
    const account = await t.signIn("courier", { name: "Carlos Pérez" });

    const result = await link(account.user.id, carlos);

    expect(result.status).toBe(200);
    expect(result.body.courier).toMatchObject({
      id: carlos,
      account: { id: account.user.id, email: account.email },
    });
    const listed = await send<{ items: Courier[] }>(t, owner.cookie, "/api/couriers");
    expect(listed.body.items[0]?.account).toEqual({ id: account.user.id, email: account.email });
    expect((await send(t, account.cookie, "/api/courier/route")).status).toBe(200);
    expect(await auditOf(carlos)).toEqual([
      expect.objectContaining({
        action: "updated",
        changes: { userId: [null, account.user.id] },
      }),
    ]);
  });

  it("applies an action once, however many times it is sent", async () => {
    const carlos = await courier("Carlos Pérez");
    const account = await t.signIn("courier");
    const actionId = crypto.randomUUID();
    await link(account.user.id, carlos, actionId);
    await link(account.user.id, null);
    expect((await link(account.user.id, carlos, actionId)).status).toBe(200);
    expect(await linkedUser(carlos)).toBeNull();
    expect(await auditOf(carlos)).toHaveLength(2);
  });

  it("moves an account to another courier, and replaces a courier's account, at once", async () => {
    const carlos = await courier("Carlos Pérez");
    const diana = await courier("Diana Ruiz");
    const first = await t.signIn("courier");
    const second = await t.signIn("courier");
    await link(first.user.id, carlos);
    await link(second.user.id, diana);

    // The first account moves to Diana, whose account is replaced.
    expect((await link(first.user.id, diana)).status).toBe(200);

    expect(await linkedUser(carlos)).toBeNull();
    expect(await linkedUser(diana)).toBe(first.user.id);
    expect((await auditOf(carlos)).at(-1)?.changes).toEqual({ userId: [first.user.id, null] });
    expect((await auditOf(diana)).at(-1)?.changes).toEqual({
      userId: [second.user.id, first.user.id],
    });
    expect((await send(t, second.cookie, "/api/courier/route")).status).toBe(403);
  });

  it("unlinks: the courier app then says the account is not linked", async () => {
    const carlos = await courier("Carlos Pérez");
    const account = await t.signIn("courier");
    await link(account.user.id, carlos);

    const result = await link(account.user.id, null);

    expect(result.status).toBe(200);
    expect(result.body.courier).toBeNull();
    expect(await linkedUser(carlos)).toBeNull();
    const refused = await send<Failure>(t, account.cookie, "/api/courier/route");
    expect(refused.body.error.message).toBe(
      "Tu cuenta no está vinculada a un mensajero. Pide al propietario que la vincule.",
    );
  });

  it("links only an active account with the courier role, to an active courier", async () => {
    const carlos = await courier("Carlos Pérez");
    const dispatcher = await t.signIn("dispatcher");
    const notCourier = await link(dispatcher.user.id, carlos);
    expect(notCourier.status).toBe(409);
    expect(notCourier.body.error).toEqual({
      code: "courier_account_invalid",
      message: "Solo se vincula una cuenta activa con rol Mensajero.",
    });

    const banned = await t.signIn("courier");
    await send(t, owner.cookie, "/api/auth/admin/ban-user", { userId: banned.user.id });
    expect((await link(banned.user.id, carlos)).status).toBe(409);

    const account = await t.signIn("courier");
    await send(
      t,
      owner.cookie,
      `/api/couriers/${carlos}`,
      { actionId: crypto.randomUUID(), isActive: false },
      "PATCH",
    );
    const inactive = await link(account.user.id, carlos);
    expect(inactive.status).toBe(409);
    expect(inactive.body.error?.message).toBe(
      "Ese mensajero está desactivado; reactívalo antes de vincular una cuenta.",
    );

    expect((await link(crypto.randomUUID(), carlos)).status).toBe(404);
    expect((await link(account.user.id, crypto.randomUUID())).status).toBe(404);
  });

  it("is for the owner only: linking decides which routes an account sees", async () => {
    const carlos = await courier("Carlos Pérez");
    const account = await t.signIn("courier");
    const dispatcher = await t.signIn("dispatcher");
    const result = await send(
      t,
      dispatcher.cookie,
      `/api/couriers/accounts/${account.user.id}`,
      { actionId: crypto.randomUUID(), courierId: carlos },
      "PUT",
    );
    expect(result.status).toBe(403);
  });
});

describe("the role of a linked account", () => {
  it("cannot change until the account is unlinked, so no other role sees a route", async () => {
    const carlos = await courier("Carlos Pérez");
    const account = await t.signIn("courier");
    await link(account.user.id, carlos);

    const refused = await send<Failure>(t, owner.cookie, "/api/auth/admin/set-role", {
      userId: account.user.id,
      role: "dispatcher",
    });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("courier_account_linked");

    await link(account.user.id, null);
    const changed = await send(t, owner.cookie, "/api/auth/admin/set-role", {
      userId: account.user.id,
      role: "dispatcher",
    });
    expect(changed.status).toBe(200);
  });
});
