import { calendarDate, notificationMarkInput } from "@domy/domain";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError } from "@/lib/api-client";

const intentSchema = z.strictObject({
  actorId: z.uuid(),
  actionId: z.uuid(),
  merchantId: z.uuid(),
  serviceDate: calendarDate,
  shipmentIds: notificationMarkInput.shape.shipmentIds,
  phase: z.enum(["prepared", "ready"]),
});

export type NotificationIntent = z.output<typeof intentSchema>;
export type NotificationIntentInput = {
  actorId: string;
  merchantId: string;
  serviceDate: string;
  shipmentIds: readonly string[];
};
export type NotificationIntentSnapshot = {
  intents: NotificationIntent[];
  guidance: string | null;
};

const storagePrefix = "domy:notification-intent:";

function notificationProblem(code: string, message: string, status = 409): ApiError {
  return new ApiError(status, { code, message });
}

function unavailable(): ApiError {
  return notificationProblem(
    "notification_storage_unavailable",
    "No pudimos guardar o verificar la notificación pendiente. Permite el almacenamiento del sitio e intenta de nuevo; no borres sus datos.",
  );
}

function invalidStoredIntent(): ApiError {
  return notificationProblem(
    "notification_storage_invalid",
    "Hay una notificación pendiente que no pudimos verificar. No borres los datos del sitio; solicita ayuda antes de continuar.",
  );
}

function inputInvalid(): ApiError {
  return notificationProblem(
    "notification_intent_invalid",
    "Revisa el cliente, la fecha y los envíos seleccionados antes de continuar.",
    422,
  );
}

function lockConflict(): ApiError {
  return notificationProblem(
    "notification_intent_changed",
    "La notificación pendiente cambió en otra pestaña. Revisa el estado antes de volver a compartir.",
  );
}

function canonicalUuid(value: string): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw inputInvalid();
  return parsed.data.toLowerCase();
}

function parseIntent(value: unknown, expectedKey?: string): NotificationIntent {
  let decoded: unknown;
  try {
    decoded = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw invalidStoredIntent();
  }
  const parsed = intentSchema.safeParse(decoded);
  if (!parsed.success) throw invalidStoredIntent();
  const intent = parsed.data;
  const canonicalIds = intent.shipmentIds.map((id) => id.toLowerCase()).sort();
  if (
    intent.actorId !== intent.actorId.toLowerCase() ||
    intent.actionId !== intent.actionId.toLowerCase() ||
    intent.merchantId !== intent.merchantId.toLowerCase() ||
    intent.shipmentIds.some((id, index) => id !== canonicalIds[index]) ||
    (expectedKey !== undefined && expectedKey !== keyFor(intent.actorId, intent.actionId))
  )
    throw invalidStoredIntent();
  return intent;
}

function keyFor(actorId: string, actionId: string): string {
  return `${storagePrefix}${actorId}:${actionId}`;
}

function actorPrefix(actorId: string): string {
  return `${storagePrefix}${actorId}:`;
}

function storage(): Storage {
  try {
    if (typeof localStorage === "undefined") throw new Error("localStorage unavailable");
    return localStorage;
  } catch {
    throw unavailable();
  }
}

function readStored(key: string): NotificationIntent | null {
  let raw: string | null;
  try {
    raw = storage().getItem(key);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unavailable();
  }
  if (raw === null) return null;
  return parseIntent(raw, key);
}

function sameIdentity(left: NotificationIntent, right: NotificationIntent): boolean {
  return (
    left.actorId === right.actorId &&
    left.actionId === right.actionId &&
    left.merchantId === right.merchantId &&
    left.serviceDate === right.serviceDate &&
    left.shipmentIds.length === right.shipmentIds.length &&
    left.shipmentIds.every((id, index) => id === right.shipmentIds[index])
  );
}

function parseExpected(intent: NotificationIntent): NotificationIntent {
  return parseIntent(intent);
}

function writeIntent(intent: NotificationIntent): void {
  try {
    storage().setItem(keyFor(intent.actorId, intent.actionId), JSON.stringify(intent));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unavailable();
  }
}

function removeIntent(intent: NotificationIntent): void {
  try {
    storage().removeItem(keyFor(intent.actorId, intent.actionId));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unavailable();
  }
}

async function withIntentLock<T>(
  intent: NotificationIntent,
  work: () => T | Promise<T>,
): Promise<T> {
  try {
    const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
    if (!locks || typeof locks.request !== "function") throw new Error("Web Locks unavailable");
    return await locks.request(lockName(intent), work);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unavailable();
  }
}

function lockName(intent: NotificationIntent): string {
  return `domy:notification-intent-lock:${intent.actorId}:${intent.actionId}`;
}

