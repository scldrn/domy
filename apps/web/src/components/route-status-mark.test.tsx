import { routeStatuses } from "@domy/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouteStatusMark } from "./route-status-mark";

/** A route reads like its shipments (design-system.md §3.3): label and the state's role. */
describe("RouteStatusMark", () => {
  it.each([
    ["draft", "En preparación", "text-tertiary"],
    ["in_progress", "En curso", "text-info"],
    ["finished", "Finalizada", "text-success"],
    ["cancelled", "Cancelada", "text-on-surface-variant"],
  ] as const)("shows %s as «%s» in %s", (status, label, role) => {
    const html = renderToStaticMarkup(<RouteStatusMark status={status} />);
    expect(html).toContain(`>${label}<`);
    expect(html).toContain(role);
  });

  it("covers every route status", () => {
    expect(routeStatuses).toEqual(["draft", "in_progress", "finished", "cancelled"]);
  });
});
