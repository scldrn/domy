import { userRole } from "@domy/domain";
import { queryOptions, type QueryFunctionContext } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError, apiErrorBody } from "@/lib/api-client";
import { syncClock } from "@/lib/clock";

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

/**
 * The phone's offline store, loaded when a session needs it rather than with the app: the
 * routes' guards use `sessionQuery`, so a static import would put the courier's store, IndexedDB
 * and records on every page, the public tracking page included (constitution: status within 3 s
 * on a weak mobile connection). A chunk that cannot load is a connection problem.
 */
function courierStorage() {
  return Promise.all([import("@/features/courier/courier-store"), import("@/lib/offline/db")]).then(
    ([store, db]) => ({ ...store, ...db }),
    () => {
      throw networkError;
    },
  );
}

async function authRequest(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<Response> {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      ...(signal && { signal }),
      ...(body !== undefined && {
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
      ...(body === undefined && headers && { headers }),
    });
    syncClock(response.headers.get("date"));
    return response;
  } catch {
    throw networkError;
  }
}

/** The signed-in user, or null. */
async function getSession({ signal }: QueryFunctionContext): Promise<SessionUser | null> {
  // 003 T131/R13: a connection lost during verification must release cached navigation,
  // not leave every loader awaiting the same unresolved Query promise. Mutations are untouched.
  const controller = new AbortController();
  const abort = () => {
    controller.abort();
  };
  signal.addEventListener("abort", abort, { once: true });
  window.addEventListener("offline", abort, { once: true });
  if (signal.aborted || !navigator.onLine) abort();
  try {
    const response = await authRequest("get-session", undefined, controller.signal);
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
      const { courierDatabase, courierMeta } = await courierStorage();
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
  } catch (error) {
    // Fetch may already have returned headers when its body is interrupted.
    if (controller.signal.aborted && error instanceof DOMException && error.name === "AbortError")
      throw networkError;
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    window.removeEventListener("offline", abort);
  }
}

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: getSession,
  staleTime: 60_000,
});

/** Signs in with email and password; errors carry Spanish messages. */
export async function signIn(email: string, password: string): Promise<void> {
  const {
    courierDatabase,
    claimCourierDb,
    clearCourierDb,
    CourierDataError,
    pauseCourierSynchronization,
    resetCourierState,
    resumeCourierSynchronization,
  } = await courierStorage();
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
    const body = z
      .object({ code: z.string().optional(), error: apiErrorBody.optional() })
      .safeParse(await response.json().catch(() => null));
    if (body.success && body.data.error) throw new ApiError(response.status, body.data.error);
    const messages: Record<number, string> = {
      401: "El correo o la contraseña no son correctos.",
      403: "Tu cuenta está desactivada. Comunícate con el propietario.",
      429: "Demasiados intentos. Espera un momento e intenta de nuevo.",
    };
    const message =
      messages[response.status] ?? "No pudimos iniciar sesión. Intenta de nuevo en un momento.";
    throw new ApiError(response.status, {
      code: (body.success ? body.data.code : undefined) ?? "sign_in_failed",
      message,
    });
  } finally {
    resumeCourierSynchronization();
  }
}

export async function signOut(): Promise<void> {
  const {
    courierDatabase,
    clearCourierDb,
    pauseCourierSynchronization,
    resetCourierState,
    resumeCourierSynchronization,
  } = await courierStorage();
  await pauseCourierSynchronization();
  try {
    const db = await courierDatabase();
    if ((await db.count("outbox")) > 0 || (await db.count("photos")) > 0)
      throw new ApiError(409, {
        code: "courier_pending",
        message:
          "Tienes registros o fotos pendientes por sincronizar. Espera a que lleguen antes de cerrar sesión.",
      });
    await import("@/lib/offline/push")
      .then(({ removePush }) => removePush())
      .catch(() => undefined);
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
const actorChangedMessage =
  "La sesión cambió de cuenta. Reabre la cuenta original para recuperar o continuar el cambio pendiente.";
const authMessages: Record<string, string> = {
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese correo.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese correo.",
  PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 8 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña puede tener hasta 128 caracteres.",
  INVALID_PASSWORD: "La contraseña actual no es correcta.",
  INVALID_TOKEN: "El enlace no es válido o venció. Pide uno nuevo.",
  INVALID_EMAIL: "Escribe un correo válido.",
  YOU_CANNOT_BAN_YOURSELF: "No puedes desactivar tu propia cuenta.",
  actor_changed: actorChangedMessage,
};

/**
 * A Better Auth call that throws an ApiError with a Spanish message; Domy's own rules
 * (lockout, last owner) already answer in Spanish.
 */
export async function authCall(
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<unknown> {
  const response = await authRequest(path, body, undefined, headers);
  const json: unknown = await response.json().catch(() => null);
  if (response.ok) return json;
  const envelope = z.object({ error: apiErrorBody }).safeParse(json);
  if (envelope.success) {
    const error = envelope.data.error;
    if (error.code === "actor_changed")
      throw new ApiError(response.status, { ...error, message: actorChangedMessage });
    throw new ApiError(response.status, error);
  }
  const nativeError = z.object({ code: z.string() }).safeParse(json);
  const code = nativeError.success ? nativeError.data.code : "auth_error";
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
