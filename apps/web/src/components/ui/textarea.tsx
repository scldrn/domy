import * as React from "react";
import { cn } from "@/lib/cn";
import { textFieldClasses } from "./input";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textFieldClasses, "field-sizing-content min-h-24 py-3", className)}
      {...props}
    />
  );
}

export { Textarea };
