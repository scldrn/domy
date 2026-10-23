import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { sessionQuery } from "@/features/auth/session";
import { ApiError, queryClient as appQueryClient } from "@/lib/api-client";
import { markNotifications } from "./api";
import {
  acknowledgeNotificationIntent,
  notificationIntentsQueryOptions,
  readNotificationIntents,
  type NotificationIntentSnapshot,
} from "./notification-intents";

const syncIntervalMs = 30_000;

function actorChanged(): ApiError {
  return new ApiError(409, {
    code: "actor_changed",
    message:
      "La sesión cambió de cuenta. Vuelve a la cuenta original para recuperar o continuar las notificaciones pendientes.",
  });
}

function guidanceFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "No pudimos verificar las notificaciones pendientes. Tus datos siguen guardados; intenta de nuevo.";
}

function updateSnapshot(client: QueryClient, actorId: string, guidance: string | null): void {
  const options = notificationIntentsQueryOptions(actorId);
  const previous = client.getQueryData<NotificationIntentSnapshot>(options.queryKey);
  let intents = previous?.intents ?? [];
  try {
    intents = readNotificationIntents(actorId);
  } catch (error) {
    guidance = guidanceFor(error);
  }
  client.setQueryData<NotificationIntentSnapshot>(options.queryKey, { intents, guidance });
}

async function invalidateNotificationViews(client: QueryClient, actorId: string): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["notifications", actorId.toLowerCase()] }),
    client.invalidateQueries({ queryKey: ["shipment"] }),
    client.invalidateQueries({ queryKey: ["history"] }),
  ]);
}

/** Send only ready intents, always after a fresh check of the captured signed-in actor. */
export async function synchronizeReadyNotificationIntents(
  actorId: string,
  client: QueryClient = appQueryClient,
): Promise<void> {
  try {
    const intents = readNotificationIntents(actorId);
    const ready = intents.filter((intent) => intent.phase === "ready");
    if (ready.length === 0) {
      updateSnapshot(client, actorId, null);
      return;
    }

    const user = await client.query({ ...sessionQuery, staleTime: 0, retry: false });
    if (!user || user.id.toLowerCase() !== actorId.toLowerCase()) throw actorChanged();

    for (const intent of ready) {
      const current = readNotificationIntents(actorId).find(
        (candidate) => candidate.actionId === intent.actionId,
      );
      if (
        !current ||
        current.phase !== "ready" ||
        current.actorId !== intent.actorId ||
        current.merchantId !== intent.merchantId ||
        current.serviceDate !== intent.serviceDate ||
        current.shipmentIds.length !== intent.shipmentIds.length ||
        current.shipmentIds.some((id, index) => id !== intent.shipmentIds[index])
      )
        continue;
      await markNotifications(
        { actionId: current.actionId, shipmentIds: current.shipmentIds },
        intent.actorId,
      );
      await invalidateNotificationViews(client, intent.actorId);
      await acknowledgeNotificationIntent(current);
    }
    updateSnapshot(client, actorId, null);
  } catch (error) {
    updateSnapshot(client, actorId, guidanceFor(error));
    throw error;
  }
}

/** Mount once in the authenticated panel; pages share its actor-scoped TanStack snapshot. */
export function useNotificationSync(actorId: string) {
  const client = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const snapshot = useQuery(notificationIntentsQueryOptions(actorId));

  useEffect(() => {
    let running = false;
    let active = true;
    const synchronize = () => {
      if (running || !active) return;
      running = true;
      void synchronizeReadyNotificationIntents(actorId, client)
        .catch(() => undefined)
        .finally(() => {
          running = false;
        });
    };
    const interval = window.setInterval(synchronize, syncIntervalMs);
    window.addEventListener("online", synchronize);
    window.addEventListener("focus", synchronize);
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null) {
        updateSnapshot(client, actorId, null);
        return;
      }
      if (event.key.startsWith(`domy:notification-intent:${actorId.toLowerCase()}:`)) {
        updateSnapshot(client, actorId, null);
        void invalidateNotificationViews(client, actorId).catch((error: unknown) => {
          updateSnapshot(client, actorId, guidanceFor(error));
        });
        synchronize();
      }
    };
    window.addEventListener("storage", storageChanged);
    synchronize();

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", synchronize);
      window.removeEventListener("focus", synchronize);
      window.removeEventListener("storage", storageChanged);
    };
  }, [actorId, client, pathname]);

  return snapshot;
}
