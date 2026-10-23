import { accountCreateInput, userRole, type UserRole } from "@domy/domain";
import type { Auth } from "@domy/server/app";
import type { JSONParsed } from "hono/utils/types";
import { z } from "zod";
import { ApiError } from "@/lib/api-client";
import { withAccountIntent, type AccountContext } from "./account-intents";
import { authCall } from "@/features/auth/session";

/** Accounts, managed by the owner through Better Auth's admin endpoints (FR-032). */

type NativeAccount = JSONParsed<Awaited<ReturnType<Auth["api"]["listUsers"]>>["users"][number]>;
export type Account = Pick<NativeAccount, "id" | "name" | "email" | "createdAt" | "banned"> & {
  role: z.output<typeof userRole>;
};

// Native Better Auth serializes Date to ISO JSON; Domy's configured roles come from domain.
const account = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: userRole,
  banned: z.boolean().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
}) satisfies z.ZodType<Account>;
const accountList = z.object({ users: z.array(account) });
type NativeCreatedAccount = Awaited<ReturnType<Auth["api"]["createUser"]>>;
const createdAccount = z.object({ user: z.object({ id: z.uuid() }) }) satisfies z.ZodType<{
  user: Pick<NativeCreatedAccount["user"], "id">;
}>;
const actorHeaders = (context: AccountContext) => ({ "X-Domy-Actor-Id": context.actorId });

export async function listAccounts(): Promise<Account[]> {
  const result = accountList.safeParse(
    await authCall("admin/list-users?limit=500&sortBy=name&sortDirection=asc"),
  );
  if (!result.success)
    throw new ApiError(502, {
      code: "invalid_response",
      message: "No pudimos verificar las cuentas. Intenta de nuevo.",
    });
  return result.data.users;
}

const creationForm = accountCreateInput.omit({ id: true });

/** Shared form/API guard; never persist the password or discard an earlier uncertain ID. */
export function validateAccountCreation(input: z.input<typeof creationForm>) {
  const parsed = creationForm.safeParse(input);
  if (!parsed.success)
    throw new ApiError(422, {
      code: "account_input_invalid",
      message: "Revisa el nombre y el correo, y escribe una contraseña entre 8 y 128 caracteres.",
    });
  return parsed.data;
}

export const createAccount = async (
  input: { name: string; email: string; role: UserRole; password: string },
  context: AccountContext,
) => {
  const validated = validateAccountCreation(input);
  return withAccountIntent(
    context,
    null,
    {
      operation: "create",
      input: { name: validated.name, email: validated.email, role: validated.role },
    },
    async (id) => {
      const result = createdAccount.safeParse(
        await authCall("admin/create-user", { ...validated, id }, actorHeaders(context)),
      );
      if (!result.success)
        throw new ApiError(502, {
          code: "invalid_response",
          message:
            "No pudimos verificar la cuenta creada. Reintenta con los mismos datos para recuperar su confirmación.",
        });
      return result.data;
    },
  );
};

const userEnvelope = z.object({ user: account });
function verified<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(502, {
      code: "invalid_response",
      message: "No pudimos verificar el cambio. Reintenta con los mismos datos.",
    });
  return result.data;
}
export const updateAccount = (
  userId: string,
  data: { name: string; email: string },
  context: AccountContext,
) =>
  withAccountIntent(context, userId, { operation: "profile", input: data }, async (actionId) =>
    verified(
      account,
      await authCall("admin/update-user", { userId, data, actionId }, actorHeaders(context)),
    ),
  );

export const setRole = (userId: string, role: UserRole, context: AccountContext) =>
  withAccountIntent(context, userId, { operation: "role", input: { role } }, async (actionId) =>
    verified(
      userEnvelope,
      await authCall("admin/set-role", { userId, role, actionId }, actorHeaders(context)),
    ),
  );

export const deactivateAccount = (userId: string, context: AccountContext) =>
  withAccountIntent(context, userId, { operation: "ban", input: {} }, async (actionId) =>
    verified(
      userEnvelope,
      await authCall("admin/ban-user", { userId, actionId }, actorHeaders(context)),
    ),
  );

export const reactivateAccount = (userId: string, context: AccountContext) =>
  withAccountIntent(context, userId, { operation: "unban", input: {} }, async (actionId) =>
    verified(
      userEnvelope,
      await authCall("admin/unban-user", { userId, actionId }, actorHeaders(context)),
    ),
  );

export const endSessions = (userId: string, context: AccountContext) =>
  withAccountIntent(context, userId, { operation: "revoke", input: {} }, async (actionId) =>
    verified(
      z.object({ success: z.literal(true) }),
      await authCall("admin/revoke-user-sessions", { userId, actionId }, actorHeaders(context)),
    ),
  );
