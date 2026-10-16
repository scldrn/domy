import { userRole } from "@domy/domain";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  courierDatabase,
  pauseCourierSynchronization,
  resetCourierState,
  resumeCourierSynchronization,
} from "@/features/courier/courier-store";
import { claimCourierDb, clearCourierDb, courierMeta, CourierDataError } from "@/lib/offline/db";
import { ApiError } from "@/lib/api-client";
import { syncClock } from "@/lib/clock";
import { removePush } from "@/lib/offline/push";

const sessionUser = z.object({ id: z.uuid(), name: z.string(), email: z.email(), role: userRole });
export type SessionUser = z.output<typeof sessionUser>;
const sessionBody = z.object({
  user: sessionUser,
  session: z.object({ expiresAt: z.iso.datetime({ offset: true }) }).optional(),
});

const networkError = new ApiError(0, {
  code: "network_error",
  message: "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.",
});

async function authRequest(path: string, body?: unknown): Promise<Response> {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      ...(body !== undefined && {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
    syncClock(response.headers.get("date"));
    return response;
  } catch {
    throw networkError;
  }
}

/** The signed-in user, or null. */
async function getSession(): Promise<SessionUser | null> {
  const response = await authRequest("get-session");
  if (response.status === 401) return null;
  if (!response.ok)
    throw new ApiError(response.status, {
      code:
        response.status >= 500 || [408, 429].includes(response.status)
          ? "session_unavailable"
          : "session_refused",
      message:
        "No pudimos verificar tu sesión con el servidor. Tus datos siguen guardados; intenta de nuevo.",
    });
  const json: unknown = await response.json();
  if (json === null) return null;
  const parsed = sessionBody.safeParse(json);
  if (!parsed.success)
    throw new ApiError(502, {
      code: "invalid_session",
      message: "No pudimos verificar tu sesión. Intenta de nuevo.",
    });
  const { user, session } = parsed.data;
  if (user.role === "courier" && session) {
    const db = await courierDatabase();
    const tx = db.transaction("meta", "readwrite");
    const value = await tx.store.get("current");
    const parsedMeta = value ? courierMeta.safeParse(value) : null;
    const meta = parsedMeta?.success ? parsedMeta.data : null;
    if (meta?.userId === user.id)
      await tx.store.put(
        { ...meta, sessionStatus: "active", sessionExpiresAt: session.expiresAt },
        "current",
      );
    await tx.done;
  }
  return user;
}

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: getSession,
  staleTime: 60_000,
});

/** Signs in with email and password; errors carry Spanish messages. */
export async function signIn(email: string, password: string): Promise<void> {
  await pauseCourierSynchronization();
  try {
    const response = await authRequest("sign-in/email", { email, password });
    if (response.ok) {
      try {
        const parsed = sessionBody.safeParse(await response.json());
        if (!parsed.success)
          throw new ApiError(502, {
            code: "invalid_session",
            message: "No pudimos verificar la cuenta. Intenta de nuevo.",
          });
        const db = await courierDatabase();
        await claimCourierDb(db, parsed.data.user.id);
        if (parsed.data.user.role !== "courier") await clearCourierDb(db);
        resetCourierState();
      } catch (error) {
        // A different account must not remain signed in over another courier's pending data.
        await authRequest("sign-out", {}).catch(() => undefined);
        if (error instanceof ApiError) throw error;
        throw new ApiError(409, {
          code: "courier_data_owned",
          message:
            error instanceof CourierDataError
              ? error.message
              : "No pudimos acceder al almacenamiento del sitio. Permite que el navegador guarde datos e intenta de nuevo. No borres los datos si tienes pendientes.",
        });
      }
      return;
    }
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
      error?: { code: string; message: string };
    };
    if (body.error) throw new ApiError(response.status, body.error);
    const messages: Record<number, string> = {
      401: "El correo o la contraseña no son correctos.",
      403: "Tu cuenta está desactivada. Comunícate con el propietario.",
      429: "Demasiados intentos. Espera un momento e intenta de nuevo.",
    };
    const message =
      messages[response.status] ?? "No pudimos iniciar sesión. Intenta de nuevo en un momento.";
    throw new ApiError(response.status, { code: body.code ?? "sign_in_failed", message });
  } finally {
    resumeCourierSynchronization();
  }
}

export async function signOut(): Promise<void> {
  await pauseCourierSynchronization();
  try {
    const db = await courierDatabase();
    if ((await db.count("outbox")) > 0 || (await db.count("photos")) > 0)
      throw new ApiError(409, {
        code: "courier_pending",
        message:
          "Tienes registros o fotos pendientes por sincronizar. Espera a que lleguen antes de cerrar sesión.",
      });
    await removePush().catch(() => undefined);
    const response = await authRequest("sign-out", {});
    if (!response.ok)
      throw new ApiError(response.status, {
        code: "sign_out_failed",
        message: "No pudimos cerrar la sesión. Intenta de nuevo.",
      });
    await clearCourierDb(db);
    resetCourierState();
  } finally {
    resumeCourierSynchronization();
  }
}

/** Better Auth error codes, said in Spanish. */
const authMessages: Record<string, string> = {
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese correo.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese correo.",
  PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 8 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña puede tener hasta 128 caracteres.",
  INVALID_PASSWORD: "La contraseña actual no es correcta.",
  INVALID_TOKEN: "El enlace no es válido o venció. Pide uno nuevo.",
  INVALID_EMAIL: "Escribe un correo válido.",
  YOU_CANNOT_BAN_YOURSELF: "No puedes desactivar tu propia cuenta.",
};

/**
 * A Better Auth call that throws an ApiError with a Spanish message; Domy's own rules
 * (lockout, last owner) already answer in Spanish.
 */
export async function authCall<T>(path: string, body?: unknown): Promise<T> {
  const response = await authRequest(path, body);
  const json = (await response.json().catch(() => null)) as
    (T & { code?: string; error?: { code: string; message: string } }) | null;
  if (response.ok) return json as T;
  if (json?.error) throw new ApiError(response.status, json.error);
  const code = json?.code ?? "auth_error";
  throw new ApiError(response.status, {
    code,
    message: authMessages[code] ?? "No pudimos completar la acción. Intenta de nuevo.",
  });
}

export const requestPasswordReset = (email: string) =>
  authCall("request-password-reset", { email, redirectTo: "/restablecer" });

export const resetPassword = (token: string, newPassword: string) =>
  authCall("reset-password", { token, newPassword });

export const changePassword = (currentPassword: string, newPassword: string) =>
  authCall("change-password", { currentPassword, newPassword, revokeOtherSessions: true });
