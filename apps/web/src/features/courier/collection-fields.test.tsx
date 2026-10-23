import { formatCop, paymentMethodLabels } from "@domy/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CollectionFields, proposedCollection } from "./collection-fields";

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("collection fields (FR-010, FR-011)", () => {
  it("proposes the full COD amount in cash and zero in both transfer methods", () => {
    expect(proposedCollection(85_000)).toEqual({
      cashAmount: 85_000,
      companyTransferAmount: 0,
      merchantTransferAmount: 0,
    });
    expect(proposedCollection(0)).toEqual({
      cashAmount: 0,
      companyTransferAmount: 0,
      merchantTransferAmount: 0,
    });
  });

  it("renders each payment method and explains when the collected split differs", () => {
    const html = renderToStaticMarkup(
      <CollectionFields
        codAmount={85_000}
        value={{ cashAmount: 80_000, companyTransferAmount: 4_000, merchantTransferAmount: 0 }}
        onChange={() => {}}
      />,
    );
    const rendered = text(html);

    expect(html).toContain('aria-live="polite"');
    expect(rendered).toContain(paymentMethodLabels.cash);
    expect(rendered).toContain(paymentMethodLabels.companyTransfer);
    expect(rendered).toContain(paymentMethodLabels.merchantTransfer);
    expect(rendered).toContain(`Total cobrado: ${formatCop(84_000)}`);
    expect(rendered).toContain(`distinto de ${formatCop(85_000)}`);
  });
});
