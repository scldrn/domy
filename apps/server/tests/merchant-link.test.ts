import type { Shipment } from "@domy/domain";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  auditEvents,
  courierRecords,
  merchants,
  recordPhotos,
  shipmentEvents,
  shipments,
} from "../src/db/schema/index.ts";
import { createTestApp } from "./setup/app.ts";
import { createCatalog, type Catalog } from "./setup/catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./setup/courier.ts";
import { startDatabase, type TestDatabase } from "./setup/database.ts";
import { createRoute, registerShipment, routeAction, send } from "./setup/routes.ts";
import { startStorage, type TestStorage } from "./setup/storage.ts";

const objectBody = z.record(z.string(), z.unknown());
const jpeg = (fill = 7) => {
  const bytes = new Uint8Array(2048).fill(fill);
  bytes.set([0xff, 0xd8, 0xff]);
  return bytes;
};

let database: TestDatabase;
let storage: TestStorage;
let t: ReturnType<typeof createTestApp>;
let catalog: Catalog;
let owner: { cookie: string; user: { id: string } };
let dispatcher: { cookie: string; user: { id: string } };
let ana: CourierAccount;

beforeAll(async () => {
  [database, storage] = await Promise.all([startDatabase(), startStorage()]);
}, 120_000);

afterAll(async () => {
  await Promise.all([database.stop(), storage.stop()]);
});

beforeEach(async () => {
  await database.truncate();
  t = createTestApp(database.db, {
    now: "2026-10-01T15:00:00Z",
    storage: storage.storage,
  });
  owner = await t.signIn("owner");
  catalog = await createCatalog(database.db, owner.user.id);
  dispatcher = await t.signIn("dispatcher");
  ana = await courierWithAccount(t, database.db, "Ana Ruiz");
});

async function merchantCode(merchantId: string): Promise<string> {
  const [row] = await database.db
    .select({ code: merchants.linkCode })
    .from(merchants)
    .where(eq(merchants.id, merchantId));
  if (!row) throw new Error("The fixture merchant is missing");
  return row.code;
}

async function trackingCode(shipmentId: string): Promise<string> {
  const [row] = await database.db
    .select({ code: shipments.trackingCode })
    .from(shipments)
    .where(eq(shipments.id, shipmentId));
  if (!row) throw new Error("The fixture shipment is missing");
  return row.code;
}

function unknownCode(): string {
  return randomBytes(16).toString("base64url");
}

async function getJson(path: string): Promise<{ status: number; body: unknown; headers: Headers }> {
  const response = await t.app.request(path);
  return {
    status: response.status,
    body: await response.json().catch(() => null),
    headers: response.headers,
  };
}

function expectLinkNotFound(body: unknown): void {
  expect(body).toMatchObject({
    error: { code: "link_not_found", message: "Este enlace no es válido" },
  });
}

function expectPublicHeaders(headers: Headers): void {
  expect(headers.get("cache-control")).toBe("no-store");
  expect(headers.get("x-robots-tag")).toBe("noindex");
}

function expectExactKeys(value: unknown, keys: string[]): void {
  expect(Object.keys(objectBody.parse(value)).sort()).toEqual([...keys].sort());
}

function responseLinkCode(body: unknown): string | null {
  const result = objectBody.safeParse(body);
  const linkCode = result.success ? result.data["linkCode"] : undefined;
  return typeof linkCode === "string" && /^[A-Za-z0-9_-]{22}$/u.test(linkCode) ? linkCode : null;
}

async function registerAtServiceDate(serviceDate: string): Promise<Shipment> {
  const previousTime = t.now().toISOString();
  try {
    t.setNow(`${serviceDate}T15:00:00Z`);
    return await registerShipment(t, dispatcher.cookie, catalog, { serviceDate });
  } finally {
    t.setNow(previousTime);
  }
}

async function createDeliveredWithProofPhotos(
  serviceDate: string,
  photoCount: number,
): Promise<{ shipment: Shipment; recordId: string; photoIds: string[] }> {
  const previousTime = t.now().toISOString();
  try {
    t.setNow(`${serviceDate}T15:00:00Z`);
    const shipment = await registerShipment(t, dispatcher.cookie, catalog, { serviceDate });
    const extraShipment = await registerShipment(t, dispatcher.cookie, catalog, { serviceDate });
    const route = await createRoute(t, dispatcher.cookie, {
      serviceDate,
      shipmentIds: [shipment.id, extraShipment.id],
      courierId: ana.id,
    });
    const dispatched = await routeAction(t, dispatcher.cookie, route, "/dispatch");
    expect(dispatched.status, JSON.stringify(dispatched.body)).toBe(200);

    const photoIds = Array.from({ length: photoCount }, () => crypto.randomUUID());
    const recordId = crypto.randomUUID();
    const result = await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "pickup" },
      {
        id: recordId,
        shipmentId: shipment.id,
        kind: "delivery",
        receivedByName: "Quien recibe",
        cashAmount: shipment.codAmount,
        photos: photoIds.map((id) => ({ id, kind: "proof" })),
      },
    ]);
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.results).toEqual([
      expect.objectContaining({ outcome: "applied" }),
      expect.objectContaining({ id: recordId, outcome: "applied" }),
    ]);

    return { shipment, recordId, photoIds };
  } finally {
    t.setNow(previousTime);
  }
}

