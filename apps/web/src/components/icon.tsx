import { cn } from "cn";
import type { ComponentType, SVGProps } from "react";

/** A Material Symbols Rounded SVG, imported as `…/rounded/<name>.svg?react` (fill: `-fill`). */
export type Symbol = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Material Symbols Rounded, weight 400 (design-system.md §7.1): 24 px on the courier app,
 * 20 px in dense dispatch tables. Decorative unless `label` is given.
 */
export function Icon({
  symbol: SymbolSvg,
  size = 24,
  label,
  className,
}: {
  symbol: Symbol;
  size?: 20 | 24;
  label?: string;
  className?: string;
}) {
  return (
    <SymbolSvg
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      focusable="false"
      {...(label ? { role: "img", "aria-label": label, "aria-hidden": false } : {})}
    />
  );
}
