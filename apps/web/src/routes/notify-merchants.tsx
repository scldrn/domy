import {
  bogotaToday,
  isFutureServiceDate,
  composeMerchantMessage,
  eligibleNotificationShipments,
  notificationListQuery,
  type NotificationMerchant,
} from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import CampaignIcon from "@material-symbols/svg-400/rounded/campaign.svg?react";
import InfoIcon from "@material-symbols/svg-400/rounded/info.svg?react";
import { DayStepper } from "@/components/day-stepper";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { SummarySentence } from "@/components/summary-sentence";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompanySettings } from "@/features/master-data/api";
import { MerchantNotifyRow } from "@/features/notifications/merchant-notify-row";
import { notificationListQueryOptions } from "@/features/notifications/api";
import { notifySentence } from "@/features/notifications/notify-sentence";
import {
  commitNotificationIntent,
  discardPreparedNotificationIntent,
  notificationIntentsQueryOptions,
  readNotificationIntents,
  prepareNotificationIntent,
  type NotificationIntent,
  type NotificationIntentSnapshot,
} from "@/features/notifications/notification-intents";
import { synchronizeReadyNotificationIntents } from "@/features/notifications/use-notification-sync";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";

export const Route = createFileRoute("/_panel/notificar")({
  validateSearch: notificationListQuery,
  head: () => ({ meta: [{ title: "Notificar clientes · Domy" }] }),
  component: NotifyMerchants,
});

