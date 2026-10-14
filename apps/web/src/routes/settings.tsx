import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

/**
 * "Configuración": the office address (feature 003, FR-041), reached from the navigation once
 * its form lands (tasks.md T059).
 */
export const Route = createFileRoute("/_panel/configuracion")({
  head: () => ({ meta: [{ title: "Configuración · Domy" }] }),
  component: Settings,
});

function Settings() {
  return <PageHeader title="Configuración" />;
}
