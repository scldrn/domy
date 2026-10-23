import {
  notificationListQuery,
  notificationMarkInput,
  type NotificationMarkInput,
} from "@domy/domain";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { api, ApiError, unwrap, unwrapEmpty } from "@/lib/api-client";

function validateInput<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(422, {
      code: "notification_input_invalid",
      message,
    });
  return parsed.data;
}

/** The caller passes the current Bogotá service date when it wants to pin a list query. */
export async function getNotifications(date?: string) {
  const query = validateInput(
    notificationListQuery,
    date === undefined ? {} : { date },
    "Escribe una fecha válida en formato AAAA-MM-DD.",
  );
  return unwrap(api.api.notifications.$get({ query }));
}

export function notificationListQueryOptions(actorId: string, date?: string) {
  const canonicalActorId = validateInput(
    z.uuid(),
    actorId,
    "No pudimos verificar la cuenta que consulta las notificaciones. Reabre la sesión e intenta de nuevo.",
  ).toLowerCase();
  return queryOptions({
    queryKey: ["notifications", canonicalActorId, date ?? null],
    queryFn: () => getNotifications(date),
  });
}

/** R15: always bind a new notification request to the account captured by its caller. */
export async function markNotifications(input: NotificationMarkInput, capturedActorId: string) {
  const validInput = validateInput(
    notificationMarkInput,
    input,
    "Elige uno o más envíos válidos para registrar la notificación.",
  );
  const validActorId = validateInput(
    z.uuid(),
    capturedActorId,
    "No pudimos verificar la cuenta que registrará la notificación. Reabre la sesión e intenta de nuevo.",
  );
  await unwrapEmpty(
    api.api.notifications.$post(
      { json: validInput },
      { headers: { "X-Domy-Actor-Id": validActorId.toLowerCase() } },
    ),
  );
}
