import type { AppType } from "@domy/server/app";
import { QueryClient } from "@tanstack/react-query";
import { hc, type ClientResponse } from "hono/client";
import { z } from "zod";
import type { StatusCode } from "hono/utils/http-status";
import { syncClock } from "./clock";

/** An API error with the Spanish message the server wrote for the user. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: Record<string, string>;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    body: { code: string; message: string; fields?: Record<string, string> | undefined } & Record<
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

/** Validate unknown error payloads; retain structured retry details without trusting their shape. */
export const apiErrorBody = z
  .object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  })
  .catchall(z.unknown());
const apiErrorEnvelope = z.object({ error: apiErrorBody });

async function throwResponseError(result: {
  status: number;
  json(): Promise<unknown>;
}): Promise<never> {
  const parsed = apiErrorEnvelope.safeParse(await result.json().catch(() => null));
  throw new ApiError(
    result.status,
    parsed.success
      ? parsed.data.error
      : {
          code: "unknown_error",
          message: "Ocurrió un error inesperado. Intenta de nuevo.",
        },
  );
}

/** T136 / Constitution V: the endpoint supplies T; callers cannot invent an unchecked body. */
export async function unwrap<T>(
  response: Promise<ClientResponse<T, StatusCode, "json">>,
): Promise<T> {
  const result = await response;
  if (!result.ok) return throwResponseError(result);
  return result.json();
}

/** Successful 204 mutations have no JSON body; keep the same validated error handling. */
export async function unwrapEmpty(response: Promise<ClientResponse<unknown>>): Promise<void> {
  const result = await response;
  if (!result.ok) await throwResponseError(result);
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
