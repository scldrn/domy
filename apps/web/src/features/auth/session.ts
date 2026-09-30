import type { UserRole } from "@domy/domain";
import { queryOptions } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { syncClock } from "@/lib/clock";

export type SessionUser = { id: string; name: string; email: string; role: UserRole };

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
export async function getSession(): Promise<SessionUser | null> {
  const response = await authRequest("get-session");
  if (!response.ok) return null;
  const body = (await response.json()) as { user: SessionUser } | null;
  return body?.user ?? null;
}

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: getSession,
  staleTime: 60_000,
});

/** Signs in with email and password; errors carry Spanish messages. */
export async function signIn(email: string, password: string): Promise<void> {
  const response = await authRequest("sign-in/email", { email, password });
  if (response.ok) return;
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
}

export async function signOut(): Promise<void> {
  await authRequest("sign-out", {});
}
