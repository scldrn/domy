/** Dates and times as users read them: `es-CO`, in America/Bogota (design-system.md §9). */
export { formatCop } from "@domy/domain";

const timeZone = "America/Bogota";
const dateParts = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone,
});
const timeFormat = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone,
});

/** "30 sep 2026". Accepts an instant or a calendar day (YYYY-MM-DD). */
export function formatDate(value: Date | string): string {
  const instant =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00-05:00`)
      : new Date(value);
  const parts = Object.fromEntries(
    dateParts.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const month = (parts["month"] ?? "").replace(".", "").slice(0, 3);
  return `${parts["day"] ?? ""} ${month} ${parts["year"] ?? ""}`;
}

/** "2:30 p. m." */
export function formatTime(value: Date | string): string {
  return timeFormat.format(new Date(value));
}

/** "30 sep 2026, 2:30 p. m." */
export function formatDateTime(value: Date | string): string {
  return `${formatDate(new Date(value))}, ${formatTime(value)}`;
}
