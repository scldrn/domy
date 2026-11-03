import type { ReactNode } from "react";
import { FieldLegend, FieldSet } from "@/components/ui/field";

/** The step number before a section's title (approved "Nuevo envío" and "Registro masivo"). */
export function SectionNumber({ number }: { number: number }) {
  return (
    <span
      aria-hidden="true"
      className="mr-2.5 inline-grid size-6 place-items-center rounded-[7px] bg-surface-container-high align-[2px] text-label-m font-bold text-on-surface"
    >
      {number}
    </span>
  );
}

/** A numbered section of a form on a sheet; the legend names the group. */
export function FormSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <FieldSet className="min-w-0 gap-0 rounded-lg border border-outline-variant bg-sheet px-5 pt-4 pb-5 max-[820px]:px-4 [&>legend]:float-left [&>legend]:mb-3.5 [&>legend]:w-full [&>legend+*]:clear-both">
      <FieldLegend className="text-title-l text-on-surface">
        <SectionNumber number={number} />
        {title}
      </FieldLegend>
      {children}
    </FieldSet>
  );
}
