import ErrorIcon from "@material-symbols/svg-400/rounded/error.svg?react";
import ScheduleIcon from "@material-symbols/svg-400/rounded/schedule.svg?react";
import type { ReactNode } from "react";
import { Icon, type Symbol } from "@/components/icon";
import { Wordmark } from "@/components/logo";
import { cn } from "@/lib/cn";

/**
 * The screens outside the panel (sign-in, recovery, the courier's waiting page), as approved in
 * feature 006 (T055): the wordmark on pizarra beside a plain form on paper, two columns on
 * desktop and a pizarra strip over the form on phones (design-system.md §8).
 */
export function AuthCard({
  title,
  description,
  icon,
  tone = "neutral",
  children,
}: {
  title: string;
  description?: ReactNode;
  /** A large icon above the title, for a result rather than a form (sent, waiting). */
  icon?: Symbol;
  tone?: "neutral" | "success";
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <header className="flex items-center bg-rail px-4 py-3.5 text-on-rail lg:flex-col lg:items-start lg:justify-between lg:p-12">
        <div className="flex items-center gap-2.5 lg:flex-col lg:items-start lg:gap-0.5">
          <Wordmark className="h-9 w-fit text-accent lg:h-24" />
          <p className="mt-1.5 text-body-m text-on-rail-variant lg:mt-0 lg:ml-1 lg:text-body-l">
            de Cohex
          </p>
        </div>
        <p className="hidden max-w-[28ch] text-lede text-on-rail-variant lg:block">
          Despacho y seguimiento de los envíos de{" "}
          <span className="font-semibold text-on-rail">Cohex</span> en Medellín y el Valle de
          Aburrá.
        </p>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-7 pb-10 lg:items-center lg:p-12">
        <div className="flex w-full max-w-100 flex-col gap-6">
          <div className="flex flex-col gap-3.5">
            {icon && (
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-14 place-items-center rounded-full",
                  tone === "success"
                    ? "bg-success-container text-on-success-container"
                    : "bg-secondary-container text-on-secondary-container",
                )}
              >
                <Icon symbol={icon} className="size-7" />
              </span>
            )}
            <div>
              <h1 className="text-headline-m text-on-surface">{title}</h1>
              {description && (
                <p className="mt-2 text-body-l text-on-surface-variant">{description}</p>
              )}
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/** The quiet links under a form ("¿Olvidaste tu contraseña?", "Volver a ingresar"). */
export const authLink =
  "inline-flex min-h-11 items-center self-start rounded-xs text-body-l font-semibold text-on-surface underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent-strong";

/**
 * A notice that stops the form, with its title and the way out: the lockout (warning) or a link
 * that no longer works (error).
 */
export function AuthNotice({
  tone,
  title,
  children,
}: {
  tone: "warning" | "error";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-2.5 rounded-md p-3.5 text-body-l",
        tone === "warning"
          ? "bg-warning-container text-on-warning-container"
          : "bg-error-container text-on-error-container",
      )}
    >
      <Icon symbol={tone === "warning" ? ScheduleIcon : ErrorIcon} />
      <div>
        <p className="font-bold">{title}</p>
        <p>{children}</p>
      </div>
    </div>
  );
}
