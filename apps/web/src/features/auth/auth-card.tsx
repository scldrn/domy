import type { ReactNode } from "react";

/**
 * The screens outside the panel (sign-in, recovery, the courier's waiting page): the product
 * on the rail's slate beside a plain form on paper; stacked on narrow screens.
 */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <header className="flex flex-col justify-between gap-6 bg-rail px-6 py-6 text-on-rail lg:px-12 lg:py-12">
        <p className="flex flex-col gap-1">
          <span className="text-[2.25rem] leading-none font-bold tracking-[-0.02em] [font-stretch:125%] lg:text-[3.5rem]">
            domy
          </span>
          <span className="text-body-m text-on-rail-variant">de Cohex</span>
        </p>
        <p className="hidden max-w-[28ch] text-lede text-on-rail-variant lg:block">
          Despacho y seguimiento de los envíos de Cohex en Medellín y el Valle de Aburrá.
        </p>
      </header>
      <main className="flex items-start justify-center px-4 py-10 lg:items-center lg:px-12">
        <div className="w-full max-w-sm">
          <h1 className="text-headline-m text-on-surface">{title}</h1>
          <p className="mt-2 mb-8 text-body-l text-on-surface-variant">{description}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
