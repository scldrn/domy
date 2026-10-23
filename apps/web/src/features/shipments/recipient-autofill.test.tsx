import type { UseFormSetValue } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { RecipientOption } from "./api";
import type { ShipmentFormValues } from "./form-values";
import { applyRecipientAutofill } from "./recipient-autocomplete";

describe("Authoritative recipient autofill (Finding IV-23, 001/T149)", () => {
  const laureles: RecipientOption["recipientNeighborhood"] = {
    id: "n-laureles",
    name: "Laureles",
    kind: "neighborhood",
    needsReview: false,
    isActive: true,
    municipality: { id: "m-medellin", name: "Medellín" },
    rateZone: { id: "z-urbana", name: "Urbana" },
  };

  const createMockSetValue = (store: Record<string, unknown>) =>
    ((name: string, value: unknown) => {
      store[name] = value;
    }) as unknown as UseFormSetValue<ShipmentFormValues>;

  it("populates recipient name, phone, address and authoritative active neighborhood together", () => {
    const fields: Record<string, unknown> = {};
    const setFieldValue = createMockSetValue(fields);

    const recipient: Parameters<typeof applyRecipientAutofill>[0] = {
      recipientName: "Carlos Pérez",
      recipientPhone: "3001234567",
      recipientAddress: "Circular 4 # 73-12",
      recipientNeighborhood: laureles,
    };

    applyRecipientAutofill(recipient, setFieldValue);

    expect(fields["recipientName"]).toBe("Carlos Pérez");
    expect(fields["recipientPhone"]).toBe("3001234567");
    expect(fields["recipientAddress"]).toBe("Circular 4 # 73-12");
    expect(fields["recipientNeighborhood"]).toEqual(laureles);
  });

  it("honestly clears neighborhood to null when past neighborhood is inactive, never guessing a replacement", () => {
    const fields: Record<string, unknown> = {
      recipientNeighborhood: laureles,
    };
    const setFieldValue = createMockSetValue(fields);

    const inactiveNeighborhood: RecipientOption["recipientNeighborhood"] = {
      ...laureles,
      id: "n-old",
      name: "Antiguo Sector Inactivo",
      isActive: false,
    };

    const recipient: Parameters<typeof applyRecipientAutofill>[0] = {
      recipientName: "María López",
      recipientPhone: "3109876543",
      recipientAddress: "Calle 10 # 20-30",
      recipientNeighborhood: inactiveNeighborhood,
    };

    applyRecipientAutofill(recipient, setFieldValue);

    expect(fields["recipientName"]).toBe("María López");
    expect(fields["recipientPhone"]).toBe("3109876543");
    expect(fields["recipientAddress"]).toBe("Calle 10 # 20-30");
    // Must be null so required field validation enforces explicit dispatcher selection of an active neighborhood
    expect(fields["recipientNeighborhood"]).toBeNull();
  });

  it("clears neighborhood to null when past neighborhood is missing", () => {
    const fields: Record<string, unknown> = {};
    const setFieldValue = createMockSetValue(fields);

    const recipient: Parameters<typeof applyRecipientAutofill>[0] = {
      recipientName: "Pedro Gómez",
      recipientPhone: "3201112233",
      recipientAddress: "Carrera 43A # 1-50",
      recipientNeighborhood: null,
    };

    applyRecipientAutofill(recipient, setFieldValue);

    expect(fields["recipientNeighborhood"]).toBeNull();
  });
});