async function uploadProofPhoto(photoId: string, bytes: Uint8Array): Promise<Response> {
  return t.app.request(`/api/courier/photos/${photoId}`, {
    method: "PUT",
    headers: { cookie: ana.cookie, "content-type": "image/jpeg" },
    body: bytes,
  });
}

describe("merchant private link reads (004/T024, FR-019–FR-022)", () => {
  it("serves today and the inclusive 30th Bogotá service day without a session", async () => {
    t.setNow("2026-10-01T04:30:00Z"); // September 30 at 11:30 p. m. in Bogotá.
    const shipment = await registerShipment(t, dispatcher.cookie, catalog, {
      serviceDate: "2026-09-30",
      recipientPhone: "3119876543",
      recipientAddress: "PRIVATE_ADDRESS_MERCHANT_LINK",
    });
    const code = await merchantCode(catalog.merchant.bullish);

    const today = await getJson(`/api/public/merchant/${code}`);

    expect(today.status).toBe(200);
    const todayBody = objectBody.parse(today.body);
    expectExactKeys(today.body, ["merchantName", "date", "support", "shipments", "totals"]);
    expect(todayBody).toMatchObject({
      merchantName: "Bullish Hype",
      date: "2026-09-30",
      shipments: expect.arrayContaining([
        expect.objectContaining({ id: shipment.id, trackingNumber: shipment.trackingNumber }),
      ]),
    });
    const dayShipments = todayBody["shipments"];
    expect(Array.isArray(dayShipments)).toBe(true);
    if (!Array.isArray(dayShipments))
      throw new Error("The merchant response omitted its shipments");
    const row = objectBody.parse(dayShipments[0]);
    expectExactKeys(row, [
      "id",
      "trackingNumber",
      "kind",
      "status",
      "serviceDate",
      "merchantReference",
      "recipientName",
      "neighborhood",
      "window",
      "fee",
      "feeToConfirm",
      "codAmount",
      "trackingLink",
    ]);
    expect(JSON.stringify(today.body)).not.toContain("PRIVATE_ADDRESS_MERCHANT_LINK");
    expect(JSON.stringify(today.body)).not.toContain("3119876543");
    expectPublicHeaders(today.headers);

    const shipmentDetail = await getJson(`/api/public/merchant/${code}/shipments/${shipment.id}`);
    expect(shipmentDetail.status).toBe(200);
    const detailBody = objectBody.parse(shipmentDetail.body);
    expectExactKeys(shipmentDetail.body, [
      "id",
      "trackingNumber",
      "kind",
      "status",
      "serviceDate",
      "merchantReference",
      "recipientName",
      "neighborhood",
      "window",
      "fee",
      "feeToConfirm",
      "codAmount",
      "trackingLink",
      "statusAt",
      "receivedByName",
      "collected",
      "photos",
    ]);
    expect(detailBody).toMatchObject({
      id: shipment.id,
      trackingNumber: shipment.trackingNumber,
      serviceDate: "2026-09-30",
      statusAt: shipment.registeredAt,
    });
    expect(JSON.stringify(shipmentDetail.body)).not.toContain("PRIVATE_ADDRESS_MERCHANT_LINK");
    expect(JSON.stringify(shipmentDetail.body)).not.toContain("3119876543");
    expectPublicHeaders(shipmentDetail.headers);

    const lastAllowedDay = await getJson(`/api/public/merchant/${code}?date=2026-09-01`);

    expect(lastAllowedDay.status).toBe(200);
    expect(objectBody.parse(lastAllowedDay.body)).toMatchObject({
      merchantName: "Bullish Hype",
      date: "2026-09-01",
      shipments: [],
    });
  });

  it("builds tracking links from the configured public origin, not request host headers", async () => {
    const shipment = await registerShipment(t, dispatcher.cookie, catalog);
    const code = await merchantCode(catalog.merchant.bullish);
    const response = await t.app.request(`/api/public/merchant/${code}`, {
      headers: {
        host: "attacker.example",
        "x-forwarded-host": "forwarded.attacker.example",
      },
    });
    expect(response.status).toBe(200);
    const body = objectBody.parse(await response.json());
    const items = body["shipments"];
    expect(Array.isArray(items)).toBe(true);
    if (!Array.isArray(items)) throw new Error("The merchant response omitted its shipments");
    const shipmentRow = items
      .map((item) => objectBody.parse(item))
      .find((item) => {
        return item["id"] === shipment.id;
      });
    if (!shipmentRow) throw new Error("The registered shipment is missing from the day view");
    expect(shipmentRow["trackingLink"]).toBe(
      `http://localhost:5173/seguimiento/${await trackingCode(shipment.id)}`,
    );
    expect(JSON.stringify(shipmentRow)).not.toContain("attacker.example");
  });

  it.each(["2026-08-31", "2026-10-01"])(
    "rejects a requested service date outside the Bogotá window: %s",
    async (date) => {
      t.setNow("2026-10-01T04:30:00Z"); // Bogotá date is September 30.
      const code = await merchantCode(catalog.merchant.bullish);
      const result = await getJson(`/api/public/merchant/${code}?date=${date}`);

      expect(result.status).toBe(422);
      expect(result.body).toMatchObject({ error: { code: "date_out_of_range" } });
      expectPublicHeaders(result.headers);
    },
  );

  it("checks the active bearer before returning a calendar-date error", async () => {
    const merchantId = catalog.merchant.bullish;
    const code = await merchantCode(merchantId);
    const malformedDate = "2026-02-30";
    const validLink = await getJson(`/api/public/merchant/${code}?date=${malformedDate}`);
    expect(validLink.status).toBe(422);
    expect(validLink.body).toMatchObject({ error: { code: "date_out_of_range" } });
    expectPublicHeaders(validLink.headers);

    const unknownLink = await getJson(
      `/api/public/merchant/${unknownCode()}?date=${malformedDate}`,
    );
    expect(unknownLink.status).toBe(404);
    expectLinkNotFound(unknownLink.body);
    expectPublicHeaders(unknownLink.headers);
    expect(unknownLink.body).not.toEqual(validLink.body);

    const deactivated = await send(
      t,
      owner.cookie,
      `/api/merchants/${merchantId}`,
      { actionId: crypto.randomUUID(), isActive: false },
      "PATCH",
    );
    expect(deactivated.status).toBe(200);
    const inactiveLink = await getJson(`/api/public/merchant/${code}?date=${malformedDate}`);
    expect(inactiveLink.status).toBe(404);
    expectLinkNotFound(inactiveLink.body);
    expect(inactiveLink.body).toEqual(unknownLink.body);
    expectPublicHeaders(inactiveLink.headers);
  });

  it("returns a uniform public 404 for an unknown code and another merchant's shipment", async () => {
    const ownShipment = await registerShipment(t, dispatcher.cookie, catalog);
    const otherShipment = await registerShipment(t, dispatcher.cookie, catalog, {
      merchantId: catalog.merchant.amy,
      pickupPointId: catalog.pickup.amy,
      feeOverrideReason: "Tarifa válida para este comercio",
    });
    const code = await merchantCode(catalog.merchant.bullish);
    const unknown = await getJson(`/api/public/merchant/${unknownCode()}`);
    const crossMerchant = await getJson(
      `/api/public/merchant/${code}/shipments/${otherShipment.id}`,
    );

    expect(unknown.status).toBe(404);
    expect(crossMerchant.status).toBe(404);
    expectLinkNotFound(unknown.body);
    expectLinkNotFound(crossMerchant.body);
    expect(crossMerchant.body).toEqual(unknown.body);
    expect(ownShipment.id).not.toBe(otherShipment.id);
    expectPublicHeaders(unknown.headers);
    expectPublicHeaders(crossMerchant.headers);
  });

  it("keeps direct detail and photo access inside the shared service-date window", async () => {
    const oldShipment = await registerAtServiceDate("2026-09-01");
    const oldProof = await createDeliveredWithProofPhotos("2026-09-01", 1);
    const bytes = jpeg();
    const upload = await uploadProofPhoto(oldProof.photoIds[0] ?? "", bytes);
    expect(upload.status, await upload.text()).toBe(204);

    const code = await merchantCode(catalog.merchant.bullish);
    const detail = await getJson(`/api/public/merchant/${code}/shipments/${oldShipment.id}`);
    const photo = await getJson(
      `/api/public/merchant/${code}/photos/${oldProof.photoIds[0] ?? ""}`,
    );
    const unknown = await getJson(`/api/public/merchant/${unknownCode()}`);

    expect(detail.status).toBe(404);
    expect(photo.status).toBe(404);
    expectLinkNotFound(detail.body);
    expectLinkNotFound(photo.body);
    expect(detail.body).toEqual(unknown.body);
    expect(photo.body).toEqual(unknown.body);
    expectPublicHeaders(detail.headers);
    expectPublicHeaders(photo.headers);
  });

  it("streams only an uploaded owned proof photo and hides pending, missing, and foreign photos", async () => {
    const proof = await createDeliveredWithProofPhotos("2026-10-01", 2);
    const uploadedId = proof.photoIds[0];
    const pendingId = proof.photoIds[1];
    if (!uploadedId || !pendingId) throw new Error("The proof-photo fixture is incomplete");
    const code = await merchantCode(catalog.merchant.bullish);
    const otherCode = await merchantCode(catalog.merchant.amy);
    const bytes = jpeg();
    const uploaded = await uploadProofPhoto(uploadedId, bytes);
    expect(uploaded.status, await uploaded.text()).toBe(204);

    const [photo] = await database.db
      .select({ storageKey: recordPhotos.storageKey })
      .from(recordPhotos)
      .where(eq(recordPhotos.id, uploadedId));
    if (!photo) throw new Error("The uploaded photo fixture is missing");
    expect(await storage.storage.getPhoto(photo.storageKey)).toEqual(bytes);

    const streamed = await t.app.request(`/api/public/merchant/${code}/photos/${uploadedId}`);
    expect(streamed.status).toBe(200);
    expect(streamed.headers.get("content-type")).toBe("image/jpeg");
    expectPublicHeaders(streamed.headers);
    expect(new Uint8Array(await streamed.arrayBuffer())).toEqual(bytes);

    const pending = await getJson(`/api/public/merchant/${code}/photos/${pendingId}`);
    const foreign = await getJson(`/api/public/merchant/${otherCode}/photos/${uploadedId}`);
    await storage.storage.deletePhoto(photo.storageKey);
    const missingObject = await getJson(`/api/public/merchant/${code}/photos/${uploadedId}`);

    for (const response of [pending, foreign, missingObject]) {
      expect(response.status).toBe(404);
      expectLinkNotFound(response.body);
      expectPublicHeaders(response.headers);
    }
    expect(pending.body).toEqual(foreign.body);
    expect(foreign.body).toEqual(missingObject.body);
  });

  it("hides an uploaded proof when its delivery is reverted but keeps the S3 object", async () => {
    const proof = await createDeliveredWithProofPhotos("2026-10-01", 1);
    const photoId = proof.photoIds[0];
    if (!photoId) throw new Error("The proof-photo fixture is incomplete");
    const merchantLink = await merchantCode(catalog.merchant.bullish);
    const tracking = await trackingCode(proof.shipment.id);
    const bytes = jpeg(19);
    const upload = await uploadProofPhoto(photoId, bytes);
    expect(upload.status, await upload.text()).toBe(204);

    const [photo] = await database.db
      .select({ storageKey: recordPhotos.storageKey })
      .from(recordPhotos)
      .where(eq(recordPhotos.id, photoId));
    if (!photo) throw new Error("The uploaded photo fixture is missing");

    const beforeRevert = await t.app.request(
      `/api/public/merchant/${merchantLink}/photos/${photoId}`,
    );
    expect(beforeRevert.status).toBe(200);
    expect(new Uint8Array(await beforeRevert.arrayBuffer())).toEqual(bytes);

    const reverted = await send(
      t,
      dispatcher.cookie,
      `/api/courier-records/${proof.recordId}/revert`,
      { actionId: crypto.randomUUID(), reason: "La entrega se reportó por equivocación" },
    );
    expect(reverted.status, JSON.stringify(reverted.body)).toBe(200);

    const [trackingAgain, hiddenPhoto, unknownLink] = await Promise.all([
      getJson(`/api/public/tracking/${tracking}`),
      getJson(`/api/public/merchant/${merchantLink}/photos/${photoId}`),
      getJson(`/api/public/merchant/${unknownCode()}`),
    ]);
    expect(trackingAgain.status).toBe(200);
    expect(objectBody.parse(trackingAgain.body)).toMatchObject({
      statusText: "En camino",
      expired: false,
    });
    expect(hiddenPhoto.status).toBe(404);
    expectLinkNotFound(hiddenPhoto.body);
    expect(hiddenPhoto.body).toEqual(unknownLink.body);
    expectPublicHeaders(hiddenPhoto.headers);
    expect(await storage.storage.getPhoto(photo.storageKey)).toEqual(bytes);
  });

  it("keeps initial registered statusAt after a non-status shipment edit", async () => {
    const shipment = await registerShipment(t, dispatcher.cookie, catalog);
    t.setNow("2026-10-01T16:00:00Z");
    const edit = await send(
      t,
      dispatcher.cookie,
      `/api/shipments/${shipment.id}`,
      {
        actionId: crypto.randomUUID(),
        version: shipment.version,
        merchantReference: "EDITED_WITHOUT_STATUS_CHANGE",
      },
      "PATCH",
    );
    expect(edit.status).toBe(200);

    const code = await merchantCode(catalog.merchant.bullish);
    const detail = await getJson(`/api/public/merchant/${code}/shipments/${shipment.id}`);
    const detailBody = objectBody.parse(detail.body);
    expect(detail.status).toBe(200);
    expect(detailBody["statusAt"]).toBe(shipment.registeredAt);
  });

  it("uses the new office-retry transition time when status returns to registered", async () => {
    const shipment = await registerShipment(t, dispatcher.cookie, catalog);
    const filler = await registerShipment(t, dispatcher.cookie, catalog);
    const route = await createRoute(t, dispatcher.cookie, {
      serviceDate: "2026-10-01",
      shipmentIds: [shipment.id, filler.id],
      courierId: ana.id,
    });
    const dispatched = await routeAction(t, dispatcher.cookie, route, "/dispatch");
    expect(dispatched.status, JSON.stringify(dispatched.body)).toBe(200);
    const exceptionRecordId = crypto.randomUUID();
    const records = await sendRecords(t, ana, [
      { shipmentId: shipment.id, kind: "pickup" },
      {
        id: exceptionRecordId,
        shipmentId: shipment.id,
        kind: "exception",
        reason: "recipient_absent",
      },
    ]);
    expect(records.status, JSON.stringify(records.body)).toBe(200);

    const officeConfigured = await send(
      t,
      owner.cookie,
      "/api/settings",
      {
        actionId: crypto.randomUUID(),
        officeAddress: "Calle 99 # 10-10",
        officeNeighborhoodId: catalog.place.laureles,
      },
      "PATCH",
    );
    expect(officeConfigured.status).toBe(200);

    t.setNow("2026-10-01T15:30:00Z");
    const officeReceipt = await send(
      t,
      dispatcher.cookie,
      `/api/shipments/${shipment.id}/office-receipt`,
      { actionId: crypto.randomUUID() },
    );
    expect(officeReceipt.status, JSON.stringify(officeReceipt.body)).toBe(200);

    const [exceptionEffect] = await database.db
      .select({ occurredAt: shipmentEvents.occurredAt })
      .from(shipmentEvents)
      .where(
        and(
          eq(shipmentEvents.shipmentId, shipment.id),
          eq(shipmentEvents.type, "status_changed"),
          eq(shipmentEvents.toStatus, "exception"),
          eq(shipmentEvents.courierRecordId, exceptionRecordId),
        ),
      );
    if (!exceptionEffect) throw new Error("The exception status transition is missing");
    const code = await merchantCode(catalog.merchant.bullish);
    const exceptionDetail = await getJson(`/api/public/merchant/${code}/shipments/${shipment.id}`);
    expect(exceptionDetail.status).toBe(200);
    expect(objectBody.parse(exceptionDetail.body)["statusAt"]).toBe(
      exceptionEffect.occurredAt.toISOString(),
    );

    const [sameStatusOfficeReceipt] = await database.db
      .select({ fromStatus: shipmentEvents.fromStatus, toStatus: shipmentEvents.toStatus })
      .from(shipmentEvents)
      .where(
        and(eq(shipmentEvents.shipmentId, shipment.id), eq(shipmentEvents.type, "office_received")),
      );
    expect(sameStatusOfficeReceipt).toEqual({ fromStatus: "exception", toStatus: "exception" });

    t.setNow("2026-10-01T16:00:00Z");
    const decision = await send(
      t,
      dispatcher.cookie,
      `/api/shipments/${shipment.id}/exception-decision`,
      { actionId: crypto.randomUUID(), decision: "new_attempt" },
    );
    expect(decision.status, JSON.stringify(decision.body)).toBe(200);

    const [transition] = await database.db
      .select({ occurredAt: shipmentEvents.occurredAt })
      .from(shipmentEvents)
      .where(
        and(
          eq(shipmentEvents.shipmentId, shipment.id),
          eq(shipmentEvents.type, "exception_decided"),
          eq(shipmentEvents.fromStatus, "exception"),
          eq(shipmentEvents.toStatus, "registered"),
        ),
      );
    if (!transition) throw new Error("The registered retry transition is missing");

    const detail = await getJson(`/api/public/merchant/${code}/shipments/${shipment.id}`);
    const detailBody = objectBody.parse(detail.body);
    expect(detail.status).toBe(200);
    expect(detailBody["status"]).toBe("registered");
    expect(detailBody["statusAt"]).toBe(transition.occurredAt.toISOString());
    expect(detailBody["statusAt"]).not.toBe(shipment.registeredAt);
  });

  it("uses current delivery provenance through correction and restores status time after revert", async () => {
    const { shipment, recordId } = await createDeliveredWithProofPhotos("2026-10-01", 0);
    const [deliveryEvent] = await database.db
      .select({ occurredAt: shipmentEvents.occurredAt })
      .from(shipmentEvents)
      .where(
        and(
          eq(shipmentEvents.shipmentId, shipment.id),
          eq(shipmentEvents.type, "status_changed"),
          eq(shipmentEvents.toStatus, "delivered"),
          eq(shipmentEvents.courierRecordId, recordId),
        ),
      );
    if (!deliveryEvent) throw new Error("The delivery status transition is missing");
    const [deliveryRecord] = await database.db
      .select({ occurredAt: courierRecords.occurredAt })
      .from(courierRecords)
      .where(eq(courierRecords.id, recordId));
    if (!deliveryRecord) throw new Error("The effective delivery record is missing");
    expect(deliveryRecord.occurredAt).toEqual(deliveryEvent.occurredAt);
    const code = await merchantCode(catalog.merchant.bullish);

    t.setNow("2026-10-01T16:00:00Z");
    const corrected = await send(t, owner.cookie, `/api/courier-records/${recordId}/correct`, {
      actionId: crypto.randomUUID(),
      reason: "Se confirmó el dato con quien recibió",
      receivedByName: "Nombre corregido",
    });
    expect(corrected.status, JSON.stringify(corrected.body)).toBe(200);
    const afterCorrection = await getJson(`/api/public/merchant/${code}/shipments/${shipment.id}`);
    expect(afterCorrection.status).toBe(200);
    expect(objectBody.parse(afterCorrection.body)).toMatchObject({
      status: "delivered",
      statusAt: deliveryRecord.occurredAt.toISOString(),
      receivedByName: "Nombre corregido",
    });

    t.setNow("2026-10-01T17:00:00Z");
    const reverted = await send(t, owner.cookie, `/api/courier-records/${recordId}/revert`, {
      actionId: crypto.randomUUID(),
      reason: "La entrega se registró por equivocación",
    });
    expect(reverted.status, JSON.stringify(reverted.body)).toBe(200);
    const [pickupEvent] = await database.db
      .select({ occurredAt: shipmentEvents.occurredAt })
      .from(shipmentEvents)
      .where(
        and(
          eq(shipmentEvents.shipmentId, shipment.id),
          eq(shipmentEvents.type, "status_changed"),
          eq(shipmentEvents.toStatus, "picked_up"),
        ),
      );
    if (!pickupEvent) throw new Error("The pickup status transition is missing");
    const [revertEvent] = await database.db
      .select({
        fromStatus: shipmentEvents.fromStatus,
        toStatus: shipmentEvents.toStatus,
        occurredAt: shipmentEvents.occurredAt,
      })
      .from(shipmentEvents)
      .where(
        and(eq(shipmentEvents.shipmentId, shipment.id), eq(shipmentEvents.type, "record_reverted")),
      );
    if (!revertEvent) throw new Error("The revert status transition is missing");
    expect(revertEvent).toMatchObject({ fromStatus: "delivered", toStatus: "picked_up" });

    const afterRevert = await getJson(`/api/public/merchant/${code}/shipments/${shipment.id}`);
    expect(afterRevert.status).toBe(200);
    expect(objectBody.parse(afterRevert.body)).toMatchObject({
      status: "picked_up",
      statusAt: revertEvent.occurredAt.toISOString(),
      receivedByName: null,
    });
    expect(revertEvent.occurredAt).not.toEqual(pickupEvent.occurredAt);
    expect(objectBody.parse(afterRevert.body)["statusAt"]).not.toBe(shipment.registeredAt);
  });

  it("invalidates a deactivated merchant link while its shipment tracking link remains active", async () => {
    const shipment = await registerShipment(t, dispatcher.cookie, catalog);
    const proof = await createDeliveredWithProofPhotos("2026-10-01", 1);
    const proofPhotoId = proof.photoIds[0];
    if (!proofPhotoId) throw new Error("The proof-photo fixture is incomplete");
    const upload = await uploadProofPhoto(proofPhotoId, jpeg(23));
    expect(upload.status, await upload.text()).toBe(204);
    const code = await merchantCode(catalog.merchant.bullish);
    const publicTrackingCode = await trackingCode(shipment.id);
    const deactivated = await send(
      t,
      owner.cookie,
      `/api/merchants/${catalog.merchant.bullish}`,
      { actionId: crypto.randomUUID(), isActive: false },
      "PATCH",
    );
    expect(deactivated.status, JSON.stringify(deactivated.body)).toBe(200);

    const [merchantPage, detail, photo, trackingPage] = await Promise.all([
      getJson(`/api/public/merchant/${code}`),
      getJson(`/api/public/merchant/${code}/shipments/${proof.shipment.id}`),
      getJson(`/api/public/merchant/${code}/photos/${proofPhotoId}`),
      getJson(`/api/public/tracking/${publicTrackingCode}`),
    ]);

    expect(merchantPage.status).toBe(404);
    expectLinkNotFound(merchantPage.body);
    expectPublicHeaders(merchantPage.headers);
    expect(detail.status).toBe(404);
    expect(photo.status).toBe(404);
    expectLinkNotFound(detail.body);
    expectLinkNotFound(photo.body);
    expect(detail.body).toEqual(merchantPage.body);
    expect(photo.body).toEqual(merchantPage.body);
    expectPublicHeaders(detail.headers);
    expectPublicHeaders(photo.headers);
    expect(trackingPage.status).toBe(200);
    expect(objectBody.parse(trackingPage.body)).toMatchObject({
      trackingNumber: shipment.trackingNumber,
      expired: false,
    });
  });

  it("rotates once under concurrent replay, binds the receipt, and never audits bearer codes", async () => {
    const merchantId = catalog.merchant.bullish;
    const actionId = crypto.randomUUID();
    const oldCode = await merchantCode(merchantId);
    const proof = await createDeliveredWithProofPhotos("2026-10-01", 1);
    const proofPhotoId = proof.photoIds[0];
    if (!proofPhotoId) throw new Error("The proof-photo fixture is incomplete");
    const upload = await uploadProofPhoto(proofPhotoId, jpeg(31));
    expect(upload.status, await upload.text()).toBe(204);
    const requestRotation = (cookie: string, targetId = merchantId) =>
      t.request(`/api/merchants/${targetId}/replace-link`, {
        method: "POST",
        cookie,
        body: { actionId },
      });

    const concurrentResponses = await Promise.all([
      requestRotation(owner.cookie),
      requestRotation(owner.cookie),
    ]);
    const concurrentBodies = await Promise.all(
      concurrentResponses.map((response) => response.json().catch(() => null)),
    );
    expect(concurrentResponses.map((response) => response.status)).toEqual([200, 200]);
    for (const body of concurrentBodies) {
      expectExactKeys(body, ["id", "name", "whatsappPhone", "isActive", "aliases", "linkCode"]);
    }

    const firstCode = responseLinkCode(concurrentBodies[0]);
    const secondCode = responseLinkCode(concurrentBodies[1]);
    expect(firstCode).not.toBeNull();
    expect(secondCode).toBe(firstCode);
    if (!firstCode) throw new Error("The rotation response omitted its valid bearer code");
    expect(firstCode).not.toBe(oldCode);

    const oldPage = await getJson(`/api/public/merchant/${oldCode}`);
    const oldDetail = await getJson(
      `/api/public/merchant/${oldCode}/shipments/${proof.shipment.id}`,
    );
    const oldPhoto = await getJson(`/api/public/merchant/${oldCode}/photos/${proofPhotoId}`);
    const newPage = await getJson(`/api/public/merchant/${firstCode}`);
    expect(oldPage.status).toBe(404);
    expect(oldDetail.status).toBe(404);
    expect(oldPhoto.status).toBe(404);
    expectLinkNotFound(oldPage.body);
    expectLinkNotFound(oldDetail.body);
    expectLinkNotFound(oldPhoto.body);
    expect(oldDetail.body).toEqual(oldPage.body);
    expect(oldPhoto.body).toEqual(oldPage.body);
    expectPublicHeaders(oldDetail.headers);
    expectPublicHeaders(oldPhoto.headers);
    expect(newPage.status).toBe(200);

    const replay = await requestRotation(owner.cookie);
    const replayBody: unknown = await replay.json().catch(() => null);
    expect(replay.status).toBe(200);
    expectExactKeys(replayBody, ["id", "name", "whatsappPhone", "isActive", "aliases", "linkCode"]);
    expect(responseLinkCode(replayBody)).toBe(firstCode);

    const otherMerchantCode = await merchantCode(catalog.merchant.amy);
    const wrongTarget = await requestRotation(owner.cookie, catalog.merchant.amy);
    expect(wrongTarget.status).toBe(409);
    expect(await merchantCode(catalog.merchant.amy)).toBe(otherMerchantCode);

    const wrongActor = await requestRotation(dispatcher.cookie);
    expect(wrongActor.status).toBe(409);

    const wrongOperation = await send(
      t,
      owner.cookie,
      `/api/merchants/${merchantId}`,
      { actionId, name: "Nombre que no debe aplicarse" },
      "PATCH",
    );
    expect(wrongOperation.status).toBe(409);

    const patchActionId = crypto.randomUUID();
    const acceptedPatch = await send(
      t,
      owner.cookie,
      `/api/merchants/${merchantId}`,
      { actionId: patchActionId, name: "Bullish Hype Actualizado" },
      "PATCH",
    );
    expect(acceptedPatch.status).toBe(200);
    const beforeWrongOperation = await merchantCode(merchantId);
    const rotationUsingPatchId = await t.request(`/api/merchants/${merchantId}/replace-link`, {
      method: "POST",
      cookie: owner.cookie,
      body: { actionId: patchActionId },
    });
    expect(rotationUsingPatchId.status).toBe(409);
    expect(await merchantCode(merchantId)).toBe(beforeWrongOperation);

    const receipts = await database.db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.clientEventId, actionId), eq(auditEvents.entityId, merchantId)));
    expect(receipts).toHaveLength(1);
    const receipt = receipts[0];
    if (!receipt) throw new Error("The rotation audit receipt is missing");
    expect(receipt).toMatchObject({
      entityType: "merchant",
      entityId: merchantId,
      action: "link_replaced",
      actorUserId: owner.user.id,
      clientEventId: actionId,
      occurredAt: t.now(),
    });
    const serializedChanges = JSON.stringify(receipt.changes);
    expect(typeof serializedChanges).toBe("string");
    if (typeof serializedChanges !== "string") {
      throw new Error("The audit changes could not be serialized");
    }
    expect(serializedChanges).not.toContain(oldCode);
    expect(serializedChanges).not.toContain(firstCode);
    expect(await merchantCode(merchantId)).toBe(firstCode);
  });

  it("rejects a replacement whose captured actor no longer matches the session", async () => {
    const merchantId = catalog.merchant.bullish;
    const actionId = crypto.randomUUID();
    const originalCode = await merchantCode(merchantId);
    const response = await t.request(`/api/merchants/${merchantId}/replace-link`, {
      method: "POST",
      cookie: owner.cookie,
      actorId: dispatcher.user.id,
      body: { actionId },
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "actor_changed" } });
    expect(await merchantCode(merchantId)).toBe(originalCode);
    const receipts = await database.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.clientEventId, actionId));
    expect(receipts).toHaveLength(0);

    const matchingActor = await t.request(`/api/merchants/${merchantId}/replace-link`, {
      method: "POST",
      cookie: owner.cookie,
      actorId: owner.user.id,
      body: { actionId: crypto.randomUUID() },
    });
    expect(matchingActor.status).toBe(200);
  });

  it("returns linkCode only from the authenticated merchant detail and rotation endpoints", async () => {
    const merchantId = catalog.merchant.bullish;
    const storedCode = await merchantCode(merchantId);
    const detail = await t.request(`/api/merchants/${merchantId}`, { cookie: owner.cookie });
    const detailBody: unknown = await detail.json();
    expect(detail.status).toBe(200);
    expect(responseLinkCode(detailBody)).toBe(storedCode);

    const list = await t.request("/api/merchants", { cookie: owner.cookie });
    const listBody = objectBody.parse(await list.json());
    const items = listBody["items"];
    expect(Array.isArray(items)).toBe(true);
    if (!Array.isArray(items)) throw new Error("The merchant list omitted its items");
    for (const item of items) {
      expect(objectBody.parse(item)).not.toHaveProperty("linkCode");
    }

    const createdId = crypto.randomUUID();
    const created = await t.request("/api/merchants", {
      method: "POST",
      cookie: owner.cookie,
      body: { id: createdId, name: "Comercio Sin Exponer Código", aliases: [] },
    });
    const createdBody: unknown = await created.json();
    expect(created.status).toBe(201);
    expect(objectBody.parse(createdBody)).not.toHaveProperty("linkCode");

    const patched = await t.request(`/api/merchants/${merchantId}`, {
      method: "PATCH",
      cookie: owner.cookie,
      body: { actionId: crypto.randomUUID(), name: "Bullish Hype Revisado" },
    });
    const patchedBody: unknown = await patched.json();
    expect(patched.status).toBe(200);
    expect(objectBody.parse(patchedBody)).not.toHaveProperty("linkCode");
  });
});
