import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DataColumn<Row> = {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** Right-aligned figures (money). */
  align?: "end";
  /**
   * Where the cell goes when rows become cards under 820 px: its order, and whether it starts a
   * line, ends one (right-aligned), or takes one of its own.
   */
  card: { order: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; place: "start" | "end" | "full" } | "hidden";
};

const cardOrder = [
  "",
  "max-[820px]:order-1",
  "max-[820px]:order-2",
  "max-[820px]:order-3",
  "max-[820px]:order-4",
  "max-[820px]:order-5",
  "max-[820px]:order-6",
  "max-[820px]:order-7",
  "max-[820px]:order-8",
];
const cardPlace = {
  start: "",
  end: "max-[820px]:text-right",
  full: "max-[820px]:col-span-2",
};

function cardClass(card: DataColumn<unknown>["card"]): string {
  return card === "hidden"
    ? "max-[820px]:hidden"
    : cn(cardOrder[card.order], cardPlace[card.place]);
}

/**
 * A data list (design-system.md §7, contracts/components.md): grid rows on a sheet under a
 * header row on `sheet-alt`, long text wrapped to two lines, a bounded first page with
 * "Ver los N", and cards instead of columns under 820 px. It keeps table semantics, so
 * screen readers read headers with cells. A row opens its item; the keyboard reaches it
 * through the row's own button (the first column's).
 */
export function DataList<Row>({
  label,
  columns,
  template,
  rows,
  rowKey,
  rowId,
  isActive,
  onOpen,
  pageSize = 8,
  moreLabel,
  empty,
}: {
  label: string;
  columns: DataColumn<Row>[];
  /** `grid-template-columns` of the wide layout. */
  template: string;
  rows: Row[];
  rowKey: (row: Row) => string;
  rowId?: (row: Row) => string;
  isActive?: (row: Row) => boolean;
  onOpen?: (row: Row) => void;
  pageSize?: number;
  /** "Ver los 24 envíos". */
  moreLabel: (count: number) => string;
  empty?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, pageSize);
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div>
      {/* Relative, so absolutely positioned text inside a row (sr-only labels) scrolls with the
          table instead of widening the page at 1024 px (FR-012). */}
      <div
        className="relative overflow-x-auto [scrollbar-width:thin]"
        tabIndex={0}
        role="region"
        aria-label={`${label}, desplazable`}
      >
        <div
          role="table"
          aria-label={label}
          aria-rowcount={rows.length + 1}
          className="min-w-[65rem] max-[820px]:min-w-0"
          style={{ ["--cols" as string]: template }}
        >
          <div role="rowgroup" className="max-[820px]:hidden">
            <div
              role="row"
              aria-rowindex={1}
              className="grid grid-cols-(--cols) gap-x-4 border-t border-outline-variant bg-sheet-alt px-5 py-2 text-label-m text-on-surface-variant"
            >
              {columns.map((column) => (
                <span
                  key={column.key}
                  role="columnheader"
                  className={cn(column.align === "end" && "text-right")}
                >
                  {column.header}
                </span>
              ))}
            </div>
          </div>
          <div role="rowgroup">
            {shown.map((row, index) => (
              <div
                key={rowKey(row)}
                id={rowId?.(row)}
                role="row"
                aria-rowindex={index + 2}
                data-active={isActive?.(row) || undefined}
                onClick={(event) => {
                  // Clicks on the row's own controls already did their job.
                  if ((event.target as HTMLElement).closest("a, button")) return;
                  onOpen?.(row);
                }}
                className={cn(
                  "grid scroll-mt-24 grid-cols-(--cols) items-start gap-x-4 border-t border-outline-variant px-5 py-2.5 transition-colors data-active:bg-sheet-alt max-[820px]:grid-cols-[minmax(0,1fr)_auto] max-[820px]:gap-y-1 max-[820px]:px-4 max-[820px]:py-3",
                  onOpen && "cursor-pointer hover:bg-sheet-alt",
                )}
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    role="cell"
                    className={cn(
                      "min-w-0",
                      column.align === "end" && "text-right",
                      cardClass(column.card),
                    )}
                  >
                    {column.cell(row)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {rows.length > pageSize && (
        <div className="border-t border-outline-variant px-5 max-[820px]:px-4">
          <button
            type="button"
            onClick={() => {
              setExpanded(!expanded);
            }}
            className="inline-flex min-h-11 cursor-pointer items-center text-label-l text-on-surface underline decoration-outline-variant underline-offset-4 hover:decoration-current"
          >
            {expanded ? "Ver menos" : moreLabel(rows.length)}
          </button>
        </div>
      )}
    </div>
  );
}
