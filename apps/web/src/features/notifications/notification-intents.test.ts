import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  acknowledgeNotificationIntent,
  commitNotificationIntent,
  discardPreparedNotificationIntent,
  prepareNotificationIntent,
  readNotificationIntents,
} from "./notification-intents";

const actorId = "b4f67dc0-f16e-4ac7-ae2b-1bc61cbd38a0";
const otherActorId = "5a88ec2e-5c87-466d-a690-c4fb3e6b85c2";
const merchantId = "4a1966eb-dc9e-47eb-8cab-8c6cc999b293";
const shipmentOne = "f3b6a343-117e-4df5-8818-9ba610b1386f";
const shipmentTwo = "75a4b63b-ae32-4cdc-b0e1-d71c23db68b8";
const baseInput = {
  actorId,
  merchantId,
  serviceDate: "2026-10-22",
  shipmentIds: [shipmentTwo.toUpperCase(), shipmentOne],
};

const data = new Map<string, string>();
let removeObservedNewKey = false;

function storedKeys(): string[] {
  return [...data.keys()];
}

function notificationStorage() {
  return {
    get length() {
      return data.size;
    },
    key(index: number) {
      return storedKeys()[index] ?? null;
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      if (key.startsWith("domy:notification-intent:") && data.size > 1)
        removeObservedNewKey = storedKeys().some((stored) => stored !== key);
      data.delete(key);
    },
  };
}

function nativeLocks() {
  const tails = new Map<string, Promise<void>>();
  return {
    request: <T>(name: string, callback: () => T | PromiseLike<T>): Promise<T> => {
      const previous = tails.get(name) ?? Promise.resolve();
      let release = () => {};
      const queued = new Promise<void>((resolve) => {
        release = resolve;
      });
      tails.set(
        name,
        previous.then(() => queued),
      );
      return previous.then(callback).finally(() => {
        release();
      });
    },
  };
}

function firstKey(): string {
  const key = storedKeys()[0];
  if (!key) throw new Error("The notification intent was not persisted.");
  return key;
}

