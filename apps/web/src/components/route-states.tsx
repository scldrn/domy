import ErrorIcon from "@material-symbols/svg-400/rounded/error.svg?react";
import SearchOffIcon from "@material-symbols/svg-400/rounded/search_off.svg?react";
import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { ApiError } from "@/lib/api-client";
import { EmptyState } from "./empty-state";
import { Button, buttonVariants } from "./ui/button";

/** Shown in place of a page that failed to load, so the screen is never left blank. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="mx-auto w-full max-w-xl p-6">
      <EmptyState
        icon={ErrorIcon}
        title="No pudimos cargar esta página"
        description={
          error instanceof ApiError
            ? error.message
            : "Revisa tu conexión e inténtalo de nuevo. Si sigue fallando, avísale al administrador."
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              onClick={() => {
                reset();
                void router.invalidate();
              }}
            >
              Reintentar
            </Button>
            <Link to="/" className={buttonVariants({ variant: "outline" })}>
              Ir al tablero
            </Link>
          </div>
        }
      />
    </div>
  );
}

/** An address that matches no page. */
export function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl p-6">
      <EmptyState
        icon={SearchOffIcon}
        title="Esta página no existe"
        description="Puede que el enlace esté incompleto o que la página haya cambiado de dirección."
        action={
          <Link to="/" className={buttonVariants()}>
            Ir al tablero
          </Link>
        }
      />
    </div>
  );
}
