import ArrowDownIcon from "@material-symbols/svg-400/rounded/keyboard_arrow_down.svg?react";
import CopyIcon from "@material-symbols/svg-400/rounded/content_copy.svg?react";
import DoneAllIcon from "@material-symbols/svg-400/rounded/done_all.svg?react";
import SendIcon from "@material-symbols/svg-400/rounded/send.svg?react";
import StorefrontIcon from "@material-symbols/svg-400/rounded/storefront.svg?react";
import type { NotificationMerchant } from "@domy/domain";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type MerchantNotifyRowProps = {
  merchant: NotificationMerchant;
  /** «Por notificar» shows a card; «Al día» a row of its short list. */
  layout: "card" | "row";
  pendingCount: number;
  totalCount: number;
  includeAll: boolean;
  /** The text the merchant would get now, for «Ver mensaje»; null when it cannot be composed. */
  message: string | null;
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

const noteLink =
  "inline-flex min-h-12 items-center rounded-xs text-label-l text-on-surface underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong";

/**
 * A merchant's message controls (approved «Notificar clientes»): who it is and how many of the
 * day's shipments still lack their links, why sharing may be blocked, «Incluir todos los envíos
 * del día», «Ver mensaje», and the two ways to share. Composition, eligibility, and delivery
 * stay with its caller.
 */
export function MerchantNotifyRow({
  merchant,
  layout,
  pendingCount,
  totalCount,
  includeAll,
  message,
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
  const includeHintId = useId();
  const selectedCount = includeAll ? totalCount : pendingCount;
  const canShare = merchant.isActive && !busy && !pendingMark && selectedCount > 0;
  const card = layout === "card";

  const heading = (
    <div className="flex flex-wrap items-center gap-2">
      <h3 id={headingId} className="text-title-m text-on-surface">
        {merchant.name}
      </h3>
      {!merchant.isActive && <Badge variant="outline">Inactivo</Badge>}
    </div>
  );

  // The whole label is the 48 px target; the hint sits outside it, so the checkbox's name stays
  // «Incluir todos los envíos del día» and the hint is its description.
  const include = (
    <div className="flex flex-col">
      <label className="flex min-h-12 cursor-pointer items-center gap-3 text-body-m text-on-surface">
        <input
          type="checkbox"
          className="size-5 shrink-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed"
          checked={includeAll}
          disabled={busy || pendingMark}
          aria-describedby={includeHintId}
          onChange={(event) => {
            onIncludeAllChange(event.currentTarget.checked);
          }}
        />
        Incluir todos los envíos del día
      </label>
      <span
        id={includeHintId}
        className={cn("-mt-2.5 pl-8 text-body-s text-on-surface-variant", !card && "sr-only")}
      >
        También los que ya se notificaron. Total del día: {shipmentCount(totalCount)}.
      </span>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap gap-2.5 max-[820px]:grid max-[820px]:grid-cols-1">
      {merchant.whatsappPhone !== null && (
        <Button
          variant={card ? "default" : "outline"}
          disabled={!canShare}
          type="button"
          onClick={() => {
            onSendWhatsApp();
          }}
        >
          <Icon symbol={SendIcon} size={20} />
          Enviar por WhatsApp
        </Button>
      )}
      <Button
        variant="outline"
        disabled={!canShare}
        type="button"
        onClick={() => {
          onCopy();
        }}
      >
        <Icon symbol={CopyIcon} size={20} />
        Copiar mensaje
      </Button>
    </div>
  );

  const notes = (
    <>
      {!merchant.isActive && (
        <p className="flex flex-wrap items-center gap-x-2.5 text-body-m text-on-surface-variant">
          <span role="status">Activa el cliente para compartir su enlace.</span>
          <Link
            to="/clientes/$merchantId"
            params={{ merchantId: merchant.merchantId }}
            className={noteLink}
          >
            Abrir cliente
          </Link>
        </p>
      )}
      {merchant.whatsappPhone === null && (
        <p className="flex flex-wrap items-center gap-x-2.5 text-body-m text-on-surface-variant">
          <span>Debes agregar un número de WhatsApp para habilitar el envío por ese medio.</span>
          <Link
            to="/clientes/$merchantId"
            params={{ merchantId: merchant.merchantId }}
            className={noteLink}
          >
            Configurar cliente
          </Link>
        </p>
      )}
      {pendingMark && (
        <div className="flex flex-col items-start gap-2.5 rounded-md bg-warning-container px-3.5 py-3 text-on-warning-container">
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
    </>
  );

  if (!card) {
    return (
      <article
        aria-labelledby={headingId}
        className="flex flex-col gap-3 border-t border-outline-variant px-5 py-3.5 first:border-t-0 max-[820px]:px-4"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-5 gap-y-2 max-[820px]:grid-cols-1">
          <div className="min-w-0">
            {heading}
            <p className="flex flex-wrap items-center gap-x-1.5 text-body-m text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5 text-label-l text-success">
                <Icon symbol={DoneAllIcon} size={20} />
                Notificado
              </span>
              <span aria-hidden="true">·</span>
              {pendingMark || pendingCount > 0
                ? `${shipmentCount(pendingCount)} sin notificar`
                : `${String(totalCount)} ${totalCount === 1 ? "envío notificado" : "envíos notificados"}`}
            </p>
          </div>
          {include}
          {actions}
        </div>
        {notes}
      </article>
    );
  }

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-3.5 rounded-lg border border-outline-variant px-5 py-4.5 max-[820px]:px-4",
        merchant.isActive ? "bg-sheet" : "bg-sheet-alt",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary-container text-on-secondary-container">
          <Icon symbol={StorefrontIcon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          {heading}
          <p className="text-body-m text-on-surface-variant">
            <strong className="font-[650] text-on-surface">
              {shipmentCount(pendingCount)} sin notificar
            </strong>{" "}
            · {shipmentCount(totalCount)} en el día
          </p>
        </div>
      </div>
      {notes}
      {include}
      {message !== null && (
        <details className="group rounded-md border border-outline-variant">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2.5 rounded-md px-3.5 text-label-l text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong [&::-webkit-details-marker]:hidden">
            Ver mensaje · {shipmentCount(selectedCount)}
            <Icon
              symbol={ArrowDownIcon}
              size={20}
              className="transition-transform duration-(--duration-short) group-open:rotate-180"
            />
          </summary>
          <p className="mx-3 mb-3 max-h-64 overflow-auto rounded-md rounded-bl-xs bg-sheet-alt px-3.5 py-3 text-body-m break-words whitespace-pre-wrap text-on-surface">
            {message}
          </p>
        </details>
      )}
      <div className="mt-auto">{actions}</div>
    </article>
  );
}