beforeEach(() => {
  data.clear();
  removeObservedNewKey = false;
  vi.stubGlobal("localStorage", notificationStorage());
  vi.stubGlobal("navigator", { locks: nativeLocks() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("durable notification intents", () => {
  it("persists only canonical action metadata synchronously in a prepared phase", () => {
    const intent = prepareNotificationIntent(baseInput);

    expect(intent).toMatchObject({
      actorId,
      merchantId,
      serviceDate: "2026-10-22",
      shipmentIds: [shipmentTwo, shipmentOne],
      phase: "prepared",
    });
    expect(intent.actionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
    const raw = data.get(firstKey());
    if (raw === undefined) throw new Error("The notification intent was not persisted.");
    expect(raw).toBe(
      JSON.stringify({
        actorId,
        actionId: intent.actionId,
        merchantId,
        serviceDate: "2026-10-22",
        shipmentIds: [shipmentTwo, shipmentOne],
        phase: "prepared",
      }),
    );
    expect(data.get(firstKey())).not.toContain("PRIVATE_PHONE");
    expect(data.get(firstKey())).not.toContain("PRIVATE_BEARER");
    expect(data.get(firstKey())).not.toContain("message text");
  });

  it("blocks the external-action caller when initial persistence is denied", () => {
    const externalAction = vi.fn();
    vi.stubGlobal("localStorage", {
      ...notificationStorage(),
      setItem() {
        throw new DOMException("Storage is blocked", "QuotaExceededError");
      },
    });

    expect(() => {
      const intent = prepareNotificationIntent(baseInput);
      externalAction(intent);
    }).toThrow(ApiError);
    expect(externalAction).not.toHaveBeenCalled();
    expect(data.size).toBe(0);
  });

  it.each(["{broken", JSON.stringify({ actionId: "not-an-id" })])(
    "preserves corrupt local data and refuses to read or send it",
    (raw) => {
      prepareNotificationIntent(baseInput);
      const key = firstKey();
      data.set(key, raw);

      expect(() => readNotificationIntents(actorId)).toThrow(
        expect.objectContaining({ code: "notification_storage_invalid" }),
      );
      expect(data.get(key)).toBe(raw);
    },
  );

  it("rediscovers prepared intents without making them eligible for automatic sync", () => {
    const prepared = prepareNotificationIntent(baseInput);

    expect(readNotificationIntents(actorId)).toEqual([prepared]);
    expect(readNotificationIntents(otherActorId)).toEqual([]);
    expect(prepared.phase).toBe("prepared");
  });

  it("keeps actor-mismatched metadata intact and refuses to return it to either account", () => {
    const prepared = prepareNotificationIntent(baseInput);
    const key = firstKey();
    const mismatched = { ...prepared, actorId: otherActorId };
    data.set(key, JSON.stringify(mismatched));

    expect(() => readNotificationIntents(actorId)).toThrow(
      expect.objectContaining({ code: "notification_storage_invalid" }),
    );
    expect(() => readNotificationIntents(otherActorId)).not.toThrow();
    expect(data.get(key)).toBe(JSON.stringify(mismatched));
  });

  it("rejects a record whose action UUID does not match its storage key without deleting it", () => {
    const prepared = prepareNotificationIntent(baseInput);
    const key = firstKey();
    const mismatched = { ...prepared, actionId: crypto.randomUUID() };
    data.set(key, JSON.stringify(mismatched));

    expect(() => readNotificationIntents(actorId)).toThrow(
      expect.objectContaining({ code: "notification_storage_invalid" }),
    );
    expect(data.get(key)).toBe(JSON.stringify(mismatched));
  });

  it("fails closed on corrupt actor storage before preparing another external action", () => {
    prepareNotificationIntent(baseInput);
    const key = firstKey();
    data.set(key, "{broken");
    const previousKeys = storedKeys();

    expect(() => prepareNotificationIntent(baseInput)).toThrow(
      expect.objectContaining({ code: "notification_storage_invalid" }),
    );
    expect(storedKeys()).toEqual(previousKeys);
    expect(data.get(key)).toBe("{broken");
  });

  it("keeps the prepared copy when promoting to ready cannot be persisted", async () => {
    const prepared = prepareNotificationIntent(baseInput);
    const storage = notificationStorage();
    let writes = 0;
    vi.stubGlobal("localStorage", {
      ...storage,
      get length() {
        return storage.length;
      },
      key: (index: number) => storage.key(index),
      getItem: (key: string) => storage.getItem(key),
      setItem(key: string, value: string) {
        writes += 1;
        if (writes > 0) throw new DOMException("Storage is blocked", "QuotaExceededError");
        storage.setItem(key, value);
      },
      removeItem: (key: string) => {
        storage.removeItem(key);
      },
    });

    await expect(commitNotificationIntent(prepared)).rejects.toMatchObject({
      code: "notification_storage_unavailable",
    });
    expect(readNotificationIntents(actorId)).toEqual([prepared]);
  });

  it("persists a replacement first and removes only the superseded prepared key", async () => {
    const oldPrepared = prepareNotificationIntent(baseInput);
    const replacement = prepareNotificationIntent(baseInput);
    expect(storedKeys()).toHaveLength(2);

    const ready = await commitNotificationIntent(replacement, oldPrepared);

    expect(removeObservedNewKey).toBe(true);
    expect(ready.phase).toBe("ready");
    expect(readNotificationIntents(actorId)).toEqual([ready]);
  });

  it("never deletes a concurrently ready intent and ACK only removes its exact key", async () => {
    const oldPrepared = prepareNotificationIntent(baseInput);
    const replacement = prepareNotificationIntent(baseInput);
    const oldReady = await commitNotificationIntent(oldPrepared);
    const replacementReady = await commitNotificationIntent(replacement, oldPrepared);

    expect(readNotificationIntents(actorId)).toEqual(
      expect.arrayContaining([oldReady, replacementReady]),
    );
    expect(readNotificationIntents(actorId)).toHaveLength(2);
    await acknowledgeNotificationIntent(oldReady);
    expect(readNotificationIntents(actorId)).toEqual([replacementReady]);
  });

  it("serializes a prepared discard racing its ready promotion", async () => {
    const prepared = prepareNotificationIntent(baseInput);

    const [ready, discarded] = await Promise.all([
      commitNotificationIntent(prepared),
      discardPreparedNotificationIntent(prepared),
    ]);

    expect(ready.phase).toBe("ready");
    expect(discarded).toBe(false);
    expect(readNotificationIntents(actorId)).toEqual([ready]);
  });

  it("discards only a still-prepared action after a failed external open or copy", async () => {
    const prepared = prepareNotificationIntent(baseInput);
    expect(await discardPreparedNotificationIntent(prepared)).toBe(true);
    expect(readNotificationIntents(actorId)).toEqual([]);

    const ready = await commitNotificationIntent(prepareNotificationIntent(baseInput));
    expect(await discardPreparedNotificationIntent(ready)).toBe(false);
    expect(readNotificationIntents(actorId)).toEqual([ready]);
  });
});