function NotifyMerchants() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const today = bogotaToday(now());
  // FR-015: a link with a future date opens today, the latest day there is to notify.
  const date = search.date && !isFutureServiceDate(search.date, today) ? search.date : today;
  const notifications = useQuery(notificationListQueryOptions(user.id, date));
  const intentOptions = notificationIntentsQueryOptions(user.id);
  const intentSnapshot = useQuery(intentOptions);
  const settings = useQuery({ queryKey: ["company-settings"], queryFn: getCompanySettings });
  const busyKeys = useRef(new Set<string>());
  const [busyRows, setBusyRows] = useState<Set<string>>(() => new Set());
  const [includeAllRows, setIncludeAllRows] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const merchants = notifications.data?.merchants ?? [];
  const intents = intentSnapshot.data?.intents ?? [];

  const setRowBusy = (key: string, busy: boolean) => {
    if (busy) busyKeys.current.add(key);
    else busyKeys.current.delete(key);
    setBusyRows(new Set(busyKeys.current));
  };

  const setRowError = (key: string, message: string | null) => {
    setRowErrors((previous) => {
      if (message !== null) return { ...previous, [key]: message };
      return Object.fromEntries(Object.entries(previous).filter(([entryKey]) => entryKey !== key));
    });
  };

  const refreshIntentSnapshot = () => {
    const previous = queryClient.getQueryData<NotificationIntentSnapshot>(intentOptions.queryKey);
    try {
      queryClient.setQueryData<NotificationIntentSnapshot>(intentOptions.queryKey, {
        intents: readNotificationIntents(user.id),
        guidance: null,
      });
    } catch (error) {
      queryClient.setQueryData<NotificationIntentSnapshot>(intentOptions.queryKey, {
        intents: previous?.intents ?? [],
        guidance: errorMessage(error),
      });
    }
  };

  const finishExternalFailure = async (
    key: string,
    prepared: NotificationIntent,
    fallback: string,
  ) => {
    let message = fallback;
    try {
      await discardPreparedNotificationIntent(prepared);
    } catch (error) {
      message = errorMessage(error);
    }
    refreshIntentSnapshot();
    setRowError(key, message);
    setRowBusy(key, false);
  };

  const synchronizeCommittedIntent = async (
    key: string,
    prepared: NotificationIntent,
    superseded: NotificationIntent | undefined,
  ) => {
    try {
      await commitNotificationIntent(prepared, superseded);
      refreshIntentSnapshot();
    } catch (error) {
      refreshIntentSnapshot();
      setRowError(key, errorMessage(error));
      const readyWasPersisted = (() => {
        try {
          return readNotificationIntents(user.id).some(
            (intent) => intent.actionId === prepared.actionId && intent.phase === "ready",
          );
        } catch {
          return false;
        }
      })();
      if (readyWasPersisted) {
        try {
          await synchronizeReadyNotificationIntents(user.id, queryClient);
        } catch (syncError) {
          setRowError(key, errorMessage(syncError));
        }
      }
      setRowBusy(key, false);
      return;
    }

    setRowError(key, null);
    try {
      await synchronizeReadyNotificationIntents(user.id, queryClient);
    } catch (error) {
      setRowError(key, errorMessage(error));
    } finally {
      setRowBusy(key, false);
    }
  };

  const share = (
    merchant: NotificationMerchant,
    includeAll: boolean,
    method: "copy" | "whatsapp",
  ) => {
    const key = rowKey(date, merchant.merchantId);
    if (busyKeys.current.has(key)) return;
    setRowBusy(key, true);
    setRowError(key, null);

    let prepared: NotificationIntent;
    let superseded: NotificationIntent | undefined;
    try {
      const existing = readNotificationIntents(user.id).filter(
        (intent) => intent.merchantId === merchant.merchantId && intent.serviceDate === date,
      );
      if (existing.some((intent) => intent.phase === "ready")) {
        setRowError(
          key,
          "Ya hay una notificación pendiente de registro. Reintenta ese registro antes de compartir de nuevo.",
        );
        setRowBusy(key, false);
        void synchronizeReadyNotificationIntents(user.id, queryClient).catch(() => undefined);
        return;
      }
      superseded = existing.find((intent) => intent.phase === "prepared");
      const selected = eligibleNotificationShipments(merchant.shipments, includeAll);
      if (selected.length === 0) {
        setRowError(key, "No hay envíos disponibles para incluir en este mensaje.");
        setRowBusy(key, false);
        return;
      }
      const whatsappPhone = merchant.whatsappPhone;
      if (method === "whatsapp" && whatsappPhone === null) {
        setRowError(key, "Configura un número de WhatsApp para compartir por ese medio.");
        setRowBusy(key, false);
        return;
      }

      const message = composeMerchantMessage(
        merchant,
        merchant.shipments,
        import.meta.env.PUBLIC_BASE_URL,
        includeAll,
      );
      prepared = prepareNotificationIntent({
        actorId: user.id,
        merchantId: merchant.merchantId,
        serviceDate: date,
        shipmentIds: selected.map((shipment) => shipment.id),
      });

      if (method === "whatsapp") {
        if (whatsappPhone === null) {
          void finishExternalFailure(
            key,
            prepared,
            "Configura un número de WhatsApp para compartir por ese medio.",
          );
          return;
        }
        const whatsappUrl = new URL(`https://wa.me/57${whatsappPhone}`);
        whatsappUrl.searchParams.set("text", message);
        let popup: Window | null;
        try {
          popup = window.open(whatsappUrl.toString(), "_blank");
        } catch {
          void finishExternalFailure(
            key,
            prepared,
            "No pudimos abrir WhatsApp. Revisa los permisos de ventanas emergentes e intenta de nuevo.",
          );
          return;
        }
        if (popup === null) {
          void finishExternalFailure(
            key,
            prepared,
            "El navegador bloqueó la ventana de WhatsApp. Permite las ventanas emergentes e intenta de nuevo.",
          );
          return;
        }
        try {
          popup.opener = null;
        } catch {
          popup.close();
          void finishExternalFailure(
            key,
            prepared,
            "No pudimos proteger la ventana de WhatsApp. Intenta compartir de nuevo.",
          );
          return;
        }
        void synchronizeCommittedIntent(key, prepared, superseded);
        return;
      }

      let copy: Promise<void>;
      try {
        copy = navigator.clipboard.writeText(message);
      } catch {
        void finishExternalFailure(
          key,
          prepared,
          "No pudimos copiar el mensaje. Revisa los permisos del portapapeles e intenta de nuevo.",
        );
        return;
      }
      void copy.then(
        () => {
          void synchronizeCommittedIntent(key, prepared, superseded);
        },
        () => {
          void finishExternalFailure(
            key,
            prepared,
            "No pudimos copiar el mensaje. Revisa los permisos del portapapeles e intenta de nuevo.",
          );
        },
      );
    } catch (error) {
      refreshIntentSnapshot();
      setRowError(key, errorMessage(error));
      setRowBusy(key, false);
    }
  };

  const retryMark = (merchantId: string) => {
    const key = rowKey(date, merchantId);
    if (busyKeys.current.has(key)) return;
    setRowBusy(key, true);
    setRowError(key, null);
    void synchronizeReadyNotificationIntents(user.id, queryClient)
      .catch((error: unknown) => {
        setRowError(key, errorMessage(error));
      })
      .finally(() => {
        setRowBusy(key, false);
      });
  };

  const changeDate = (nextDate: string) => {
    if (nextDate === "") {
      void navigate({ search: {}, replace: true });
      return;
    }
    if (!notificationListQuery.safeParse({ date: nextDate }).success) return;
    if (isFutureServiceDate(nextDate, today)) return;
    void navigate({ search: { date: nextDate }, replace: true });
  };

  const rows = merchants.map((merchant) => {
    const key = rowKey(date, merchant.merchantId);
    const merchantIntents = intents.filter(
      (intent) => intent.merchantId === merchant.merchantId && intent.serviceDate === date,
    );
    const pendingMark = merchantIntents.some((intent) => intent.phase === "ready");
    const pendingCount = eligibleNotificationShipments(merchant.shipments).length;
    return {
      merchant,
      key,
      pendingMark,
      preparedRecovery: merchantIntents.some((intent) => intent.phase === "prepared"),
      pendingCount,
      totalCount: eligibleNotificationShipments(merchant.shipments, true).length,
      includeAll: includeAllRows[key] ?? false,
      // «Al día» (approved «Notificar clientes»): nothing left to notify or to record.
      upToDate: pendingCount === 0 && !pendingMark,
    };
  });
  const toDo = rows.filter((row) => !row.upToDate);
  const done = rows.filter((row) => row.upToDate);

  const renderRow = (row: (typeof rows)[number], layout: "card" | "row") => (
    <MerchantNotifyRow
      key={row.merchant.merchantId}
      merchant={row.merchant}
      layout={layout}
      pendingCount={row.pendingCount}
      totalCount={row.totalCount}
      includeAll={row.includeAll}
      message={layout === "card" ? previewMessage(row.merchant, row.includeAll) : null}
      busy={busyRows.has(row.key)}
      pendingMark={row.pendingMark}
      preparedRecovery={row.preparedRecovery}
      error={rowErrors[row.key] ?? null}
      onIncludeAllChange={(value) => {
        setIncludeAllRows((previous) => ({ ...previous, [row.key]: value }));
      }}
      onCopy={() => {
        share(row.merchant, row.includeAll, "copy");
      }}
      onSendWhatsApp={() => {
        share(row.merchant, row.includeAll, "whatsapp");
      }}
      onRetry={() => {
        retryMark(row.merchant.merchantId);
      }}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_26rem] flex-col gap-1.5">
          <h1 className="text-headline-l text-on-surface">Notificar clientes</h1>
          {notifications.data ? (
            <SummarySentence
              parts={notifySentence({
                date,
                today,
                merchants: rows.map((row) => ({
                  pending: row.pendingCount,
                  upToDate: row.upToDate,
                })),
              })}
            />
          ) : (
            notifications.isPending && <Skeleton className="h-7 w-full max-w-md" />
          )}
        </div>
        <DayStepper
          date={date}
          today={today}
          max={today}
          surface="sheet"
          label="Fecha de los envíos"
          onChange={changeDate}
        />
      </header>

      {settings.data?.supportPhone === null && (
        <aside className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-warning-container px-3.5 py-2 text-on-warning-container">
          <Icon symbol={InfoIcon} size={20} />
          <p className="min-w-0 flex-[1_1_18rem] text-body-m">
            Agrega un celular de soporte para que tus clientes puedan comunicarse con tu empresa.
            {user.role !== "owner" && " Pídele a la persona propietaria que configure ese dato."}
          </p>
          {user.role === "owner" && (
            <Link
              to="/configuracion"
              className="inline-flex min-h-11 items-center rounded-xs text-label-l underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              Configurar datos de soporte
            </Link>
          )}
        </aside>
      )}

      {notifications.isPending ? (
        <div
          className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1"
          role="status"
          aria-label="Cargando envíos para notificar"
        >
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      ) : notifications.isError && !notifications.data ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-md bg-error-container p-4 text-on-error-container"
        >
          <p className="text-body-l">{errorMessage(notifications.error)}</p>
          <Button variant="outline" onClick={() => void notifications.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : merchants.length === 0 ? (
        <EmptyState
          icon={CampaignIcon}
          title="No hay envíos para notificar en esta fecha"
          description="Elige otra fecha o registra primero los envíos del día."
        />
      ) : (
        <>
          {notifications.isError && (
            <p
              role="alert"
              className="rounded-md bg-error-container p-4 text-body-m text-on-error-container"
            >
              No pudimos actualizar los envíos. Revisa la conexión e intenta de nuevo.
            </p>
          )}
          {intentSnapshot.data?.guidance && (
            <p
              role="alert"
              className="rounded-md bg-warning-container p-4 text-body-m text-on-warning-container"
            >
              {intentSnapshot.data.guidance}
            </p>
          )}
          {toDo.length > 0 && (
            <section aria-labelledby="por-notificar" className="flex flex-col gap-3">
              <h2
                id="por-notificar"
                className="flex items-baseline gap-2 text-title-l text-on-surface"
              >
                Por notificar{" "}
                <span className="text-body-l text-on-surface-variant tabular-nums">
                  {toDo.length}
                </span>
              </h2>
              <div className="grid grid-cols-2 items-start gap-4 max-[1100px]:grid-cols-1">
                {toDo.map((row) => renderRow(row, "card"))}
              </div>
            </section>
          )}
          {done.length > 0 && (
            <section aria-labelledby="al-dia" className="flex flex-col gap-3">
              <h2 id="al-dia" className="flex items-baseline gap-2 text-title-l text-on-surface">
                Al día{" "}
                <span className="text-body-l text-on-surface-variant tabular-nums">
                  {done.length}
                </span>
              </h2>
              <div className="overflow-hidden rounded-lg border border-outline-variant bg-sheet">
                {done.map((row) => renderRow(row, "row"))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/**
 * «Ver mensaje» (approved «Notificar clientes»): the same text sharing would send now, from the
 * domain's composition (FR-016); none when the public address is not configured.
 */
function previewMessage(merchant: NotificationMerchant, includeAll: boolean): string | null {
  try {
    return composeMerchantMessage(
      merchant,
      merchant.shipments,
      import.meta.env.PUBLIC_BASE_URL,
      includeAll,
    );
  } catch {
    return null;
  }
}

function rowKey(date: string, merchantId: string): string {
  return `${date}:${merchantId}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "No pudimos completar la notificación. Revisa la conexión e intenta de nuevo.";
}
