import type { AppType } from "@domy/server/app";
import { QueryClient } from "@tanstack/react-query";
import { hc } from "hono/client";
import { syncClock } from "./clock";

/** An API error with the Spanish message the server wrote for the user. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: Record<string, string>;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    body: { code: string; message: string; fields?: Record<string, string> } & Record<
      string,
      unknown
    >,
  ) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.fields = body.fields ?? {};
    this.details = body;
  }
}

const networkErrorMessage =
  "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.";

async function fetchWithClock(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(input, { ...init, credentials: "include" });
  } catch {
    throw new ApiError(0, { code: "network_error", message: networkErrorMessage });
  }
  syncClock(response.headers.get("date"));
  return response;
}

/** Typed client of the Hono API (research R3). */
export const api = hc<AppType>("/", { fetch: fetchWithClock });

/** Returns the JSON body of a successful response, or throws an ApiError. */
export async function unwrap<T>(response: Promise<Response>): Promise<T> {
  const result = await response;
  if (result.ok) {
    return (await result.json()) as T;
  }
  const body = (await result.json().catch(() => null)) as {
    error?: { code: string; message: string; fields?: Record<string, string> };
  } | null;
  throw new ApiError(
    result.status,
    body?.error ?? {
      code: "unknown_error",
      message: "Ocurrió un error inesperado. Intenta de nuevo.",
    },
  );
}

/** Successful 204 mutations have no JSON body; keep the same error handling. */
export async function unwrapEmpty(response: Promise<Response>): Promise<void> {
  const result = await response;
  if (!result.ok) await unwrap(Promise.resolve(result));
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
