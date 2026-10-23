import { accountCreateInput } from "@domy/domain";
import { z } from "zod";
import { ApiError } from "@/lib/api-client";
import { linkCourierAccount } from "@/features/master-data/api";
import { createAccount, setRole, updateAccount, validateAccountCreation } from "./api";
import {
  accountIntentDefinitiveRollback,
  accountLock,
  accountProblem,
  readAccountData,
  withAccountIntent,
} from "./account-intents";

// T132: Hono's inferred response remains the static contract; validate its runtime ACK too.
const linkAcknowledgment = z.object({
  courier: z
    .object({
      id: z.uuid(),
      name: z.string(),
      phone: z.string(),
      isActive: z.boolean(),
      aliases: z.array(z.string()),
      account: z.object({ id: z.uuid(), email: z.email() }).nullable(),
    })
    .nullable(),
}) satisfies z.ZodType<Awaited<ReturnType<typeof linkCourierAccount>>>;

const publicInput = accountCreateInput
  .omit({ id: true, password: true })
  .extend({ courierId: z.uuid().nullable() });
const originalAccount = publicInput.extend({ id: z.uuid() });
const phase = z.enum(["create", "profile", "role", "link"]);
const workflowSchema = z
  .strictObject({
    id: z.uuid(),
    actorId: z.uuid(),
    target: z.uuid().nullable(),
    input: publicInput,
    original: originalAccount.nullable(),
    identifiers: z.strictObject({
      create: z.uuid(),
      profile: z.uuid(),
      role: z.uuid(),
      link: z.uuid(),
    }),
    acknowledged: z.array(phase),
    createdUserId: z.uuid().nullable(),
  })
  .superRefine((value, context) => {
    if (
      value.target !== (value.original?.id ?? null) ||
      (value.target !== null && value.createdUserId !== value.target) ||
      (value.acknowledged.includes("create") && value.createdUserId === null)
    )
      context.addIssue({ code: "custom", message: "Invalid account workflow identity" });
  });
export type AccountWorkflow = z.output<typeof workflowSchema>;
export type AccountWorkflowInput = z.output<typeof publicInput>;
export type OriginalAccount = z.output<typeof originalAccount>;
const keyOf = (actorId: string, target: string | null) =>
  `domy:account-workflow:${actorId}:${target ?? "new"}`;

/** Reloading a dialog reads its public pending form and acknowledged phases, never a password. */
export async function readAccountWorkflow(actorId: string, target: string | null) {
  z.uuid().parse(actorId);
  if (target !== null) z.uuid().parse(target);
  const key = keyOf(actorId, target);
  return accountLock(key, () => {
    const value = readAccountData(key, workflowSchema);
    if (value && (value.actorId !== actorId || value.target !== target))
      throw accountProblem(
        "account_storage_invalid",
        "No pudimos verificar a quién pertenece el cambio pendiente. No borres sus datos; solicita ayuda.",
      );
    return value;
  });
}

async function acquireWorkflow(
  actorId: string,
  original: OriginalAccount | null,
  input: AccountWorkflowInput,
) {
  const proposed = workflowSchema.parse({
    id: crypto.randomUUID(),
    actorId,
    target: original?.id ?? null,
    original,
    input,
    identifiers: {
      create: crypto.randomUUID(),
      profile: crypto.randomUUID(),
      role: crypto.randomUUID(),
      link: crypto.randomUUID(),
    },
    acknowledged: [],
    createdUserId: original?.id ?? null,
  });
  const key = keyOf(actorId, proposed.target);
  return accountLock(key, () => {
    const existing = readAccountData(key, workflowSchema);
    if (existing) {
      if (
        existing.actorId !== actorId ||
        existing.target !== proposed.target ||
        JSON.stringify(existing.input) !== JSON.stringify(proposed.input)
      )
        throw accountProblem(
          "account_intent_pending",
          "Hay un cambio pendiente con otros datos. Reabre el formulario y reintenta esos datos antes de modificarlos.",
        );
      return existing;
    }
    localStorage.setItem(key, JSON.stringify(proposed));
    return proposed;
  });
}

