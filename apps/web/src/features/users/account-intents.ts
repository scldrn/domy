import { accountCreateInput, accountRoleInput, accountUpdateInput } from "@domy/domain";
import { z } from "zod";
import { ApiError } from "@/lib/api-client";

/** 001/T132/R19: only public inputs may enter durable browser account metadata. */
const publicCreate = accountCreateInput.omit({ id: true, password: true });
const publicProfile = accountUpdateInput.shape.data;
const operation = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("create"), input: publicCreate }),
  z.strictObject({ operation: z.literal("profile"), input: publicProfile }),
  z.strictObject({
    operation: z.literal("role"),
    input: z.strictObject({ role: accountRoleInput.shape.role }),
  }),
  z.strictObject({ operation: z.enum(["ban", "unban", "revoke"]), input: z.strictObject({}) }),
  z.strictObject({
    operation: z.literal("link"),
    input: z.strictObject({ courierId: z.uuid().nullable() }),
  }),
]);
export type AccountOperation = z.output<typeof operation>;
const identity = z.strictObject({ actorId: z.uuid(), target: z.uuid().nullable(), id: z.uuid() });
const intentSchema = z
  .discriminatedUnion("operation", [
    operation.options[0].extend(identity.shape),
    operation.options[1].extend(identity.shape),
    operation.options[2].extend(identity.shape),
    operation.options[3].extend(identity.shape),
    operation.options[4].extend(identity.shape),
  ])
  .superRefine((value, context) => {
    if ((value.operation === "create") !== (value.target === null))
      context.addIssue({ code: "custom", message: "Invalid operation target" });
  });
export type AccountIntent = z.output<typeof intentSchema>;
export type AccountContext = { actorId: string; intentId?: string };

export function accountProblem(code: string, message: string) {
  return new ApiError(409, { code, message });
}

export async function accountLock<T>(key: string, work: () => T): Promise<T> {
  try {
    if (typeof navigator.locks.request !== "function") throw new Error("Web Locks unavailable");
    return await navigator.locks.request(key, work);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw accountProblem(
      "account_storage_unavailable",
      "No pudimos guardar el cambio pendiente. Permite el almacenamiento del sitio e intenta de nuevo; no borres sus datos.",
    );
  }
}

export function readAccountData<T>(key: string, schema: z.ZodType<T>): T | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const parsed = schema.safeParse(JSON.parse(raw));
  if (!parsed.success)
    throw accountProblem(
      "account_storage_invalid",
      "Hay un cambio pendiente que no pudimos verificar. No borres los datos; solicita ayuda antes de continuar.",
    );
  return parsed.data;
}

const targetLock = (actorId: string, target: string | null) =>
  `domy:account-target:${actorId}:${target ?? "new"}`;
const operationNames = ["create", "profile", "role", "ban", "unban", "revoke", "link"] as const;
const keyOf = (actorId: string, name: string, target: string | null) =>
  `domy:account-intent:${actorId}:${name}:${target ?? "new"}`;

function pendingForTarget(actorId: string, target: string | null) {
  let pending: AccountIntent | null = null;
  for (const name of operationNames) {
    const stored = readAccountData(keyOf(actorId, name, target), intentSchema);
    if (!stored) continue;
    if (
      stored.actorId !== actorId ||
      stored.target !== target ||
      stored.operation !== name ||
      pending
    )
      throw accountProblem(
        "account_storage_invalid",
        "No pudimos verificar los cambios pendientes de esta cuenta. No borres sus datos; solicita ayuda.",
      );
    pending = stored;
  }
  return pending;
}

export async function readPendingAccountIntent(actorId: string, target: string) {
  z.uuid().parse(actorId);
  z.uuid().parse(target);
  return accountLock(targetLock(actorId, target), () => pendingForTarget(actorId, target));
}

export async function acquireAccountIntent(
  context: AccountContext,
  target: string | null,
  publicInput: AccountOperation,
) {
  const proposed = intentSchema.parse({
    ...publicInput,
    actorId: context.actorId,
    target,
    id: context.intentId ?? crypto.randomUUID(),
  });
  const key = keyOf(proposed.actorId, proposed.operation, proposed.target);
  return accountLock(targetLock(proposed.actorId, proposed.target), () => {
    const existing = pendingForTarget(proposed.actorId, proposed.target);
    if (existing) {
      if (
        existing.actorId !== proposed.actorId ||
        existing.target !== proposed.target ||
        existing.operation !== proposed.operation ||
        JSON.stringify(existing.input) !== JSON.stringify(proposed.input) ||
        (context.intentId !== undefined && existing.id !== proposed.id)
      )
        throw accountProblem(
          "account_intent_pending",
          "Primero reintenta el cambio pendiente con sus datos originales. No lo reemplazamos para evitar duplicarlo.",
        );
      return existing;
    }
    localStorage.setItem(key, JSON.stringify(proposed));
    return proposed;
  });
}

/** A delayed ACK may never erase a newer attempt from another tab. */
export async function acknowledgeAccountIntent(intent: AccountIntent) {
  const key = keyOf(intent.actorId, intent.operation, intent.target);
  await accountLock(targetLock(intent.actorId, intent.target), () => {
    const pending = readAccountData(key, intentSchema);
    if (pending?.id === intent.id) localStorage.removeItem(key);
  });
}

/** Only this verified native admin rejection happens after receipt lookup and rollback. */
export function accountIntentDefinitiveRollback(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  );
}

export async function withAccountIntent<T>(
  context: AccountContext,
  target: string | null,
  input: AccountOperation,
  send: (id: string) => Promise<T>,
): Promise<T> {
  const pending = await acquireAccountIntent(context, target, input);
  try {
    // The lock is already released. Concurrent matching tabs send the same server identity.
    const result = await send(pending.id);
    await acknowledgeAccountIntent(pending);
    return result;
  } catch (error) {
    // Uncertainty, authentication loss and identity conflicts must retain the original UUID.
    if (accountIntentDefinitiveRollback(error)) await acknowledgeAccountIntent(pending);
    throw error;
  }
}
