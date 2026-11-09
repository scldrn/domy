import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { bogotaToday, publicTrackingStage, type PublicTracking } from "@domy/domain";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { publicTrackingQuery } from "@/features/public/api";
import { ErrorIcon, MopedIcon, ScheduleIcon } from "@/features/public/public-icons";
import { ContactButtons, PublicLayout, SupportCard } from "@/features/public/public-layout";
import { arrivalDay, arrivalWindow, queueText } from "@/features/public/tracking-view";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { formatCop, formatDate, formatWindow } from "@/lib/format";

type TrackingStatusProps = {
  code: string;
};

type FullTracking = Extract<PublicTracking, { expired: false }>;

/** The status color: it only says where the shipment stands (design-system.md §3). */
const stageTone = {
  progress: "bg-info",
  delivered: "bg-success",
  problem: "bg-error",
  closed: "bg-outline",
} as const;

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
    <div
      className="flex flex-col items-start gap-3 rounded-lg border border-outline-variant bg-sheet p-5"
      role={notFound ? "status" : "alert"}
    >
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

/** The deliveries before yours as dots ending in «Tú», at most five drawn. */
function Queue({ before }: { before: number }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-l">{queueText(before)}</p>
      <div aria-hidden="true" className="flex items-center gap-1.5">
        {Array.from({ length: Math.min(before, 5) }, (_, index) => (
          <span key={index} className="size-3 rounded-full bg-outline-variant" />
        ))}
        {before > 0 && <span className="h-0.5 w-4.5 rounded-full bg-outline-variant" />}
        <span className="rounded-full bg-on-surface px-2.5 py-0.5 text-label-m text-sheet">Tú</span>
      </div>
    </div>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-outline-variant py-3 first:border-t-0">
      <dt className="text-body-l text-on-surface-variant">{term}</dt>
      <dd className="min-w-0 text-right text-body-l font-[650] wrap-anywhere">{children}</dd>
    </div>
  );
}

function FullTrackingView({ tracking }: { tracking: FullTracking }) {
  const stage = publicTrackingStage(tracking);
  const onItsWay = stage === "progress";
  const window = tracking.window ? formatWindow(tracking.window.start, tracking.window.end) : null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="relative flex flex-col gap-3.5 overflow-hidden rounded-lg border-2 border-on-surface bg-sheet px-4.5 pt-5 pb-4.5">
          <span
            aria-hidden="true"
            className={cn("absolute inset-x-0 top-0 h-1.5", stageTone[stage])}
          />
          <div aria-live="polite" className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn("mt-3 size-3.5 flex-none rounded-full", stageTone[stage])}
            />
            <h2 className="text-headline-m">{tracking.statusText}</h2>
          </div>
          {tracking.reasonText && (
            <p className="flex gap-2.5 rounded-md bg-error-container p-3.5 text-title-m text-on-error-container">
              <Icon symbol={ErrorIcon} className="mt-0.5" />
              {tracking.reasonText}
            </p>
          )}
          {onItsWay && (
            <div className="flex gap-3 rounded-md bg-sheet-alt p-3.5">
              <Icon symbol={ScheduleIcon} className="mt-0.5 text-on-surface-variant" />
              <p className="flex flex-col">
                <span className="text-title-l">
                  {arrivalDay(tracking.kind, tracking.serviceDate, bogotaToday(now()))}
                </span>
                {tracking.window && (
                  <span className="text-body-l text-on-surface-variant">
                    {arrivalWindow(tracking.window)}
                  </span>
                )}
              </p>
            </div>
          )}
          {tracking.deliveriesBefore !== undefined && <Queue before={tracking.deliveriesBefore} />}
          {tracking.amountToPay !== undefined && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-outline p-3.5">
              <span className="text-title-s">Valor a pagar al recibir</span>
              <span className="text-headline-s font-[750] whitespace-nowrap tabular-nums">
                {formatCop(tracking.amountToPay)}
              </span>
            </div>
          )}
        </section>
        {tracking.courier && (
          <section
            aria-labelledby="courier-contact"
            className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-sheet p-4"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-11 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container"
              >
                <Icon symbol={MopedIcon} />
              </span>
              <h2 id="courier-contact" className="text-title-m">
                Mensajero: {tracking.courier.firstName}
              </h2>
            </div>
            <ContactButtons phone={tracking.courier.phone} who="al mensajero" />
          </section>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <section
          aria-labelledby="tracking-facts"
          className="rounded-lg border border-outline-variant bg-sheet px-4 py-1"
        >
          <h2 id="tracking-facts" className="sr-only">
            Datos del envío
          </h2>
          <dl>
            <Fact term="Número de seguimiento">
              <span className="guia">{tracking.trackingNumber}</span>
            </Fact>
            <Fact term="Fecha programada">{formatDate(tracking.serviceDate)}</Fact>
            {window && stage === "problem" && <Fact term="Franja de entrega">{window}</Fact>}
            {tracking.kind === "carrier_handoff" ? (
              <Fact term="Transportadora y destino">
                {tracking.carrierName} · {tracking.destinationTown}
              </Fact>
            ) : (
              tracking.neighborhood && <Fact term="Barrio de destino">{tracking.neighborhood}</Fact>
            )}
            {tracking.deliveredAt && (
              <Fact term="Fecha de entrega">{formatDate(tracking.deliveredAt)}</Fact>
            )}
          </dl>
        </section>
        <SupportCard companyName={tracking.support.companyName} phone={tracking.support.phone} />
      </div>
    </div>
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
    <PublicLayout label="Seguimiento">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 lg:max-w-none">
        <header className="flex flex-col gap-0.5">
          <h1 className="text-label-l tracking-wide text-on-surface-variant uppercase">
            Seguimiento de envío
          </h1>
          {tracking && !tracking.expired && (
            <p className="text-body-l text-on-surface-variant">
              Envío de <b className="font-[650] text-on-surface">{tracking.merchantName}</b>
            </p>
          )}
        </header>
        {query.isError ? (
          <TrackingError error={query.error} retry={() => void query.refetch()} />
        ) : query.isPending ? (
          <p className="text-body-m text-on-surface-variant" role="status" aria-live="polite">
            Cargando seguimiento…
          </p>
        ) : tracking?.expired ? (
          <div className="flex flex-col gap-4 lg:max-w-xl">
            <div role="status" className="rounded-lg border border-outline-variant bg-sheet p-5">
              <h2 className="text-headline-s">Este enlace venció</h2>
            </div>
            <SupportCard
              companyName={tracking.support.companyName}
              phone={tracking.support.phone}
            />
          </div>
        ) : tracking ? (
          <FullTrackingView tracking={tracking} />
        ) : null}
      </div>
    </PublicLayout>
  );
}
