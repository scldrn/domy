import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { merchantServiceDateWindow } from "@domy/domain";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MerchantShipmentDetail } from "@/features/public/merchant-shipment-detail";
import {
  MerchantDateSelector,
  MerchantShipmentList,
} from "@/features/public/merchant-shipment-list";
import { publicMerchantDayQuery } from "@/features/public/api";
import { PublicLayout } from "@/features/public/public-layout";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";

export const Route = createFileRoute("/cliente/$code")({ component: MerchantPage });

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

  function errorMessage(error: Error): string {
    if (error instanceof ApiError && error.status === 404) return "Este enlace no es válido";
    if (error instanceof ApiError && error.status === 429) return error.message;
    if (error instanceof ApiError && error.status === 0) return error.message;
    if (isDateOutOfRange && error instanceof ApiError) return error.message;
    return "No pudimos cargar los envíos del cliente. Intenta de nuevo.";
  }

  return (
    <PublicLayout
      {...(day
        ? {
            companyName: day.support.companyName,
            supportPhone: day.support.phone,
          }
        : {})}
    >
      <section className="flex flex-col gap-2">
        <h1 className="text-headline-l">Envíos del cliente</h1>
        {dayQuery.isPending ? (
          <p className="text-body-l text-on-surface-variant" role="status" aria-live="polite">
            Cargando los envíos…
          </p>
        ) : dayQuery.isError ? (
          <div className="flex flex-col items-start gap-4" role="alert">
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
                  onChange={(date) => {
                    setSelectedShipmentId(null);
                    setSelectedDate(date);
                  }}
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
          selectedShipmentId ? (
            <MerchantShipmentDetail
              code={code}
              shipmentId={selectedShipmentId}
              onBack={() => {
                setSelectedShipmentId(null);
              }}
            />
          ) : (
            <MerchantShipmentList
              day={day}
              selectedDate={selectedDate ?? day.date}
              minDate={dateWindow.firstDate}
              maxDate={dateWindow.lastDate}
              onDateChange={(date) => {
                setSelectedShipmentId(null);
                setSelectedDate(date);
              }}
              onOpenShipment={setSelectedShipmentId}
            />
          )
        ) : null}
      </section>
    </PublicLayout>
  );
}
