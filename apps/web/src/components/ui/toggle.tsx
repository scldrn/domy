import CheckIcon from "@material-symbols/svg-400/rounded/check.svg?react";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * M3 filter chip: 32 px high (48 px touch target), outlined when off, secondary container
 * with a leading check when on.
 */
const toggleVariants = cva(
  "state-layer inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm text-label-l whitespace-nowrap text-on-surface-variant transition-colors outline-none before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] disabled:pointer-events-none disabled:opacity-38 data-pressed:border-transparent data-pressed:bg-secondary-container data-pressed:text-on-secondary-container [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.125rem]",
  {
    variants: {
      variant: {
        default: "border border-outline-variant",
        outline: "border border-outline-variant",
      },
      size: {
        default: "h-8 px-4 data-pressed:pl-2",
        sm: "h-8 px-3 data-pressed:pl-2",
        lg: "h-10 px-4 data-pressed:pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    >
      <CheckIcon className="hidden in-data-pressed:block" />
      {children}
    </TogglePrimitive>
  );
}

export { Toggle, toggleVariants };
