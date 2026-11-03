import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/cn";

/** Outlined text field (M3): 48 px high on a sheet; the outline turns accent-strong and 2 px on focus. */
const textFieldClasses =
  "w-full min-w-0 rounded-sm border border-outline bg-sheet px-4 text-body-l text-on-surface transition-[border-color,box-shadow] outline-none placeholder:text-on-surface-variant hover:border-on-surface focus-visible:border-accent-strong focus-visible:shadow-[inset_0_0_0_1px_var(--color-accent-strong)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-38 aria-invalid:border-error aria-invalid:focus-visible:shadow-[inset_0_0_0_1px_var(--color-error)]";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(textFieldClasses, "h-12", className)}
      {...props}
    />
  );
}

export { Input, textFieldClasses };