/** Synchronously persist the action before a caller opens a popup or copies a message. */
export function prepareNotificationIntent(input: NotificationIntentInput): NotificationIntent {
  const actionId = (() => {
    try {
      return crypto.randomUUID().toLowerCase();
    } catch {
      throw unavailable();
    }
  })();
  const shipmentInput = notificationMarkInput.safeParse({
    actionId,
    shipmentIds: input.shipmentIds,
  });
  const serviceDate = calendarDate.safeParse(input.serviceDate);
  if (!shipmentInput.success || !serviceDate.success) throw inputInvalid();
  const actorId = canonicalUuid(input.actorId);
  const merchantId = canonicalUuid(input.merchantId);
  const intent = intentSchema.parse({
    actorId,
    actionId,
    merchantId,
    serviceDate: serviceDate.data,
    shipmentIds: shipmentInput.data.shipmentIds.map((id) => id.toLowerCase()).sort(),
    phase: "prepared",
  });
  readNotificationIntents(intent.actorId);
  const key = keyFor(intent.actorId, intent.actionId);
  try {
    if (storage().getItem(key) !== null) throw lockConflict();
    writeIntent(intent);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unavailable();
  }
  return intent;
}

/** Actor-scoped snapshot for the notification panel and its one mounted sync hook. */
export function readNotificationIntents(actorId: string): NotificationIntent[] {
  const canonicalActorId = canonicalUuid(actorId);
  const prefix = actorPrefix(canonicalActorId);
  const currentStorage = storage();
  const results: NotificationIntent[] = [];
  try {
    for (let index = 0; index < currentStorage.length; index += 1) {
      const key = currentStorage.key(index);
      if (key === null || !key.startsWith(prefix)) continue;
      const intent = readStored(key);
      if (intent === null) continue;
      if (intent.actorId !== canonicalActorId) throw invalidStoredIntent();
      results.push(intent);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unavailable();
  }
  return results.sort((left, right) => left.actionId.localeCompare(right.actionId));
}

export function notificationIntentsQueryOptions(actorId: string) {
  const canonicalActorId = canonicalUuid(actorId);
  return queryOptions({
    queryKey: ["notification-intents", canonicalActorId],
    queryFn: (): NotificationIntentSnapshot => ({
      intents: readNotificationIntents(canonicalActorId),
      guidance: null,
    }),
    staleTime: Infinity,
  });
}

/** Promote only the exact prepared action after its external open/copy succeeded. */
export async function commitNotificationIntent(
  intent: NotificationIntent,
  supersededPrepared?: NotificationIntent,
): Promise<NotificationIntent> {
  const expected = parseExpected(intent);
  if (supersededPrepared) {
    const superseded = parseExpected(supersededPrepared);
    if (
      superseded.phase !== "prepared" ||
      superseded.actorId !== expected.actorId ||
      superseded.merchantId !== expected.merchantId ||
      superseded.serviceDate !== expected.serviceDate
    )
      throw lockConflict();
  }

  const ready = await withIntentLock(expected, () => {
    const current = readStored(keyFor(expected.actorId, expected.actionId));
    if (!current || !sameIdentity(current, expected)) throw lockConflict();
    if (expected.phase === "ready" && current.phase !== "ready") throw lockConflict();
    if (current.phase === "ready") return current;
    const promoted: NotificationIntent = { ...current, phase: "ready" };
    writeIntent(promoted);
    return promoted;
  });

  if (
    supersededPrepared &&
    keyFor(supersededPrepared.actorId, supersededPrepared.actionId) !==
      keyFor(ready.actorId, ready.actionId)
  ) {
    await withIntentLock(supersededPrepared, () => {
      const current = readStored(keyFor(supersededPrepared.actorId, supersededPrepared.actionId));
      if (current?.phase === "prepared" && sameIdentity(current, supersededPrepared))
        removeIntent(current);
    });
  }
  return ready;
}

/** A failed external open/copy may discard only the same action while it is still prepared. */
export async function discardPreparedNotificationIntent(
  intent: NotificationIntent,
): Promise<boolean> {
  const expected = parseExpected(intent);
  if (expected.phase !== "prepared") return false;
  return withIntentLock(expected, () => {
    const current = readStored(keyFor(expected.actorId, expected.actionId));
    if (!current || current.phase !== "prepared" || !sameIdentity(current, expected)) return false;
    removeIntent(current);
    return true;
  });
}

/** Remove only the exact ready identity that the server acknowledged. */
export async function acknowledgeNotificationIntent(intent: NotificationIntent): Promise<boolean> {
  const expected = parseExpected(intent);
  if (expected.phase !== "ready") return false;
  return withIntentLock(expected, () => {
    const current = readStored(keyFor(expected.actorId, expected.actionId));
    if (!current || current.phase !== "ready" || !sameIdentity(current, expected)) return false;
    removeIntent(current);
    return true;
  });
}
