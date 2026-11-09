import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { bogotaToday, merchantServiceDateWindow } from "@domy/domain";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MerchantShipmentDetail } from "@/features/public/merchant-shipment-detail";
import {
  MerchantDateSelector,
  MerchantDayHeader,
  MerchantShipmentList,
  MerchantTotals,
} from "@/features/public/merchant-shipment-list";
import { publicMerchantDayQuery } from "@/features/public/api";
import { PublicLayout, SupportCard } from "@/features/public/public-layout";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/cliente/$code")({ component: MerchantPage });

/**
 * «Enlace del cliente» (feature 002), as approved in feature 006 (US4): the day as a sentence
 * with its stepper, the states and money, then the shipments; a shipment's detail opens beside
 * the list on desktop and as its own page on phones.
 */
function MerchantPage() {
  const { code } = Route.useParams();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const dayQuery = useQuery({
    ...publicMerchantDayQuery(code, selectedDate ?? undefined),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const day = dayQuery.isError ? undefined : dayQuery.data;
  const isDateOutOfRange =
    dayQuery.isError &&
    dayQuery.error instanceof ApiError &&
    dayQuery.error.code === "date_out_of_range";
  const dateWindow = day || isDateOutOfRange ? merchantServiceDateWindow(now()) : undefined;
  const changeDate = (date: string | null) => {
    setSelectedShipmentId(null);
    setSelectedDate(date);
  };

  function errorMessage(error: Error): string {
    if (error instanceof ApiError && error.status === 404) return "Este enlace no es válido";
    if (error instanceof ApiError && error.status === 429) return error.message;
    if (error instanceof ApiError && error.status === 0) return error.message;
    if (isDateOutOfRange && error instanceof ApiError) return error.message;
    return "No pudimos cargar los envíos del cliente. Intenta de nuevo.";
  }

  const detailOpen = selectedShipmentId !== null;
  return (
    <PublicLayout label="Enlace del cliente">
      <div className="flex min-w-0 flex-col gap-5">
        <h1 className="text-label-l tracking-wide text-on-surface-variant uppercase">
          Envíos del cliente
        </h1>
        {dayQuery.isPending ? (
          <p className="text-body-l text-on-surface-variant" role="status" aria-live="polite">
            Cargando los envíos…
          </p>
        ) : dayQuery.isError ? (
          <div
            className="flex flex-col items-start gap-4 rounded-lg border border-outline-variant bg-sheet p-5"
            role="alert"
          >
            <div className="flex flex-col gap-2">
              <h2 className="text-title-l">{errorMessage(dayQuery.error)}</h2>
              {dayQuery.error instanceof ApiError && dayQuery.error.status === 404 ? (
                <p className="text-body-m text-on-surface-variant">
                  Pídele a la empresa que te comparta un enlace vigente.
                </p>
              ) : isDateOutOfRange ? (
                <p className="text-body-m text-on-surface-variant">
                  Elige una fecha dentro de los últimos 30 días o vuelve a hoy.
                </p>
              ) : null}
            </div>
            {isDateOutOfRange && dateWindow && (
              <div className="flex w-full min-w-0 flex-col items-start gap-3">
                <MerchantDateSelector
                  value={selectedDate ?? ""}
                  minDate={dateWindow.firstDate}
                  maxDate={dateWindow.lastDate}
                  onChange={changeDate}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedDate(null);
                  }}
                >
                  Volver a hoy
                </Button>
              </div>
            )}
            {!(dayQuery.error instanceof ApiError && dayQuery.error.status === 404) && (
              <Button variant="outline" onClick={() => void dayQuery.refetch()}>
                Reintentar
              </Button>
            )}
          </div>
        ) : day && dateWindow ? (
          <>
            <MerchantDayHeader
              day={day}
              today={bogotaToday(now())}
              minDate={dateWindow.firstDate}
              maxDate={dateWindow.lastDate}
              onDateChange={changeDate}
            />
            <div className={cn(detailOpen && "max-lg:hidden")}>
              <MerchantTotals day={day} />
            </div>
            <div
              className={cn(
                "grid min-w-0 items-start gap-5",
                detailOpen && "lg:grid-cols-[minmax(0,1fr)_26rem]",
              )}
            >
              <div className={cn("min-w-0", detailOpen && "max-lg:hidden")}>
                <MerchantShipmentList
                  key={day.date}
                  day={day}
                  openShipmentId={selectedShipmentId}
                  onOpenShipment={setSelectedShipmentId}
                />
              </div>
              {selectedShipmentId && (
                <MerchantShipmentDetail
                  code={code}
                  shipmentId={selectedShipmentId}
                  className="lg:sticky lg:top-4"
                  onBack={() => {
                    setSelectedShipmentId(null);
                  }}
                />
              )}
            </div>
            <SupportCard
              companyName={day.support.companyName}
              phone={day.support.phone}
              className="lg:max-w-xl"
            />
          </>
        ) : null}
      </div>
    </PublicLayout>
  );
}
