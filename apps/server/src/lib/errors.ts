import type { Context } from "hono";
import type { AppEnv } from "../app.ts";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DrizzleQueryError } from "drizzle-orm";
import postgres from "postgres";
import { isPublicResponsePath } from "./public-path.ts";

/** Error codes of the API contract, each with its HTTP status and default Spanish message. */
const errorCatalog = {
  actor_changed: [
    409,
    "La sesión cambió de cuenta. Reabre la cuenta original para recuperar o continuar el cambio pendiente.",
  ],
  idempotency_conflict: [
    409,
    "Esta acción ya tiene otros datos. Revisa el resultado anterior antes de intentar de nuevo.",
  ],
  invalid_request: [400, "Revisa los datos marcados."],
  date_out_of_range: [422, "Elige una fecha dentro de los últimos 30 días."],
  unauthenticated: [401, "Tu sesión terminó. Ingresa de nuevo."],
  forbidden: [403, "No tienes permiso para esta acción."],
  not_found: [404, "No encontramos lo que buscas."],
  // Public links and abuse guard (feature 004, FR-011, research R6/R14).
  link_not_found: [404, "Este enlace no es válido"],
  rate_limited: [
    429,
    "Has realizado demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.",
  ],
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
  // Courier app (feature 003).
  no_exception_to_decide: [409, "Ese envío no tiene una novedad por decidir."],
  not_held_by_courier: [409, "Ningún mensajero tiene ese paquete."],
  record_not_revertible: [
    409,
    "Solo se revierte la última entrega, novedad o devolución aplicada del envío.",
  ],
  office_not_configured: [409, "Primero registra la dirección de la oficina en «Configuración»."],
  occurred_in_future: [422, "La hora del registro no puede ser posterior a la actual."],
  courier_account_invalid: [409, "Solo se vincula una cuenta activa con rol Mensajero."],
  courier_account_linked: [
    409,
    "Esta cuenta está vinculada a un mensajero; desvincúlala antes de cambiar su rol.",
  ],
  account_locked: [423, "La cuenta está bloqueada temporalmente."],
  photo_immutable: [409, "Esta foto ya fue subida y no puede modificarse."],
  // The photo bucket failed or timed out: the phone keeps the photo and retries (FR-023, ROB-1).
  storage_unavailable: [503, "No pudimos guardar la foto. Se volverá a intentar."],
  conflict: [409, "Conflicto con el estado actual del recurso."],
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

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

/** R14/T153: locations bound disclosure, not the authenticity of a supplied stack.
 * Sources below this trusted root are immutable deployment artifacts, never uploads.
 */
function sourceLocations(stack: unknown): string[] {
  if (typeof stack !== "string") return [];
  const sources = new Map<string, string[]>();
  const locations: string[] = [];
  for (const frame of stack.slice(0, 65_536).split("\n").slice(1, 33)) {
    const match = /^\s+at (?:[^()\n]*\()?([^()\n]+):(\d+):(\d+)\)?$/.exec(frame);
    const candidate = match?.[1];
    if (!candidate || candidate.split(/[\\/]/).some((part) => part === "." || part === ".."))
      continue;
    try {
      let path = candidate;
      if (candidate.startsWith("file:")) {
        const url = new URL(candidate);
        if (url.username || url.password || url.host || url.search || url.hash) continue;
        path = fileURLToPath(url);
      }
      if (!isAbsolute(path) || path.includes("?") || path.includes("#")) continue;
      const local = relative(repositoryRoot, path).split(sep).join("/");
      if (!/^(?:apps\/server\/src|packages\/domain\/src)\/[a-zA-Z0-9_./-]+\.ts$/.test(local))
        continue;
      const parts = local.split("/");
      if (parts.some((part) => part === "." || part === "..")) continue;
      const line = Number(match[2]);
      const column = Number(match[3]);
      if (!Number.isSafeInteger(line) || !Number.isSafeInteger(column) || line < 1 || column < 1)
        continue;
      let lines = sources.get(local);
      if (!lines) {
        let current = repositoryRoot;
        let valid = true;
        for (const [index, part] of parts.entries()) {
          current = join(current, part);
          const stat = lstatSync(current);
          const last = index === parts.length - 1;
          if (
            stat.isSymbolicLink() ||
            (last ? !stat.isFile() || stat.size > 1_048_576 : !stat.isDirectory())
          ) {
            valid = false;
            break;
          }
        }
        if (!valid) continue;
        lines = readFileSync(current, "utf8").split(/\r?\n/);
        sources.set(local, lines);
      }
      const text = lines[line - 1];
      if (text === undefined || column > text.length + 1) continue;
      const location = `${local}:${String(line)}:${String(column)}`;
      if (!locations.includes(location)) locations.push(location);
    } catch {
      // Missing/unreadable/untrusted locations never replace the original error.
    }
  }
  return locations;
}

/** FR-041/R14: arbitrary error text (including driver messages) can contain PII. */
export function errorForLog(error: Error): {
  type: string;
  message: string;
  code?: string;
  stack: string;
} {
  let database: postgres.PostgresError | undefined;
  let code: string | undefined;
  let originalStack: unknown;
  try {
    const candidate = error instanceof DrizzleQueryError ? error.cause : error;
    if (candidate instanceof postgres.PostgresError) {
      database = candidate;
      const nativeCode: unknown = candidate.code;
      if (typeof nativeCode === "string" && /^[0-9A-Z]{5}$/.test(nativeCode)) code = nativeCode;
    }
    originalStack = error.stack;
  } catch {
    // A mutable exception accessor is not diagnostic data.
  }
  const type = database
    ? "DatabaseError"
    : error instanceof TypeError
      ? "TypeError"
      : error instanceof RangeError
        ? "RangeError"
        : error instanceof SyntaxError
          ? "SyntaxError"
          : error instanceof ReferenceError
            ? "ReferenceError"
            : error instanceof URIError
              ? "URIError"
              : error instanceof EvalError
                ? "EvalError"
                : error instanceof AggregateError
                  ? "AggregateError"
                  : "Error";
  const message = database
    ? `Database operation failed${code ? ` (SQLSTATE ${code})` : ""}.`
    : "Unexpected application error.";
  let locations = sourceLocations(originalStack);
  const site = locations.length ? "source" : "reporting_site";
  if (!locations.length) locations = sourceLocations(new Error("Diagnostic reporting site").stack);
  const stack = `${type}: ${message}\n${locations.map((location) => `    at ${site} (${location})`).join("\n")}`;
  return { type, message, ...(code && { code }), stack };
}

let reportError: ((error: Error) => void) | null = null;

/** Sends unexpected errors to error reporting (Sentry), already stripped of personal data. */
export function setErrorReporter(reporter: ((error: Error) => void) | null): void {
  reportError = reporter;
}

/** Hono error handler: every non-2xx response has the body `{ error: { code, message, fields? } }`. */
export function handleError(error: Error, c: Context<AppEnv>) {
  if (isPublicResponsePath(c.req.path)) {
    c.header("Cache-Control", "no-store");
    c.header("X-Robots-Tag", "noindex");
  }

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
