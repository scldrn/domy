import ArrowBackIcon from "@material-symbols/svg-400/rounded/arrow_back.svg?react";
import CallIcon from "@material-symbols/svg-400/rounded/call.svg?react";
import ChatIcon from "@material-symbols/svg-400/rounded/chat.svg?react";
import DirectionsIcon from "@material-symbols/svg-400/rounded/directions.svg?react";
import RouteIcon from "@material-symbols/svg-400/rounded/route.svg?react";
import { stopKindLabels, type CourierStop } from "@domy/domain";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { EmptyState } from "@/components/empty-state";
import { Icon, type Symbol } from "@/components/icon";
import { buttonVariants } from "@/components/ui/button";
import { useCourierState } from "@/features/courier/courier-store";
import { TaskCard } from "@/features/courier/task-card";
import { cn } from "@/lib/cn";
import { watchLocation } from "@/lib/offline/location";

/**
 * A stop of the courier's route and its tasks (feature 003, US1, FR-005–FR-016), as approved in
 * feature 006: the stop's place, three large shortcuts, and each task with its main action in
 * lime and the exception reasons one tap away (FR-016: within 3 taps of «Mi ruta»).
 */
export const Route = createFileRoute("/_courier/mensajero/parada/$stopId")({
  head: () => ({ meta: [{ title: "Parada · Domy" }] }),
  component: CourierStopPage,
});

/** Colombian mobile numbers are dialed and messaged with the country code. */
function internationalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `57${digits}` : digits;
}

function CourierStopPage() {
  const { stopId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { view } = useCourierState();
  // The position while the stop is open, attached to its records when fresh (FR-015).
  useEffect(() => watchLocation(), []);

  const stops = view?.route?.stops ?? [];
  const index = stops.findIndex((stop) => stop.id === stopId);
  const stop = stops[index];
  if (!stop) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <EmptyState
          icon={RouteIcon}
          title="Esta parada ya no está en tu ruta"
          description="El coordinador pudo haberla cambiado, o tu ruta terminó."
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <BackLink />
      <header className="-mt-2 flex flex-col gap-1">
        <p className="text-label-l tracking-wide text-on-surface-variant uppercase">
          Parada {index + 1} de {stops.length}
        </p>
        <h1 className="text-headline-m text-on-surface">{stopKindLabels[stop.kind]}</h1>
        <p className="text-title-l text-on-surface">{stop.address}</p>
        {stop.neighborhood && (
          <p className="text-body-l text-on-surface-variant">{stop.neighborhood.name}</p>
        )}
      </header>
      <Shortcuts stop={stop} />
      <section aria-labelledby="envios-parada" className="flex flex-col gap-2.5">
        <h2 id="envios-parada" className="flex items-baseline gap-2 text-title-l text-on-surface">
          Envíos{" "}
          <span className="text-body-l text-on-surface-variant tabular-nums">
            {stop.tasks.length}
          </span>
        </h2>
        <ul className="flex flex-col gap-3" aria-label="Envíos de la parada">
          {stop.tasks.map((task) => (
            <TaskCard key={task.id} task={task} userId={user?.id ?? null} view={view} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/mensajero"
      className={cn(buttonVariants({ variant: "ghost" }), "-ml-4 self-start text-on-surface")}
    >
      <Icon symbol={ArrowBackIcon} />
      Mi ruta
    </Link>
  );
}

/** Call, WhatsApp, and map, each only when its data exists (FR-016). */
function Shortcuts({ stop }: { stop: CourierStop }) {
  const place = [stop.address, stop.neighborhood?.name, "Antioquia"].filter(Boolean).join(", ");
  const links: { href: string; label: string; icon: Symbol; external?: boolean }[] = [
    ...(stop.contactPhone
      ? [
          {
            href: `tel:+${internationalPhone(stop.contactPhone)}`,
            label: "Llamar",
            icon: CallIcon,
          },
          {
            href: `https://wa.me/${internationalPhone(stop.contactPhone)}`,
            label: "WhatsApp",
            icon: ChatIcon,
            external: true,
          },
        ]
      : []),
    {
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`,
      label: "Mapa",
      icon: DirectionsIcon,
      external: true,
    },
  ];
  return (
    <nav aria-label="Atajos de la parada" className="grid grid-cols-3 gap-2">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          {...(link.external && { target: "_blank", rel: "noreferrer" })}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-auto min-h-16 flex-col gap-1 px-2 has-[svg]:pl-2",
          )}
        >
          <Icon symbol={link.icon} />
          {link.label}
        </a>
      ))}
    </nav>
  );
}
