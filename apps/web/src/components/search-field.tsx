import SearchIcon from "@material-symbols/svg-400/rounded/search.svg?react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";

/** An outlined text field with a leading search icon, for filtering a list in place. */
export function SearchField({ className, ...props }: ComponentProps<"input">) {
  return (
    <InputGroup className={cn("max-w-sm", className)}>
      <InputGroupAddon className="pl-3 text-on-surface-variant">
        <Icon symbol={SearchIcon} />
      </InputGroupAddon>
      <InputGroupInput type="search" className="pl-1 focus-visible:pl-1" {...props} />
    </InputGroup>
  );
}
