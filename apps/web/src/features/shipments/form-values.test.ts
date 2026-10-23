import { shipmentCreateInput, shipmentUpdateInput } from "@domy/domain";
import { describe, expect, it } from "vitest";
import {
  emptyShipmentForm,
  shipmentDraftSnapshotMatchesRoute,
  shipmentDraftValues,
  shipmentDraftValuesSchema,
  shipmentFormValuesSchema,
  toCreateInput,
  toUpdateInput,
  type ShipmentFormValues,
} from "./form-values";

const draftId = "a75b7a0a-1e5f-4b20-a76a-453d50d402b4";
const shipmentId = "7e4d522d-f7cc-47b1-ae86-c8bc361f6b8a";
const merchantId = "d839615c-4e9a-4238-9b81-7d2fdb2324cb";
const pickupPointId = "19edb80f-7c7b-4ec7-900e-6797f54a93bb";

function validErrandForm(): ShipmentFormValues {
  return {
    ...emptyShipmentForm("2026-10-20"),
    kind: "errand",
    merchant: { id: merchantId, name: "Amy Tecnology", aliases: [] },
    pickupPointId,
    errandDescription: "Recoger un documento",
    paymentMode: "merchant_account",
    fee: 85000,
  };
}

describe("shipment form draft values", () => {
  it("accepts an incomplete form as a draft without final request validation", () => {
    expect(shipmentFormValuesSchema.safeParse(emptyShipmentForm("2026-10-20")).success).toBe(true);
  });

  it("restores historical selected options with full API fields and view-model ids", () => {
    const values = {
      ...emptyShipmentForm("2026-10-20"),
      merchant: {
        id: "a75b7a0a-1e5f-4b20-a76a-453d50d402b4",
        name: "Amy Tecnology",
        aliases: ["Amy"],
        whatsappPhone: "3001234567",
        isActive: true,
        futureServerField: { retained: true },
      },
      recipientNeighborhood: {
        id: "7e4d522d-f7cc-47b1-ae86-c8bc361f6b8a",
        name: "Laureles",
        kind: "neighborhood",
        needsReview: false,
        municipality: { id: "", name: "Medellín", sourceCode: "legacy" },
        rateZone: { id: "", name: "" },
        isActive: true,
        similarity: 1,
        futureServerField: "kept",
      },
    };

    const parsed = shipmentFormValuesSchema.parse(values);

    expect(parsed.merchant).toMatchObject({ whatsappPhone: "3001234567", isActive: true });
    expect(parsed.merchant?.futureServerField).toEqual({ retained: true });
    expect(parsed.recipientNeighborhood?.municipality.id).toBe("");
    expect(parsed.recipientNeighborhood?.rateZone.id).toBe("");
    expect(parsed.recipientNeighborhood?.futureServerField).toBe("kept");
  });

  it("rejects unknown form fields rather than stripping an unrecognized draft shape", () => {
    const values = { ...emptyShipmentForm("2026-10-20"), futureField: "unknown" };

    expect(shipmentFormValuesSchema.safeParse(values).success).toBe(false);
  });

  it("restores a valid legacy values object but marks its mutation outcome uncertain", () => {
    const legacy = emptyShipmentForm("2026-10-20");

    expect(shipmentDraftValuesSchema.parse(legacy)).toEqual({
      form: legacy,
      pending: null,
      needsIntentAcknowledgement: true,
      baseVersion: null,
    });
  });

  it("restores a legacy edit merchant and synthetic neighborhood view model", () => {
    const legacy = {
      ...emptyShipmentForm("2026-10-20"),
      merchant: {
        id: "a75b7a0a-1e5f-4b20-a76a-453d50d402b4",
        name: "Amy Tecnology",
      },
      recipientNeighborhood: {
        id: "7e4d522d-f7cc-47b1-ae86-c8bc361f6b8a",
        name: "Laureles",
        kind: "neighborhood",
        needsReview: false,
        municipality: { id: "", name: "Medellín" },
        rateZone: { id: "", name: "" },
      },
    };

    const restored = shipmentDraftValuesSchema.parse(legacy);

    expect(restored.needsIntentAcknowledgement).toBe(true);
    expect(restored.form.merchant).toEqual({ ...legacy.merchant, aliases: [] });
    expect(restored.form.recipientNeighborhood?.municipality.id).toBe("");
    expect(restored.form.recipientNeighborhood?.rateZone.id).toBe("");
  });

  it("accepts and preserves an exact pending create request", () => {
    const values = {
      form: emptyShipmentForm("2026-10-20"),
      pending: {
        operation: "create",
        input: {
          id: "a75b7a0a-1e5f-4b20-a76a-453d50d402b4",
          merchantId: "7e4d522d-f7cc-47b1-ae86-c8bc361f6b8a",
          pickupPointId: "a75b7a0a-1e5f-4b20-a76a-453d50d402b4",
          kind: "errand",
          errandDescription: "Recoger un documento",
          serviceDate: "2026-10-20",
          serviceLevel: "standard",
          fee: 85000,
          paymentMode: "cash_on_delivery",
          confirmed: false,
        },
      },
      needsIntentAcknowledgement: false,
      baseVersion: null,
    };

    expect(shipmentDraftValuesSchema.parse(values)).toEqual(values);
  });

  it("rejects a pending request with fields that domain parsing would strip", () => {
    const values = {
      form: emptyShipmentForm("2026-10-20"),
      pending: {
        operation: "create",
        input: {
          id: "a75b7a0a-1e5f-4b20-a76a-453d50d402b4",
          merchantId: "7e4d522d-f7cc-47b1-ae86-c8bc361f6b8a",
          pickupPointId: "a75b7a0a-1e5f-4b20-a76a-453d50d402b4",
          kind: "errand",
          errandDescription: "Recoger un documento",
          serviceDate: "2026-10-20",
          serviceLevel: "standard",
          fee: 85000,
          paymentMode: "cash_on_delivery",
          confirmed: false,
          futureField: "must-not-be-dropped",
        },
      },
      needsIntentAcknowledgement: false,
      baseVersion: null,
    };

    expect(shipmentDraftValuesSchema.safeParse(values).success).toBe(false);
  });

  it("requires a pending edit request to retain its original version", () => {
    const values = {
      form: emptyShipmentForm("2026-10-20"),
      pending: {
        operation: "update",
        shipmentId: "a75b7a0a-1e5f-4b20-a76a-453d50d402b4",
        input: {
          actionId: "7e4d522d-f7cc-47b1-ae86-c8bc361f6b8a",
          version: 4,
          merchantReference: "Cambio solicitado",
        },
      },
      needsIntentAcknowledgement: false,
      baseVersion: 3,
    };

    expect(shipmentDraftValuesSchema.safeParse(values).success).toBe(false);
    expect(shipmentDraftValuesSchema.safeParse({ ...values, baseVersion: 4 }).success).toBe(true);
  });

  it("binds pending create and edit identities to their draft and route", () => {
    const form = validErrandForm();
    const createInput = shipmentCreateInput.parse(toCreateInput(form, draftId, false));
    const createValues = shipmentDraftValues(form, {
      operation: "create",
      input: createInput,
    });
    const editCreateInput = shipmentCreateInput.parse(toCreateInput(form, shipmentId, false));
    const editInput = shipmentUpdateInput.parse(
      toUpdateInput(editCreateInput, form, { version: 3 }, draftId),
    );
    const editValues = shipmentDraftValues(
      form,
      {
        operation: "update",
        shipmentId,
        input: editInput,
      },
      false,
      3,
    );

    expect(shipmentDraftSnapshotMatchesRoute(draftId, createValues, undefined)).toBe(true);
    expect(shipmentDraftSnapshotMatchesRoute(shipmentId, createValues, undefined)).toBe(false);
    expect(
      shipmentDraftSnapshotMatchesRoute(draftId, createValues, { id: shipmentId, version: 3 }),
    ).toBe(false);
    expect(
      shipmentDraftSnapshotMatchesRoute(draftId, editValues, { id: shipmentId, version: 3 }),
    ).toBe(true);
    expect(
      shipmentDraftSnapshotMatchesRoute(draftId, editValues, { id: shipmentId, version: 4 }),
    ).toBe(true);
    expect(
      shipmentDraftSnapshotMatchesRoute("f17d7974-0427-4c96-8b36-b0a948232c3c", editValues, {
        id: shipmentId,
        version: 3,
      }),
    ).toBe(false);
  });

  it("does not retry a valid pending payload when visible form values diverge", () => {
    const form = validErrandForm();
    const input = shipmentCreateInput.parse(toCreateInput(form, draftId, false));
    const pendingValues = shipmentDraftValues(form, { operation: "create", input });
    const changedForm = { ...form, errandDescription: "Otra solicitud" };
    const mismatchedValues = shipmentDraftValues(changedForm, pendingValues.pending);

    expect(shipmentDraftValuesSchema.safeParse(mismatchedValues).success).toBe(true);
    expect(shipmentDraftSnapshotMatchesRoute(draftId, pendingValues, undefined)).toBe(true);
    expect(shipmentDraftSnapshotMatchesRoute(draftId, mismatchedValues, undefined)).toBe(false);
  });
});
