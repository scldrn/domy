import { getRouteApi } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";

const panelRoute = getRouteApi("/_panel");

/** Owner-only CSV export of a master data set (FR-025). */
export function ExportButton({
  dataset,
}: {
  dataset:
    | "merchants"
    | "couriers"
    | "carriers"
    | "neighborhoods"
    | "rate-card"
    | "courier-records"
    | "routes"
    | "handovers";
}) {
  const { user } = panelRoute.useRouteContext();
  if (user.role !== "owner") return null;
  return (
    <a
      className={buttonVariants({ variant: "outline" })}
      href={`/api/export/${dataset}?format=csv`}
      download
    >
      Exportar CSV
    </a>
  );
}
