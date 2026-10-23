import { useQuery } from "@tanstack/react-query";
import type { PublicTracking } from "@domy/domain";
import { Button } from "@/components/ui/button";
import { publicTrackingQuery } from "@/features/public/api";
import { PublicLayout } from "@/features/public/public-layout";
import { ApiError } from "@/lib/api-client";
import { formatCop, formatDate, formatWindow } from "@/lib/format";

type TrackingStatusProps = {
  code: string;
};

function errorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "Este enlace no es válido";
    if (error.status === 429) return error.message;
    if (error.status === 0) return error.message;
  }
  return "No pudimos actualizar el seguimiento. Intenta de nuevo.";
}

function TrackingError({ error, retry }: { error: Error; retry: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div className="flex flex-col items-start gap-3" role={notFound ? "status" : "alert"}>
      <h2 className="text-title-l">{errorMessage(error)}</h2>
      {notFound ? (
        <p className="text-body-m text-on-surface-variant">
          Pídele al comercio que te comparta el enlace de nuevo.
        </p>
      ) : (
        <Button variant="outline" onClick={retry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

function ContactLinks({ firstName, phone }: { firstName: string; phone: string }) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="courier-contact">
      <h3 id="courier-contact" className="text-title-m">
        Mensajero: {firstName}
      </h3>
      <div className="flex min-w-0 flex-wrap gap-2">
        <a
          href={`tel:+57${phone}`}
          className="state-layer inline-flex min-h-12 min-w-12 max-w-full items-center justify-center rounded-sm border border-outline-variant bg-sheet px-4 py-3 text-center text-label-l text-primary whitespace-normal wrap-anywhere outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid"
        >
          Llamar al mensajero
        </a>
        <a
          href={`https://wa.me/57${phone}`}
          className="state-layer inline-flex min-h-12 min-w-12 max-w-full items-center justify-center rounded-sm border border-outline-variant bg-sheet px-4 py-3 text-center text-label-l text-primary whitespace-normal wrap-anywhere outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid"
        >
          WhatsApp del mensajero
        </a>
      </div>
    </section>
  );
}

function FullTracking({ tracking }: { tracking: Extract<PublicTracking, { expired: false }> }) {
  const window = tracking.window ? formatWindow(tracking.window.start, tracking.window.end) : null;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div aria-live="polite">
          <h2 className="text-title-l">{tracking.statusText}</h2>
        </div>
        <p className="text-body-m text-on-surface-variant">{tracking.merchantName}</p>
      </div>

      <dl className="grid min-w-0 gap-3 rounded-md border border-outline-variant bg-surface-container-low p-4 text-body-m">
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-label-m text-on-surface-variant">Número de seguimiento</dt>
          <dd className="wrap-anywhere font-medium">{tracking.trackingNumber}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-label-m text-on-surface-variant">Fecha programada</dt>
          <dd>{formatDate(tracking.serviceDate)}</dd>
        </div>
        {window && (
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-label-m text-on-surface-variant">Franja de entrega</dt>
            <dd>{window}</dd>
          </div>
        )}
        {tracking.kind === "carrier_handoff" ? (
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-label-m text-on-surface-variant">Transportadora y destino</dt>
            <dd className="wrap-anywhere">
              {tracking.carrierName} · {tracking.destinationTown}
            </dd>
          </div>
        ) : (
          tracking.neighborhood && (
            <div className="flex min-w-0 flex-col gap-1">
              <dt className="text-label-m text-on-surface-variant">Barrio de destino</dt>
              <dd className="wrap-anywhere">{tracking.neighborhood}</dd>
            </div>
          )
        )}
      </dl>

      {tracking.reasonText && (
        <p className="rounded-sm bg-error-container p-4 text-on-error-container">
          {tracking.reasonText}
        </p>
      )}

      {tracking.deliveriesBefore !== undefined && (
        <p className="text-body-m">
          <span className="font-medium">Estimación: </span>
          <span>
            {tracking.deliveriesBefore === 0
              ? "Eres la siguiente entrega"
              : `${String(tracking.deliveriesBefore)} entregas antes de la tuya`}
          </span>
        </p>
      )}

      {tracking.amountToPay !== undefined && (
        <div className="rounded-sm bg-secondary-container p-4 text-on-secondary-container">
          <p className="text-label-l">Valor a pagar al recibir</p>
          <p className="text-title-l">{formatCop(tracking.amountToPay)}</p>
        </div>
      )}

      {tracking.deliveredAt && (
        <p className="text-body-m">Fecha de entrega: {formatDate(tracking.deliveredAt)}</p>
      )}

      {tracking.courier && (
        <ContactLinks firstName={tracking.courier.firstName} phone={tracking.courier.phone} />
      )}
    </section>
  );
}

export function TrackingStatus({ code }: TrackingStatusProps) {
  const query = useQuery({
    ...publicTrackingQuery(code),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const tracking = query.isError ? undefined : query.data;

  return (
    <PublicLayout
      {...(tracking
        ? {
            companyName: tracking.support.companyName,
            supportPhone: tracking.support.phone,
          }
        : {})}
    >
      <section className="flex flex-col gap-5">
        <h1 className="text-headline-l">Seguimiento de envío</h1>
        {query.isError ? (
          <TrackingError error={query.error} retry={() => void query.refetch()} />
        ) : query.isPending ? (
          <p className="text-body-m text-on-surface-variant" role="status" aria-live="polite">
            Cargando seguimiento…
          </p>
        ) : tracking?.expired ? (
          <div role="status">
            <h2 className="text-title-l">Este enlace venció</h2>
          </div>
        ) : tracking ? (
          <FullTracking tracking={tracking} />
        ) : null}
      </section>
    </PublicLayout>
  );
}
