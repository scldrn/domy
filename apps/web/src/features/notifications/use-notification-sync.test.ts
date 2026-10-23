import { QueryClient } from "@tanstack/react-query";
import { notificationMarkInput } from "@domy/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationListQueryOptions } from "./api";
import {
  notificationIntentsQueryOptions,
  prepareNotificationIntent,
  readNotificationIntents,
} from "./notification-intents";
import { synchronizeReadyNotificationIntents } from "./use-notification-sync";

const actorId = "b4f67dc0-f16e-4ac7-ae2b-1bc61cbd38a0";
const otherActorId = "5a88ec2e-5c87-466d-a690-c4fb3e6b85c2";
const merchantId = "4a1966eb-dc9e-47eb-8cab-8c6cc999b293";
const shipmentId = "f3b6a343-117e-4df5-8818-9ba610b1386f";
const secondShipmentId = "92fbad35-33e7-4d25-aa1a-418d8bb57cd7";
const data = new Map<string, string>();

function installStorage() {
  const storage = {
    get length() {
      return data.size;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}

function nativeLocks() {
  const queues = new Map<string, Promise<void>>();
  return {
    request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T> {
      const previous = queues.get(name) ?? Promise.resolve();
      let release = () => {};
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      queues.set(
        name,
        previous.then(() => current),
      );
      return previous.then(callback).finally(() => {
        release();
      });
    },
  };
}

function signedInSession(id = actorId) {
  return Response.json({
    user: {
      id,
      name: "Ana",
      email: "ana@example.com",
      role: "owner",
    },
  });
}

function pathOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

function bodyJson(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") throw new Error("The notification API body was not JSON text.");
  const parsed: unknown = JSON.parse(body);
  return parsed;
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  data.clear();
  installStorage();
  vi.stubGlobal("navigator", { locks: nativeLocks(), onLine: true });
  vi.stubGlobal("window", new EventTarget());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notification background synchronization", () => {
  it("leaves a rediscovered prepared action unsent until a user completes the external action", async () => {
    prepareNotificationIntent({
      actorId,
      merchantId,
      serviceDate: "2026-10-22",
      shipmentIds: [shipmentId],
    });
    const fetcher = vi.fn(() => Promise.resolve(signedInSession()));
    vi.stubGlobal("fetch", fetcher);
    const client = makeClient();

    await synchronizeReadyNotificationIntents(actorId, client);

    expect(fetcher).not.toHaveBeenCalled();
    expect(readNotificationIntents(actorId)[0]?.phase).toBe("prepared");
    client.clear();
  });

  it("retries the same ready UUID and sorted shipment set with the captured actor header", async () => {
    const prepared = prepareNotificationIntent({
      actorId,
      merchantId,
      serviceDate: "2026-10-22",
      shipmentIds: [shipmentId],
    });
    const { commitNotificationIntent } = await import("./notification-intents");
    const ready = await commitNotificationIntent(prepared);
    const requests: { path: string; init: RequestInit | undefined }[] = [];
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ path: pathOf(input), init });
      return pathOf(input).endsWith("get-session")
        ? Promise.resolve(signedInSession())
        : Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal("fetch", fetcher);
    const client = makeClient();

    await synchronizeReadyNotificationIntents(actorId, client);
    expect(readNotificationIntents(actorId)).toEqual([]);
    const markRequest = requests.find((request) => request.path.endsWith("/api/notifications"));
    expect(markRequest?.init?.method).toBe("POST");
    expect(new Headers(markRequest?.init?.headers).get("X-Domy-Actor-Id")).toBe(actorId);
    expect(bodyJson(markRequest?.init?.body)).toEqual({
      actionId: ready.actionId,
      shipmentIds: [shipmentId],
    });

    client.clear();
  });

  it("isolates pending actions from a different signed-in account and keeps them retryable", async () => {
    const prepared = prepareNotificationIntent({
      actorId,
      merchantId,
      serviceDate: "2026-10-22",
      shipmentIds: [shipmentId],
    });
    const { commitNotificationIntent } = await import("./notification-intents");
    await commitNotificationIntent(prepared);
    const fetcher = vi.fn(() => Promise.resolve(signedInSession(otherActorId)));
    vi.stubGlobal("fetch", fetcher);
    const client = makeClient();

    await expect(synchronizeReadyNotificationIntents(actorId, client)).rejects.toMatchObject({
      code: "actor_changed",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readNotificationIntents(actorId)[0]?.phase).toBe("ready");
    expect(readNotificationIntents(otherActorId)).toEqual([]);
    client.clear();
  });

  it("keeps a ready action and Spanish guidance after a server error", async () => {
    const prepared = prepareNotificationIntent({
      actorId,
      merchantId,
      serviceDate: "2026-10-22",
      shipmentIds: [shipmentId],
    });
    const { commitNotificationIntent } = await import("./notification-intents");
    const ready = await commitNotificationIntent(prepared);
    const fetcher = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        pathOf(input).endsWith("get-session")
          ? signedInSession()
          : Response.json(
              {
                error: {
                  code: "service_unavailable",
                  message: "No pudimos registrar la notificación. Intenta de nuevo.",
                },
              },
              { status: 503 },
            ),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const client = makeClient();

    await expect(synchronizeReadyNotificationIntents(actorId, client)).rejects.toMatchObject({
      code: "service_unavailable",
    });
    expect(readNotificationIntents(actorId)).toEqual([ready]);
    expect(client.getQueryData(notificationIntentsQueryOptions(actorId).queryKey)).toMatchObject({
      intents: [ready],
      guidance: "No pudimos registrar la notificación. Intenta de nuevo.",
    });
    client.clear();
  });

  it("invalidates successful notification lists when a later ready mark fails", async () => {
    const actionIds = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ];
    let actionIndex = 0;
    vi.stubGlobal("crypto", {
      randomUUID() {
        const id = actionIds[actionIndex];
        if (!id) throw new Error("Test action IDs were exhausted.");
        actionIndex += 1;
        return id;
      },
    });
    const firstPrepared = prepareNotificationIntent({
      actorId,
      merchantId,
      serviceDate: "2026-10-22",
      shipmentIds: [shipmentId],
    });
    const secondPrepared = prepareNotificationIntent({
      actorId,
      merchantId,
      serviceDate: "2026-10-22",
      shipmentIds: [secondShipmentId],
    });
    const { commitNotificationIntent } = await import("./notification-intents");
    const firstReady = await commitNotificationIntent(firstPrepared);
    const secondReady = await commitNotificationIntent(secondPrepared);
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (pathOf(input).endsWith("get-session")) return Promise.resolve(signedInSession());
      const request = notificationMarkInput.parse(bodyJson(init?.body));
      if (request.actionId === firstReady.actionId)
        return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(
        Response.json(
          {
            error: {
              code: "service_unavailable",
              message: "No pudimos registrar la notificación. Intenta de nuevo.",
            },
          },
          { status: 503 },
        ),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const client = makeClient();
    const listKey = notificationListQueryOptions(actorId, "2026-10-22").queryKey;
    client.setQueryData(listKey, { merchants: [] });

    await expect(synchronizeReadyNotificationIntents(actorId, client)).rejects.toMatchObject({
      code: "service_unavailable",
    });

    expect(readNotificationIntents(actorId)).toEqual([secondReady]);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryData(notificationIntentsQueryOptions(actorId).queryKey)).toMatchObject({
      intents: [secondReady],
      guidance: "No pudimos registrar la notificación. Intenta de nuevo.",
    });
    client.clear();
  });

  it("retries the same UUID after the server accepted a mark but local acknowledgment failed", async () => {
    const prepared = prepareNotificationIntent({
      actorId,
      merchantId,
      serviceDate: "2026-10-22",
      shipmentIds: [shipmentId],
    });
    const { commitNotificationIntent } = await import("./notification-intents");
    const ready = await commitNotificationIntent(prepared);
    const storage = installStorage();
    let blockAcknowledgment = true;
    storage.removeItem = (key: string) => {
      if (blockAcknowledgment) throw new DOMException("Storage is blocked", "QuotaExceededError");
      data.delete(key);
    };
    const bodies: unknown[] = [];
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (pathOf(input).endsWith("get-session")) return Promise.resolve(signedInSession());
      bodies.push(bodyJson(init?.body));
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal("fetch", fetcher);
    const client = makeClient();
    const listKey = notificationListQueryOptions(actorId, "2026-10-22").queryKey;
    client.setQueryData(listKey, { merchants: [] });

    await expect(synchronizeReadyNotificationIntents(actorId, client)).rejects.toMatchObject({
      code: "notification_storage_unavailable",
    });
    expect(readNotificationIntents(actorId)).toEqual([ready]);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    blockAcknowledgment = false;
    await synchronizeReadyNotificationIntents(actorId, client);

    expect(bodies).toEqual([
      { actionId: ready.actionId, shipmentIds: [shipmentId] },
      { actionId: ready.actionId, shipmentIds: [shipmentId] },
    ]);
    expect(readNotificationIntents(actorId)).toEqual([]);
    client.clear();
  });

  it("lets two tabs replay one ready identity and payload for server-side idempotency", async () => {
    const prepared = prepareNotificationIntent({
      actorId,
      merchantId,
      serviceDate: "2026-10-22",
      shipmentIds: [shipmentId],
    });
    const { commitNotificationIntent } = await import("./notification-intents");
    const ready = await commitNotificationIntent(prepared);
    const marks: { body: unknown; actorId: string | null }[] = [];
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (pathOf(input).endsWith("get-session")) return Promise.resolve(signedInSession());
      marks.push({
        body: bodyJson(init?.body),
        actorId: new Headers(init?.headers).get("X-Domy-Actor-Id"),
      });
      return Promise.resolve().then(() => new Response(null, { status: 204 }));
    });
    vi.stubGlobal("fetch", fetcher);
    const firstClient = makeClient();
    const secondClient = makeClient();

    await Promise.all([
      synchronizeReadyNotificationIntents(actorId, firstClient),
      synchronizeReadyNotificationIntents(actorId, secondClient),
    ]);

    expect(marks).toHaveLength(2);
    expect(marks).toEqual([
      { body: { actionId: ready.actionId, shipmentIds: [shipmentId] }, actorId },
      { body: { actionId: ready.actionId, shipmentIds: [shipmentId] }, actorId },
    ]);
    expect(readNotificationIntents(actorId)).toEqual([]);
    firstClient.clear();
    secondClient.clear();
  });
});
