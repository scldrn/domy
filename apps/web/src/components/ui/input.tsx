import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

/** M3 outlined text field: 56 px high, outline turns primary and 2 px thick on focus. */
const textFieldClasses =
  "w-full min-w-0 rounded-xs border border-outline bg-transparent px-4 text-body-l text-on-surface transition-colors outline-none placeholder:text-on-surface-variant hover:border-on-surface focus-visible:border-2 focus-visible:border-primary focus-visible:px-[15px] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-38 aria-invalid:border-error aria-invalid:focus-visible:border-error";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(textFieldClasses, "h-14", className)}
      {...props}
    />
  );
}

export { Input, textFieldClasses };
