import HourglassIcon from "@material-symbols/svg-400/rounded/hourglass_top.svg?react";
import LogoutIcon from "@material-symbols/svg-400/rounded/logout.svg?react";
import SyncIcon from "@material-symbols/svg-400/rounded/sync.svg?react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/auth-card";

/**
 * The courier waiting page, as approved in feature 006 (T055): a courier account the owner has
 * not linked yet sees what is missing and what to do, instead of an empty route with refusals
 * (spec 003 FR-002: "an account not linked sees no route and is told to ask the owner").
 */
export function CourierWaitingPage({
  account,
  checking,
  signingOut,
  onRetry,
  onSignOut,
}: {
  account: { name: string; email: string } | null;
  checking: boolean;
  signingOut: boolean;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <AuthCard
      title="Falta vincular tu cuenta"
      icon={HourglassIcon}
      description="Ingresaste bien, pero esta cuenta todavía no está vinculada a un mensajero, así que no hay ruta que mostrar."
    >
      {account && (
        <dl className="rounded-lg border border-outline-variant bg-sheet px-4 py-1 text-body-l">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 py-3">
            <dt className="text-on-surface-variant">Cuenta</dt>
            <dd className="text-right font-semibold wrap-anywhere text-on-surface">
              {account.name}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 border-t border-outline-variant py-3">
            <dt className="text-on-surface-variant">Correo</dt>
            <dd className="text-right font-semibold wrap-anywhere text-on-surface">
              {account.email}
            </dd>
          </div>
        </dl>
      )}
      <ol aria-label="Qué sigue" className="flex flex-col gap-2.5 text-body-l text-on-surface">
        {[
          "Pide al propietario que la vincule en «Usuarios».",
          "Cuando lo haga, toca «Volver a revisar» y verás tu ruta.",
        ].map((step, index) => (
          <li key={step} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary-container text-label-l font-bold text-on-secondary-container"
            >
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2.5">
        <Button variant="accent" className="w-full" disabled={checking} onClick={onRetry}>
          <Icon symbol={SyncIcon} size={20} />
          {checking ? "Revisando…" : "Volver a revisar"}
        </Button>
        <Button variant="outline" className="w-full" disabled={signingOut} onClick={onSignOut}>
          <Icon symbol={LogoutIcon} size={20} />
          Cerrar sesión
        </Button>
      </div>
    </AuthCard>
  );
}
