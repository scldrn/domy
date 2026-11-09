import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { Wordmark } from "@/components/logo";
import { CallIcon, ChatIcon } from "@/features/public/public-icons";
import { cn } from "@/lib/cn";

type PublicLayoutProps = {
  children: ReactNode;
  /** What the page is, beside the wordmark («Seguimiento», «Enlace del cliente»). */
  label: string;
  className?: string;
};

/**
 * The unauthenticated shell of recipient and merchant pages, as approved in feature 006 (US4):
 * pizarra only in the header, with the lime wordmark; light or dark surfaces below.
 */
export function PublicLayout({ children, label, className }: PublicLayoutProps) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-paper text-on-surface">
      <header className="bg-rail text-on-rail">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Wordmark className="h-8 w-fit text-accent" />
          <span className="text-label-l text-on-rail-variant">{label}</span>
        </div>
      </header>
      <main
        className={cn("mx-auto flex w-full max-w-6xl min-w-0 grow flex-col px-4 py-6", className)}
      >
        {children}
      </main>
    </div>
  );
}

/** A 48 px outlined link with its icon (Constitution VII). */
export const contactLink =
  "state-layer inline-flex min-h-12 min-w-12 max-w-full items-center justify-center gap-2 rounded-md border border-outline bg-sheet px-4 py-2 text-center text-label-l text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid";

/**
 * Call and WhatsApp side by side, for the courier or the company: short visible words, and
 * names that say whom («Llamar a Cohex», «WhatsApp al mensajero»).
 */
export function ContactButtons({ phone, who }: { phone: string; who: string }) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2">
      <a href={`tel:+57${phone}`} aria-label={`Llamar ${who}`} className={contactLink}>
        <Icon symbol={CallIcon} size={20} />
        Llamar
      </a>
      <a href={`https://wa.me/57${phone}`} aria-label={`WhatsApp ${who}`} className={contactLink}>
        <Icon symbol={ChatIcon} size={20} />
        WhatsApp
      </a>
    </div>
  );
}

/** «¿Necesitas ayuda?»: the company's support line, the only contact besides the courier. */
export function SupportCard({
  companyName,
  phone,
  className,
}: {
  companyName: string;
  phone: string | null;
  className?: string;
}) {
  if (!phone) return null;
  return (
    <section
      aria-labelledby="public-support"
      className={cn("flex min-w-0 flex-col gap-3 rounded-lg bg-sheet-alt p-4", className)}
    >
      <div>
        <h2 id="public-support" className="text-title-m">
          ¿Necesitas ayuda?
        </h2>
        <p className="wrap-anywhere text-body-m text-on-surface-variant">
          Contacta a {companyName}.
        </p>
      </div>
      <ContactButtons phone={phone} who={`a ${companyName}`} />
    </section>
  );
}
