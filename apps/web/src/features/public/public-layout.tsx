import type { ReactNode } from "react";
import { Wordmark } from "@/components/logo";

type PublicLayoutProps = {
  children: ReactNode;
  companyName?: string;
  supportPhone?: string | null;
};

/** A compact, unauthenticated shell for recipient and merchant pages. */
export function PublicLayout({ children, companyName = "Cohex", supportPhone }: PublicLayoutProps) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-paper text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container">
        <div className="mx-auto flex min-h-16 w-full max-w-xl items-center px-4">
          <Wordmark className="h-10 w-fit text-primary" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl min-w-0 grow px-4 py-8">{children}</main>
      {supportPhone && (
        <footer className="border-t border-outline-variant bg-surface-container-low">
          <div className="mx-auto flex w-full max-w-xl min-w-0 flex-col gap-3 px-4 py-6">
            <div>
              <h2 className="text-title-m">¿Necesitas ayuda?</h2>
              <p className="wrap-anywhere text-body-m text-on-surface-variant">
                Contacta a {companyName}.
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <a
                href={`tel:+57${supportPhone}`}
                className="state-layer inline-flex min-h-12 min-w-12 max-w-full items-center justify-center rounded-sm border border-outline-variant bg-sheet px-4 py-3 text-center text-label-l text-primary whitespace-normal wrap-anywhere outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
              >
                Llamar a {companyName}
              </a>
              <a
                href={`https://wa.me/57${supportPhone}`}
                className="state-layer inline-flex min-h-12 min-w-12 max-w-full items-center justify-center rounded-sm border border-outline-variant bg-sheet px-4 py-3 text-center text-label-l text-primary whitespace-normal wrap-anywhere outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
