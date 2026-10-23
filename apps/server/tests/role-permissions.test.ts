import type { UserRole } from "@domy/domain";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  auditEvents,
  companySettings,
  courierNotices,
  courierRecords,
  merchants,
  pushSubscriptions,
  recordPhotos,
  shipmentEvents,
  shipments,
  users,
} from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction } from "./setup/routes.ts";
import { startStorage, type TestStorage } from "./setup/storage.ts";

type RoleSession = { cookie: string; userId: string; role: UserRole };

let database: TestDatabase;
let storage: TestStorage;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let sessions: Record<UserRole, RoleSession>;
let linkedCourier: CourierAccount;
let otherCourier: CourierAccount;
let unlinkedCourier: RoleSession;

beforeAll(async () => {
  [database, storage] = await Promise.all([startDatabase(), startStorage()]);
  t = createTestApp(database.db, { storage: storage.storage });

  const owner = await t.signIn("owner");
  const dispatcher = await t.signIn("dispatcher");
  catalog = await createCatalog(database.db, owner.user.id);
  linkedCourier = await courierWithAccount(t, database.db, "Ana Ruiz");
  otherCourier = await courierWithAccount(t, database.db, "Beto Gómez");
  const unlinked = await t.signIn("courier", { name: "Carla Díaz" });
  sessions = {
    owner: { cookie: owner.cookie, userId: owner.user.id, role: "owner" },
    dispatcher: {
      cookie: dispatcher.cookie,
      userId: dispatcher.user.id,
      role: "dispatcher",
    },
    courier: {
      cookie: linkedCourier.cookie,
      userId: linkedCourier.userId,
      role: "courier",
    },
  };
  unlinkedCourier = {
    cookie: unlinked.cookie,
    userId: unlinked.user.id,
    role: "courier",
  };
}, 120_000);

afterAll(async () => {
  await Promise.all([database.stop(), storage.stop()]);
});

const id = crypto.randomUUID();
const office: UserRole[] = ["owner", "dispatcher"];
const owner: UserRole[] = ["owner"];
const courier: UserRole[] = ["courier"];
const everyone: UserRole[] = ["owner", "dispatcher", "courier"];

/** Every HTTP endpoint in the feature 001–003 contracts that has a role boundary. */
const endpoints: [method: string, path: string, allowed: UserRole[]][] = [
  ["GET", "/api/shipments/board", office],
  ["GET", "/api/notifications?date=2026-10-01", office],
  ["POST", "/api/notifications", office],
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
  ["POST", `/api/merchants/${id}/replace-link`, office],
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
  ["POST", "/api/auth/admin/create-user", owner],
  ["POST", "/api/auth/admin/update-user", owner],
  ["POST", "/api/auth/admin/set-role", owner],
  ["POST", "/api/auth/admin/ban-user", owner],
  ["POST", "/api/auth/admin/unban-user", owner],
  ["POST", "/api/auth/admin/revoke-user-sessions", owner],
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
  ["POST", `/api/routes/${id}/join`, office],
  ["POST", `/api/shipments/${id}/reassign`, office],
  ["POST", `/api/handovers/${id}/confirm`, office],
  ["POST", `/api/handovers/${id}/cancel`, office],
  ["GET", "/api/courier/route", courier],
  ["GET", "/api/courier/push-config", courier],
  ["POST", "/api/courier/records", courier],
  ["PUT", `/api/courier/photos/${id}`, courier],
  ["POST", "/api/courier/notices/acknowledge", courier],
  ["POST", "/api/courier/push-subscriptions", courier],
  ["POST", "/api/courier/push-subscriptions/remove", courier],
  ["POST", `/api/shipments/${id}/records`, office],
  ["POST", `/api/shipments/${id}/exception-decision`, office],
  ["POST", `/api/shipments/${id}/office-receipt`, office],
  ["POST", `/api/shipments/${id}/clear-review`, office],
  ["POST", `/api/courier-records/${id}/correct`, office],
  ["POST", `/api/courier-records/${id}/revert`, office],
  ["GET", `/api/photos/${id}`, everyone],
  ["PUT", `/api/photos/${id}`, everyone],
  ["GET", "/api/settings", office],
  ["PATCH", "/api/settings", owner],
  ["PUT", `/api/couriers/accounts/${id}`, owner],
];