async function acknowledgePhase(
  workflow: AccountWorkflow,
  name: z.output<typeof phase>,
  createdUserId = workflow.createdUserId,
) {
  const key = keyOf(workflow.actorId, workflow.target);
  return accountLock(key, () => {
    const current = readAccountData(key, workflowSchema);
    if (!current || current.id !== workflow.id)
      throw accountProblem(
        "account_intent_pending",
        "El cambio pendiente se actualizó en otra pestaña. Reabre el formulario antes de continuar.",
      );
    const next = workflowSchema.parse({
      ...current,
      createdUserId,
      acknowledged: [...new Set([...current.acknowledged, name])],
    });
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  });
}

/** 001/T132: fixed phase IDs also cover a crash between HTTP ACK and phase persistence. */
export async function runAccountWorkflow(
  actorId: string,
  original: OriginalAccount | null,
  input: AccountWorkflowInput,
  password: string,
) {
  if (!original) {
    const existing = await readAccountWorkflow(actorId, null);
    if (!existing?.acknowledged.includes("create"))
      validateAccountCreation({ name: input.name, email: input.email, role: input.role, password });
  }
  let workflow = await acquireWorkflow(actorId, original, input);
  try {
    const pending = (name: z.output<typeof phase>) => !workflow.acknowledged.includes(name);
    const context = (name: z.output<typeof phase>) => ({
      actorId,
      intentId: workflow.identifiers[name],
    });
    const desired = workflow.input;
    if (!workflow.original && pending("create")) {
      const { user } = await createAccount(
        { name: desired.name, email: desired.email, role: desired.role, password },
        context("create"),
      );
      workflow = await acknowledgePhase(workflow, "create", user.id);
    }
    const userId = workflow.createdUserId;
    if (!userId)
      throw accountProblem(
        "account_storage_invalid",
        "No pudimos verificar la cuenta del cambio pendiente. Reintenta sin cambiar sus datos.",
      );
    const previous = workflow.original;
    if (
      previous &&
      (previous.name !== desired.name || previous.email !== desired.email) &&
      pending("profile")
    ) {
      await updateAccount(userId, { name: desired.name, email: desired.email }, context("profile"));
      workflow = await acknowledgePhase(workflow, "profile");
    }
    const roleChanged = previous !== null && previous.role !== desired.role;
    if (roleChanged && desired.role === "courier" && pending("role")) {
      await setRole(userId, desired.role, context("role"));
      workflow = await acknowledgePhase(workflow, "role");
    }
    const wanted = desired.role === "courier" ? desired.courierId : null;
    if ((previous?.courierId ?? null) !== wanted && pending("link")) {
      await withAccountIntent(
        context("link"),
        userId,
        { operation: "link", input: { courierId: wanted } },
        async (actionId) => {
          const acknowledged = linkAcknowledgment.safeParse(
            await linkCourierAccount(userId, wanted, actorId, actionId),
          );
          if (
            !acknowledged.success ||
            (wanted === null
              ? acknowledged.data.courier !== null
              : acknowledged.data.courier?.id !== wanted ||
                acknowledged.data.courier.account?.id !== userId)
          )
            throw new ApiError(502, {
              code: "invalid_response",
              message:
                "No pudimos verificar la vinculación. Reintenta el cambio pendiente con los mismos datos.",
            });
          return acknowledged.data;
        },
      );
      workflow = await acknowledgePhase(workflow, "link");
    }
    if (roleChanged && desired.role !== "courier" && pending("role")) {
      await setRole(userId, desired.role, context("role"));
      workflow = await acknowledgePhase(workflow, "role");
    }
    const key = keyOf(actorId, workflow.target);
    await accountLock(key, () => {
      if (readAccountData(key, workflowSchema)?.id === workflow.id) localStorage.removeItem(key);
    });
  } catch (error) {
    if (accountIntentDefinitiveRollback(error)) {
      const key = keyOf(actorId, workflow.target);
      await accountLock(key, () => {
        const current = readAccountData(key, workflowSchema);
        // Another tab may have acknowledged a phase after this tab's initial read.
        if (current?.id === workflow.id && current.acknowledged.length === 0)
          localStorage.removeItem(key);
      });
    }
    throw error;
  }
}
