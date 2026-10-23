import type { NotificationMerchant } from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MerchantNotifyRowProps = {
  merchant: NotificationMerchant;
  pendingCount: number;
  totalCount: number;
  includeAll: boolean;
  busy: boolean;
  pendingMark: boolean;
  preparedRecovery: boolean;
  error: string | null;
  onIncludeAllChange: (includeAll: boolean) => void;
  onCopy: () => void;
  onSendWhatsApp: () => void;
  onRetry: () => void;
};

function shipmentCount(count: number): string {
  return `${String(count)} ${count === 1 ? "envío" : "envíos"}`;
}

/** The merchant's message controls; composition, eligibility and delivery stay with its caller. */
export function MerchantNotifyRow({
  merchant,
  pendingCount,
  totalCount,
  includeAll,
  busy,
  pendingMark,
  preparedRecovery,
  error,
  onIncludeAllChange,
  onCopy,
  onSendWhatsApp,
  onRetry,
}: MerchantNotifyRowProps) {
  const headingId = useId();
  const totalCountId = useId();
  const selectedCount = includeAll ? totalCount : pendingCount;
  const canShare = merchant.isActive && !busy && !pendingMark && selectedCount > 0;
  const pendingDescription = `${shipmentCount(pendingCount)} sin notificar`;

  return (
    <article
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 rounded-md border border-outline-variant bg-sheet p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-title-m text-on-surface">
            {merchant.name}
          </h2>
          {pendingMark || pendingCount > 0 ? (
            <p className="mt-1 text-body-m text-on-surface-variant">{pendingDescription}</p>
          ) : (
            <Badge className="mt-1" variant="success">
              Notificado
            </Badge>
          )}
          <p className="text-body-m text-on-surface-variant">
            {shipmentCount(totalCount)} en el día
          </p>
        </div>
        {!merchant.isActive && <Badge variant="outline">Inactivo</Badge>}
      </div>

      {!merchant.isActive && (
        <div className="flex flex-col items-start gap-1">
          <p role="status" className="text-body-m text-on-surface-variant">
            Activa el cliente para compartir su enlace.
          </p>
          <Link
            to="/clientes/$merchantId"
            params={{ merchantId: merchant.merchantId }}
            className="inline-flex min-h-12 items-center text-label-l text-primary underline-offset-4 hover:underline focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Abrir cliente
          </Link>
        </div>
      )}

      {merchant.whatsappPhone === null && (
        <div className="flex flex-col items-start gap-1">
          <p className="text-body-m text-on-surface-variant">
            Debes agregar un número de WhatsApp para habilitar el envío por ese medio.
          </p>
          <Link
            to="/clientes/$merchantId"
            params={{ merchantId: merchant.merchantId }}
            className="inline-flex min-h-12 items-center text-label-l text-primary underline-offset-4 hover:underline focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Configurar cliente
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="flex min-h-12 cursor-pointer items-center gap-3 text-body-m text-on-surface">
          <input
            type="checkbox"
            className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            checked={includeAll}
            disabled={busy || pendingMark}
            aria-describedby={totalCountId}
            onChange={(event) => {
              onIncludeAllChange(event.currentTarget.checked);
            }}
          />
          <span>Incluir todos los envíos del día</span>
        </label>
        <p id={totalCountId} className="text-body-m text-on-surface-variant">
          Total del día: {shipmentCount(totalCount)}.
        </p>
      </div>

      {pendingMark && (
        <div className="flex flex-col items-start gap-2 rounded-sm bg-warning-container p-3 text-on-warning-container">
          <p role="status" aria-live="polite" className="text-body-m">
            El mensaje se abrió o copió, pero falta registrar la notificación.
          </p>
          <Button
            variant="outline"
            disabled={busy}
            type="button"
            onClick={() => {
              onRetry();
            }}
          >
            Reintentar registro
          </Button>
        </div>
      )}

      {preparedRecovery && !pendingMark && (
        <p role="status" aria-live="polite" className="text-body-m text-on-surface-variant">
          {merchant.isActive
            ? merchant.whatsappPhone === null
              ? "La acción no quedó registrada. Copia el mensaje de nuevo para registrarla."
              : "La acción no quedó registrada. Vuelve a abrir WhatsApp o copia el mensaje para registrarla."
            : "La acción no quedó registrada. Activa el cliente antes de volver a compartir."}
        </p>
      )}

      {error && (
        <p role="alert" className="text-body-m text-error">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {merchant.whatsappPhone !== null && (
          <Button
            className="w-full sm:w-auto"
            disabled={!canShare}
            type="button"
            onClick={() => {
              onSendWhatsApp();
            }}
          >
            Enviar por WhatsApp
          </Button>
        )}
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          disabled={!canShare}
          type="button"
          onClick={() => {
            onCopy();
          }}
        >
          Copiar mensaje
        </Button>
      </div>
    </article>
  );
}