async function requestAs(
  session: RoleSession | undefined,
  path: string,
  method: string,
  body?: unknown,
): Promise<Response> {
  const nativeAdmin =
    method === "POST" &&
    /^\/api\/auth\/admin\/(?:create-user|update-user|set-role|ban-user|unban-user|revoke-user-sessions)$/.test(
      path,
    );
  const actorBoundLink = method === "PUT" && /^\/api\/couriers\/accounts\//.test(path);
  return await t.app.request(path, {
    method,
    headers: {
      ...(session && { cookie: session.cookie }),
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(nativeAdmin &&
        session?.role === "owner" && {
          origin: "http://localhost:3000",
          "X-Domy-Actor-Id": session.userId,
        }),
      ...(actorBoundLink &&
        session?.role === "owner" && {
          "X-Domy-Actor-Id": session.userId,
        }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

function nativeAdminRequest(
  session: RoleSession,
  userId: string,
  actorHeader: string | null,
  actionId = crypto.randomUUID(),
) {
  return t.app.request("/api/auth/admin/ban-user", {
    method: "POST",
    headers: {
      cookie: session.cookie,
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...(actorHeader !== null && { "X-Domy-Actor-Id": actorHeader }),
    },
    body: JSON.stringify({ actionId, userId }),
  });
}

async function merchantLinkCode(merchantId: string): Promise<string> {
  const [row] = await database.db
    .select({ linkCode: merchants.linkCode })
    .from(merchants)
    .where(eq(merchants.id, merchantId));
  if (!row) throw new Error("Expected the merchant fixture to exist");
  return row.linkCode;
}

async function notificationState(shipmentId: string) {
  const [shipment] = await database.db
    .select({ notifiedAt: shipments.notifiedAt, notifiedBy: shipments.notifiedBy })
    .from(shipments)
    .where(eq(shipments.id, shipmentId));
  if (!shipment) throw new Error("Expected the shipment fixture to exist");
  const events = await database.db
    .select({
      id: shipmentEvents.id,
      type: shipmentEvents.type,
      actorUserId: shipmentEvents.actorUserId,
    })
    .from(shipmentEvents)
    .where(eq(shipmentEvents.shipmentId, shipmentId));
  return { shipment, notifiedEvents: events.filter((event) => event.type === "notified") };
}

/** Every endpoint has a role check before its request body is interpreted. */
describe("permissions by role (FR-031, FR-002, FR-036, FR-041)", () => {
  it.each(endpoints)("%s %s", async (method, path, allowed) => {
    for (const role of ["owner", "dispatcher", "courier"] as const) {
      const response = await requestAs(
        sessions[role],
        path,
        method,
        method === "GET" ? undefined : {},
      );
      if (allowed.includes(role)) {
        expect(response.status, `${role} ${method} ${path}`).toBeLessThan(500);
        expect([401, 403], `${role} ${String(response.status)}`).not.toContain(response.status);
      } else {
        expect(response.status, role).toBe(403);
      }
    }
  });

  it("refuses requests without a session", async () => {
    for (const [method, path] of endpoints) {
      const response = await requestAs(undefined, path, method, method === "GET" ? undefined : {});
      expect([401, 403], `${method} ${path}`).toContain(response.status);
    }
  });

  it("serves every public GET anonymously and keeps public paths read-only", async () => {
    const shipment = await registerShipment(t, sessions.dispatcher.cookie, catalog);
    const route = await createRoute(t, sessions.dispatcher.cookie, {
      shipmentIds: [shipment.id],
      courierId: linkedCourier.id,
    });
    expect((await routeAction(t, sessions.dispatcher.cookie, route, "/dispatch")).status).toBe(200);

    const photoId = crypto.randomUUID();
    const records = await sendRecords(t, linkedCourier, [
      { shipmentId: shipment.id, kind: "pickup" },
      {
        shipmentId: shipment.id,
        kind: "delivery",
        receivedByName: "Laura Gómez",
        cashAmount: shipment.codAmount,
        photos: [{ id: photoId, kind: "proof" }],
      },
    ]);
    expect(records.status).toBe(200);
    const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const uploaded = await t.app.request(`/api/courier/photos/${photoId}`, {
      method: "PUT",
      headers: { cookie: linkedCourier.cookie, "content-type": "image/jpeg" },
      body: image,
    });
    expect(uploaded.status).toBe(204);

    const [shipmentCodes] = await database.db
      .select({ trackingCode: shipments.trackingCode })
      .from(shipments)
      .where(eq(shipments.id, shipment.id));
    if (!shipmentCodes) throw new Error("Expected the public shipment to exist");
    const code = await merchantLinkCode(catalog.merchant.bullish);
    const validReads = await Promise.all([
      t.app.request(`/api/public/tracking/${shipmentCodes.trackingCode}`),
      t.app.request(`/api/public/merchant/${code}?date=2026-10-01`),
      t.app.request(`/api/public/merchant/${code}/shipments/${shipment.id}`),
      t.app.request(`/api/public/merchant/${code}/photos/${photoId}`),
    ]);
    for (const response of validReads) {
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
    }
    const validPhoto = validReads[3];
    expect(new Uint8Array(await validPhoto.arrayBuffer())).toEqual(image);

    const unknownCode = randomBytes(16).toString("base64url");
    const invalidReads = await Promise.all([
      t.app.request(`/api/public/tracking/${unknownCode}`),
      t.app.request("/api/public/tracking/not-a-code"),
      t.app.request(`/api/public/merchant/${unknownCode}`),
      t.app.request("/api/public/merchant/not-a-code"),
      t.app.request(`/api/public/merchant/${unknownCode}/shipments/${shipment.id}`),
      t.app.request(`/api/public/merchant/${unknownCode}/photos/${photoId}`),
    ]);
    for (const response of invalidReads) {
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
      const body: unknown = await response.json();
      expect(z.object({ error: z.object({ code: z.string() }) }).parse(body).error.code).toBe(
        "link_not_found",
      );
    }

    const beforeShipment = await database.db
      .select({
        status: shipments.status,
        trackingCode: shipments.trackingCode,
        version: shipments.version,
      })
      .from(shipments)
      .where(eq(shipments.id, shipment.id));
    const beforeEvents = await database.db
      .select({ id: shipmentEvents.id, type: shipmentEvents.type })
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, shipment.id));
    const beforePhoto = await database.db
      .select({ uploadedAt: recordPhotos.uploadedAt })
      .from(recordPhotos)
      .where(eq(recordPhotos.id, photoId));
    const publicPaths = [
      `/api/public/tracking/${shipmentCodes.trackingCode}`,
      `/api/public/merchant/${code}`,
      `/api/public/merchant/${code}/shipments/${shipment.id}`,
      `/api/public/merchant/${code}/photos/${photoId}`,
    ];
    for (const path of publicPaths) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
        const response = await t.app.request(path, { method });
        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("x-robots-tag")).toBe("noindex");
      }
    }

    const afterShipment = await database.db
      .select({
        status: shipments.status,
        trackingCode: shipments.trackingCode,
        version: shipments.version,
      })
      .from(shipments)
      .where(eq(shipments.id, shipment.id));
    const afterEvents = await database.db
      .select({ id: shipmentEvents.id, type: shipmentEvents.type })
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, shipment.id));
    const afterPhoto = await database.db
      .select({ uploadedAt: recordPhotos.uploadedAt })
      .from(recordPhotos)
      .where(eq(recordPhotos.id, photoId));
    expect(afterShipment).toEqual(beforeShipment);
    expect(afterEvents).toEqual(beforeEvents);
    expect(afterPhoto).toEqual(beforePhoto);
    const retainedPhoto = await t.app.request(`/api/public/merchant/${code}/photos/${photoId}`);
    expect(retainedPhoto.status).toBe(200);
    expect(new Uint8Array(await retainedPhoto.arrayBuffer())).toEqual(image);
  });

  it("allows only owner and dispatcher to mark notifications and replace merchant links", async () => {
    for (const [actor, merchantId] of [
      [sessions.owner, catalog.merchant.noSurcharge],
      [sessions.dispatcher, catalog.merchant.amy],
    ] as const) {
      const list = await requestAs(actor, "/api/notifications?date=2026-10-01", "GET");
      expect(list.status).toBe(200);

      const shipment = await registerShipment(t, sessions.dispatcher.cookie, catalog);
      const marked = await requestAs(actor, "/api/notifications", "POST", {
        actionId: crypto.randomUUID(),
        shipmentIds: [shipment.id],
      });
      expect(marked.status).toBe(204);
      const markedState = await notificationState(shipment.id);
      expect(markedState.shipment.notifiedAt).not.toBeNull();
      expect(markedState.shipment.notifiedBy).toBe(actor.userId);
      expect(markedState.notifiedEvents).toHaveLength(1);
      expect(markedState.notifiedEvents[0]?.actorUserId).toBe(actor.userId);

      const previousCode = await merchantLinkCode(merchantId);
      const rotated = await t.app.request(`/api/merchants/${merchantId}/replace-link`, {
        method: "POST",
        headers: {
          cookie: actor.cookie,
          "content-type": "application/json",
          "X-Domy-Actor-Id": actor.userId,
        },
        body: JSON.stringify({ actionId: crypto.randomUUID() }),
      });
      expect(rotated.status).toBe(200);
      const response: unknown = await rotated.json();
      const responseCode = z
        .object({ linkCode: z.string().regex(/^[A-Za-z0-9_-]{22}$/u) })
        .parse(response).linkCode;
      const currentCode = await merchantLinkCode(merchantId);
      expect(currentCode === previousCode).toBe(false);
      expect(responseCode === currentCode).toBe(true);
    }

    const untouchedShipment = await registerShipment(t, sessions.dispatcher.cookie, catalog);
    const body = { actionId: crypto.randomUUID(), shipmentIds: [untouchedShipment.id] };
    const courierMark = await requestAs(sessions.courier, "/api/notifications", "POST", body);
    const anonymousMark = await requestAs(undefined, "/api/notifications", "POST", body);
    expect(courierMark.status).toBe(403);
    expect([401, 403]).toContain(anonymousMark.status);
    const untouchedState = await notificationState(untouchedShipment.id);
    expect(untouchedState.shipment.notifiedAt).toBeNull();
    expect(untouchedState.shipment.notifiedBy).toBeNull();
    expect(untouchedState.notifiedEvents).toHaveLength(0);

    const merchantId = catalog.merchant.bullish;
    const previousCode = await merchantLinkCode(merchantId);
    const beforeAudits = await database.db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.entityType, "merchant"),
          eq(auditEvents.entityId, merchantId),
          eq(auditEvents.action, "link_replaced"),
        ),
      );
    const rotationBody = { actionId: crypto.randomUUID() };
    const courierRotation = await requestAs(
      sessions.courier,
      `/api/merchants/${merchantId}/replace-link`,
      "POST",
      rotationBody,
    );
    const anonymousRotation = await requestAs(
      undefined,
      `/api/merchants/${merchantId}/replace-link`,
      "POST",
      rotationBody,
    );
    expect(courierRotation.status).toBe(403);
    expect([401, 403]).toContain(anonymousRotation.status);
    const afterAudits = await database.db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.entityType, "merchant"),
          eq(auditEvents.entityId, merchantId),
          eq(auditEvents.action, "link_replaced"),
        ),
      );
    expect((await merchantLinkCode(merchantId)) === previousCode).toBe(true);
    expect(afterAudits).toEqual(beforeAudits);
  });

  it("lets only a linked courier read their route and push config", async () => {
    const anaShipments = [
      await registerShipment(t, sessions.dispatcher.cookie, catalog),
      await registerShipment(t, sessions.dispatcher.cookie, catalog),
    ];
    const betoShipment = await registerShipment(t, sessions.dispatcher.cookie, catalog);
    const anaRoute = await createRoute(t, sessions.dispatcher.cookie, {
      shipmentIds: anaShipments.map((shipment) => shipment.id),
      courierId: linkedCourier.id,
    });
    const betoRoute = await createRoute(t, sessions.dispatcher.cookie, {
      shipmentIds: [betoShipment.id],
      courierId: otherCourier.id,
    });
    expect((await routeAction(t, sessions.dispatcher.cookie, anaRoute, "/dispatch")).status).toBe(
      200,
    );
    expect((await routeAction(t, sessions.dispatcher.cookie, betoRoute, "/dispatch")).status).toBe(
      200,
    );

    const anaSnapshot = await requestAs(sessions.courier, "/api/courier/route", "GET");
    const betoSnapshot = await requestAs(
      { cookie: otherCourier.cookie, userId: otherCourier.userId, role: "courier" },
      "/api/courier/route",
      "GET",
    );
    expect(anaSnapshot.status).toBe(200);
    expect(betoSnapshot.status).toBe(200);
    const snapshotRoute = z.object({ route: z.object({ id: z.string() }).nullable() });
    const anaBody = snapshotRoute.parse(await anaSnapshot.json());
    const betoBody = snapshotRoute.parse(await betoSnapshot.json());
    expect(anaBody.route?.id).toBe(anaRoute.id);
    expect(betoBody.route?.id).toBe(betoRoute.id);
    expect((await requestAs(sessions.courier, "/api/courier/push-config", "GET")).status).toBe(200);
    expect((await requestAs(unlinkedCourier, "/api/courier/route", "GET")).status).toBe(403);
    expect((await requestAs(unlinkedCourier, "/api/courier/push-config", "GET")).status).toBe(403);
    const unlinkedRecordId = crypto.randomUUID();
    const deviceNow = t.now().toISOString();
    const unlinkedRecord = await t.app.request("/api/courier/records", {
      method: "POST",
      headers: { cookie: unlinkedCourier.cookie, "content-type": "application/json" },
      body: JSON.stringify({
        deviceNow,
        records: [
          {
            id: unlinkedRecordId,
            shipmentId: crypto.randomUUID(),
            occurredAt: deviceNow,
            kind: "pickup",
          },
        ],
      }),
    });
    expect(unlinkedRecord.status).toBe(403);
    expect(
      await database.db
        .select()
        .from(courierRecords)
        .where(eq(courierRecords.id, unlinkedRecordId)),
    ).toEqual([]);
    const [linkedNotice] = await database.db
      .select()
      .from(courierNotices)
      .where(eq(courierNotices.courierId, linkedCourier.id));
    expect(linkedNotice).toBeDefined();
    if (!linkedNotice) throw new Error("Expected a dispatch notice for the linked courier");
    const unlinkedAcknowledgment = await requestAs(
      unlinkedCourier,
      "/api/courier/notices/acknowledge",
      "POST",
      {
        actionId: crypto.randomUUID(),
        noticeIds: [linkedNotice.id],
        occurredAt: deviceNow,
      },
    );
    expect(unlinkedAcknowledgment.status).toBe(403);
    const [unacknowledged] = await database.db
      .select()
      .from(courierNotices)
      .where(eq(courierNotices.id, linkedNotice.id));
    expect(unacknowledged).toEqual(linkedNotice);

    const linkedSubscription = {
      userId: linkedCourier.userId,
      endpoint: "https://fcm.googleapis.com/fcm/send/linked-courier",
      p256dh: "public-device-key",
      auth: "device-auth",
    };
    await database.db.insert(pushSubscriptions).values(linkedSubscription);
    const beforeSubscriptions = await database.db.select().from(pushSubscriptions);
    const newSubscription = await requestAs(
      unlinkedCourier,
      "/api/courier/push-subscriptions",
      "POST",
      {
        actionId: crypto.randomUUID(),
        endpoint: "https://fcm.googleapis.com/fcm/send/unlinked-courier",
        keys: { p256dh: "other-public-key", auth: "other-device-auth" },
      },
    );
    const removeSubscription = await requestAs(
      unlinkedCourier,
      "/api/courier/push-subscriptions/remove",
      "POST",
      { actionId: crypto.randomUUID(), endpoint: linkedSubscription.endpoint },
    );
    expect(newSubscription.status).toBe(403);
    expect(removeSubscription.status).toBe(403);
    expect(await database.db.select().from(pushSubscriptions)).toEqual(beforeSubscriptions);

    const photoId = crypto.randomUUID();
    const [photoShipment] = anaShipments;
    expect(photoShipment).toBeDefined();
    if (!photoShipment) throw new Error("Expected a shipment for the linked courier");
    const photoRecordResponse = await t.app.request("/api/courier/records", {
      method: "POST",
      headers: { cookie: linkedCourier.cookie, "content-type": "application/json" },
      body: JSON.stringify({
        deviceNow,
        records: [
          {
            id: crypto.randomUUID(),
            shipmentId: photoShipment.id,
            occurredAt: deviceNow,
            kind: "pickup",
          },
          {
            id: crypto.randomUUID(),
            shipmentId: photoShipment.id,
            occurredAt: deviceNow,
            kind: "delivery",
            receivedByName: "Laura Gómez",
            cashAmount: 50_000,
            photos: [{ id: photoId, kind: "proof" }],
          },
        ],
      }),
    });
    expect(photoRecordResponse.status).toBe(200);
    const photoUpload = await t.app.request(`/api/courier/photos/${photoId}`, {
      method: "PUT",
      headers: { cookie: unlinkedCourier.cookie, "content-type": "image/jpeg" },
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    });
    expect(photoUpload.status).toBe(403);
    const [unuploadedPhoto] = await database.db
      .select()
      .from(recordPhotos)
      .where(eq(recordPhotos.id, photoId));
    expect(unuploadedPhoto?.uploadedAt).toBeNull();
    expect((await requestAs(sessions.owner, "/api/courier/route", "GET")).status).toBe(403);
    expect((await requestAs(sessions.dispatcher, "/api/courier/push-config", "GET")).status).toBe(
      403,
    );
  });

  it("limits courier photo access to the courier's own current work", async () => {
    const photoCourier = await courierWithAccount(t, database.db, "Daniela Mejía");
    const shipment = await registerShipment(t, sessions.dispatcher.cookie, catalog);
    const extra = await registerShipment(t, sessions.dispatcher.cookie, catalog);
    const route = await createRoute(t, sessions.dispatcher.cookie, {
      shipmentIds: [shipment.id, extra.id],
      courierId: photoCourier.id,
    });
    expect((await routeAction(t, sessions.dispatcher.cookie, route, "/dispatch")).status).toBe(200);

    const photoId = crypto.randomUUID();
    const recordId = crypto.randomUUID();
    const now = t.now().toISOString();
    const recordResponse = await t.app.request("/api/courier/records", {
      method: "POST",
      headers: { cookie: photoCourier.cookie, "content-type": "application/json" },
      body: JSON.stringify({
        deviceNow: now,
        records: [
          { id: crypto.randomUUID(), shipmentId: shipment.id, occurredAt: now, kind: "pickup" },
          {
            id: recordId,
            shipmentId: shipment.id,
            occurredAt: now,
            kind: "delivery",
            receivedByName: "Laura Gómez",
            cashAmount: 50_000,
            photos: [{ id: photoId, kind: "proof" }],
          },
        ],
      }),
    });
    expect(recordResponse.status).toBe(200);

    const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const courierUpload = (account: CourierAccount) =>
      t.app.request(`/api/courier/photos/${photoId}`, {
        method: "PUT",
        headers: { cookie: account.cookie, "content-type": "image/jpeg" },
        body: image,
      });
    expect((await courierUpload(otherCourier)).status).toBe(404);
    const [unuploaded] = await database.db
      .select()
      .from(recordPhotos)
      .where(eq(recordPhotos.id, photoId));
    expect(unuploaded?.uploadedAt).toBeNull();
    expect((await courierUpload(photoCourier)).status).toBe(204);

    for (const viewer of [sessions.owner, sessions.dispatcher]) {
      const response = await t.app.request(`/api/photos/${photoId}`, {
        headers: { cookie: viewer.cookie },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe(
        "private, no-cache, no-store, must-revalidate",
      );
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(image);
    }
    const own = await t.app.request(`/api/photos/${photoId}`, {
      headers: { cookie: photoCourier.cookie },
    });
    const wrongCourier = await t.app.request(`/api/photos/${photoId}`, {
      headers: { cookie: otherCourier.cookie },
    });
    expect(own.status).toBe(200);
    expect(wrongCourier.status).toBe(403);
    expect(new Uint8Array(await own.arrayBuffer())).toEqual(image);
  });

  it("allows settings reads to dispatchers but only owners can change the office", async () => {
    const before = await database.db.select().from(companySettings);
    expect(before).toEqual([]);
    const [ownerSettings, dispatcherSettings] = await Promise.all([
      requestAs(sessions.owner, "/api/settings", "GET"),
      requestAs(sessions.dispatcher, "/api/settings", "GET"),
    ]);
    expect(ownerSettings.status).toBe(200);
    expect(dispatcherSettings.status).toBe(200);
    expect(await ownerSettings.json()).toEqual({
      officeAddress: null,
      officeNeighborhood: null,
      supportPhone: null,
      companyName: "Cohex",
    });
    expect(await dispatcherSettings.json()).toEqual({
      officeAddress: null,
      officeNeighborhood: null,
      supportPhone: null,
      companyName: "Cohex",
    });

    const input = {
      actionId: crypto.randomUUID(),
      officeAddress: "Carrera 70 # 45-10",
      officeNeighborhoodId: catalog.place.estadio,
    };
    const denied = await requestAs(sessions.dispatcher, "/api/settings", "PATCH", input);
    expect(denied.status).toBe(403);
    expect(await database.db.select().from(companySettings)).toEqual([]);

    const accepted = await requestAs(sessions.owner, "/api/settings", "PATCH", input);
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({
      officeAddress: input.officeAddress,
      officeNeighborhood: { id: catalog.place.estadio, name: "El Estadio" },
      supportPhone: null,
      companyName: "Cohex",
    });
  });

  it("requires the authenticated owner actor header and refuses deactivated sessions", async () => {
    const target = await t.signIn("courier", { name: "Cuenta de prueba" });
    const payload = { actionId: crypto.randomUUID(), userId: target.user.id };
    const missing = await nativeAdminRequest(
      sessions.owner,
      target.user.id,
      null,
      payload.actionId,
    );
    const malformed = await nativeAdminRequest(
      sessions.owner,
      target.user.id,
      "no-es-un-uuid",
      crypto.randomUUID(),
    );
    const mismatch = await nativeAdminRequest(
      sessions.owner,
      target.user.id,
      crypto.randomUUID(),
      crypto.randomUUID(),
    );
    expect(missing.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(mismatch.status).toBe(409);
    const [unchanged] = await database.db.select().from(users).where(eq(users.id, target.user.id));
    expect(unchanged?.banned).toBe(false);

    const dispatcherAttempt = await nativeAdminRequest(
      sessions.dispatcher,
      target.user.id,
      sessions.owner.userId,
      crypto.randomUUID(),
    );
    expect(dispatcherAttempt.status).toBe(403);

    const accepted = await nativeAdminRequest(
      sessions.owner,
      target.user.id,
      sessions.owner.userId,
      payload.actionId,
    );
    expect(accepted.status).toBe(200);
    const deactivated = await requestAs(
      { cookie: target.cookie, userId: target.user.id, role: "courier" },
      "/api/courier/route",
      "GET",
    );
    expect(deactivated.status).toBe(401);
    for (const [method, path] of endpoints.filter(([, route]) =>
      route.startsWith("/api/courier/"),
    )) {
      const response = await requestAs(
        { cookie: target.cookie, userId: target.user.id, role: "courier" },
        path,
        method,
        method === "GET" ? undefined : {},
      );
      expect(response.status, `deactivated courier ${method} ${path}`).toBe(401);
    }
  });

  it("has no delete endpoints: records are deactivated or voided (FR-017)", () => {
    expect(t.app.routes.filter((route) => route.method === "DELETE")).toEqual([]);
  });
});
