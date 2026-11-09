import { cn } from "@/lib/cn";

/**
 * Whether a record is in use (feature 006, US5), drawn like the state marks: a dot and the
 * label, green when active and a hollow outline when not. `feminine` names an account.
 */
export function ActiveMark({
  active,
  feminine = false,
  className,
}: {
  active: boolean;
  feminine?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-label-l font-semibold whitespace-nowrap before:size-2.5 before:shrink-0 before:rounded-full before:content-['']",
        active
          ? "text-success before:bg-success"
          : "text-on-surface-variant before:bg-transparent before:ring-2 before:ring-outline before:ring-inset",
        className,
      )}
    >
      {active ? (feminine ? "Activa" : "Activo") : feminine ? "Inactiva" : "Inactivo"}
    </span>
  );
}
