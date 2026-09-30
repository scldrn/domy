import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/** M3 filter chip: outlined when off, secondary container with a check when on. */
const toggleVariants = cva(
  "state-layer inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm text-label-l whitespace-nowrap text-on-surface-variant transition-colors outline-none disabled:pointer-events-none disabled:opacity-38 data-pressed:border-transparent data-pressed:bg-secondary-container data-pressed:text-on-secondary-container [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "border border-outline",
        outline: "border border-outline",
      },
      size: {
        default: "h-12 min-w-12 px-4",
        sm: "h-12 min-w-12 px-3",
        lg: "h-14 min-w-14 px-5",
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
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
