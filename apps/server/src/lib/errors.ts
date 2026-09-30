import type { Context } from "hono";
import type { AppEnv } from "../app.ts";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Error codes of the API contract, each with its HTTP status and default Spanish message. */
const errorCatalog = {
  invalid_request: [400, "Revisa los datos marcados."],
  unauthenticated: [401, "Tu sesión terminó. Ingresa de nuevo."],
  forbidden: [403, "No tienes permiso para esta acción."],
  not_found: [404, "No encontramos lo que buscas."],
  version_conflict: [409, "Alguien cambió este registro. Revisa la versión más reciente."],
  invalid_transition: [409, "Este cambio no está permitido en el estado actual."],
  duplicate_alias: [409, "Ese nombre ya identifica a otro registro."],
  last_owner: [409, "Debe quedar al menos un propietario activo."],
  confirmation_required: [422, "Confirma el valor antes de guardar."],
  account_locked: [423, "La cuenta está bloqueada temporalmente."],
} as const satisfies Record<string, readonly [ContentfulStatusCode, string]>;

export type ErrorCode = keyof typeof errorCatalog;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: ContentfulStatusCode;
  readonly fields: Record<string, string> | undefined;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    options: {
      message?: string;
      fields?: Record<string, string>;
      details?: Record<string, unknown>;
    } = {},
  ) {
    const [status, defaultMessage] = errorCatalog[code];
    super(options.message ?? defaultMessage);
    this.code = code;
    this.status = status;
    this.fields = options.fields;
    this.details = options.details;
  }
}

/** Hono error handler: every non-2xx response has the body `{ error: { code, message, fields? } }`. */
export function handleError(error: Error, c: Context<AppEnv>) {
  if (error instanceof AppError) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields && { fields: error.fields }),
          ...error.details,
        },
      },
      error.status,
    );
  }
  c.get("logger").error({ err: error }, "unhandled error");
  return c.json(
    {
      error: { code: "internal_error", message: "Ocurrió un error inesperado. Intenta de nuevo." },
    },
    500,
  );
}
