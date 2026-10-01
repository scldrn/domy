import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * M3 buttons: filled (the one primary action), tonal, outlined, and text; plus error and
 * icon buttons. Every button is at least 48 × 48 px (Constitution VII).
 */
const buttonVariants = cva(
  "state-layer inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full whitespace-nowrap text-label-l transition-[background-color,box-shadow] duration-(--duration-short) ease-(--ease-standard) outline-none select-none disabled:pointer-events-none disabled:opacity-38 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary",
        secondary: "bg-secondary-container text-on-secondary-container",
        outline: "border border-outline text-primary",
        ghost: "text-primary",
        destructive: "bg-error text-on-error",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6 has-[svg]:pl-4",
        sm: "h-12 px-4",
        lg: "h-14 px-8 text-title-m",
        icon: "size-12 [&_svg:not([class*='size-'])]:size-6",
        "icon-sm": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
