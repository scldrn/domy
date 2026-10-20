import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryErrorAlert, TableSkeleton } from "@/components/query-state";

describe("Directory honest query states (Finding IV-34, 001/T144)", () => {
  it("renders a loading skeleton with accessible aria-busy and Spanish status label", () => {
    const html = renderToStaticMarkup(
      <TableSkeleton rows={3} columns={4} label="Cargando clientes…" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Cargando clientes…");
    expect(html).toContain("animate-pulse");
  });

  it("renders an error alert with actionable Spanish retry button", () => {
    const onRetry = vi.fn();
    const html = renderToStaticMarkup(
      <QueryErrorAlert
        title="No pudimos cargar los clientes"
        message="Fallo de red"
        onRetry={onRetry}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("No pudimos cargar los clientes");
    expect(html).toContain("Fallo de red");
    expect(html).toContain("Reintentar");
  });
});
