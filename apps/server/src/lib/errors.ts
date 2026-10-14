import type { Context } from "hono";
import type { AppEnv } from "../app.ts";
import { HTTPException } from "hono/http-exception";
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
  payload_too_large: [413, "La solicitud es demasiado grande; envía menos datos a la vez."],
  // Routes and dispatch (feature 002).
  shipment_not_registered: [409, "Ese envío ya no está «Registrado» o ya está en una ruta."],
  courier_busy: [409, "Ese mensajero ya tiene una ruta en curso."],
  invalid_stop_order: [409, "Ese orden de paradas no es válido."],
  shipment_picked_up: [409, "Ese envío ya fue recogido; no se puede quitar de la ruta."],
  route_has_completed_stops: [
    409,
    "La ruta ya tiene paradas completadas o paquetes recogidos; no se puede deshacer el despacho. Quita o reasigna sus envíos pendientes.",
  ],
  route_not_in_progress: [409, "La ruta no está en curso."],
  route_in_progress: [
    409,
    "Una ruta en curso no se cancela: quita o reasigna sus envíos, o deshaz el despacho si no se ha recogido nada.",
  ],
  shipment_not_movable: [409, "Ese envío no se puede mover en su estado actual."],
  past_service_date: [422, "No se crean rutas para fechas pasadas."],
  courier_required: [422, "Asigna un mensajero antes de despachar la ruta."],
  route_empty: [422, "La ruta no tiene envíos."],
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

/**
 * An error as it may be logged (FR-041): a failed database query keeps only the database's
 * code and message, never the statement or its parameters, which hold recipients' data.
 */
export function errorForLog(error: Error): {
  type: string;
  message: string;
  code?: unknown;
  constraint?: unknown;
  stack?: string | undefined;
} {
  const cause: unknown = error.cause;
  if (typeof cause === "object" && cause !== null && "code" in cause) {
    const database = cause as { code: unknown; message?: unknown; constraint_name?: unknown };
    return {
      type: "DatabaseError",
      code: database.code,
      message: typeof database.message === "string" ? database.message : "Database error",
      constraint: database.constraint_name,
    };
  }
  return { type: error.name, message: error.message, stack: error.stack };
}

let reportError: ((error: Error) => void) | null = null;

/** Sends unexpected errors to error reporting (Sentry), already stripped of personal data. */
export function setErrorReporter(reporter: (error: Error) => void): void {
  reportError = reporter;
}

/** Hono error handler: every non-2xx response has the body `{ error: { code, message, fields? } }`. */
export function handleError(error: Error, c: Context<AppEnv>) {
  // A body Hono could not read (broken JSON) is the client's mistake, not ours (research R13).
  if (error instanceof HTTPException && error.status < 500) {
    return handleError(
      new AppError(error.status === 413 ? "payload_too_large" : "invalid_request", {
        ...(error.status !== 413 && {
          message: "La solicitud no tiene un formato válido. Recarga la página e intenta de nuevo.",
        }),
      }),
      c,
    );
  }
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
  const logged = errorForLog(error);
  c.get("logger").error({ err: logged }, "unhandled error");
  if (reportError) {
    const reported = new Error(logged.message);
    reported.name = logged.type;
    if (logged.stack) reported.stack = logged.stack;
    reportError(reported);
  }
  return c.json(
    {
      error: { code: "internal_error", message: "Ocurrió un error inesperado. Intenta de nuevo." },
    },
    500,
  );
}
