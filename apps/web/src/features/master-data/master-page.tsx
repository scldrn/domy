import type { ReactNode } from "react";
import { SummarySentence, type SentencePart } from "@/components/summary-sentence";

/**
 * The head of a master data or administration screen, as approved in feature 006 (US5): the
 * title, one sentence with its numbers, and the screen's actions on the right.
 */
export function MasterHeader({
  title,
  sentence,
  actions,
}: {
  title: string;
  sentence?: SentencePart[] | null;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
      <div className="flex min-w-0 flex-[1_1_26rem] flex-col gap-1.5">
        <h1 className="text-headline-l text-on-surface">{title}</h1>
        {sentence && <SummarySentence parts={sentence} />}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A list on a sheet, with its heading, count, and how it is ordered. */
export function ListSheet({
  id,
  title,
  count,
  note,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-lg border border-outline-variant bg-sheet"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 py-3.5 max-[820px]:px-4">
        <h2 id={id} className="flex items-baseline gap-2 text-title-l text-on-surface">
          {title}
          {count !== undefined && (
            <span className="text-body-l text-on-surface-variant tabular-nums">{count}</span>
          )}
        </h2>
        {note && <span className="text-body-m text-on-surface-variant">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** A sheet with padding, for forms and facts beside a list (detail screens, settings). */
export function DetailSheet({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3.5 rounded-lg border border-outline-variant bg-sheet px-5.5 py-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 id={id} className="text-title-l text-on-surface">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
