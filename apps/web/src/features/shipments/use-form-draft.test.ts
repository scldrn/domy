import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { shipmentCreateInput } from "@domy/domain";
import {
  emptyShipmentForm,
  shipmentDraftSnapshotMatchesRoute,
  shipmentDraftValues,
  shipmentDraftValuesSchema,
  toCreateInput,
  type ShipmentFormValues,
} from "./form-values";
import { persistFormDraft, readFormDraft, removeStoredFormDraft } from "./use-form-draft";

const valuesSchema = z.strictObject({ name: z.string(), count: z.number().nullable() });
const draftId = "a75b7a0a-1e5f-4b20-a76a-453d50d402b4";
const merchantId = "d839615c-4e9a-4238-9b81-7d2fdb2324cb";
const pickupPointId = "19edb80f-7c7b-4ec7-900e-6797f54a93bb";
const storedValues = { name: "Punto de entrega", count: null };

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

function storageWith(value: string | null) {
  const items = new Map<string, string>();
  if (value !== null) items.set("draft", value);
  return {
    items,
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    setItem: vi.fn((key: string, next: string) => items.set(key, next)),
    removeItem: vi.fn((key: string) => items.delete(key)),
  };
}

describe("form draft storage boundary", () => {
  it("keeps malformed JSON untouched for recovery", () => {
    const raw = "{not-json";
    const storage = storageWith(raw);
    const result = readFormDraft(storage, "draft", valuesSchema, () => ({ name: "", count: null }));

    expect(result).toEqual({ status: "invalid", raw, sourceKey: "draft" });
    expect(storage.items.get("draft")).toBe(raw);
  });

  it("rejects valid JSON with the wrong values shape without inventing a draft", () => {
    const raw = JSON.stringify({ id: draftId, values: {} });
    const emptyValues = vi.fn(() => ({ name: "", count: null }));
    const storage = storageWith(raw);
    const result = readFormDraft(storage, "draft", valuesSchema, emptyValues);

    expect(result).toEqual({ status: "invalid", raw, sourceKey: "draft" });
    expect(emptyValues).not.toHaveBeenCalled();
    expect(storage.items.get("draft")).toBe(raw);
  });

  it("restores the existing valid envelope shape", () => {
    const storage = storageWith(JSON.stringify({ id: draftId, values: storedValues }));

    expect(
      readFormDraft(storage, "draft", valuesSchema, () => ({ name: "", count: null })),
    ).toEqual({
      status: "ready",
      id: draftId,
      values: storedValues,
      stored: true,
      sourceRaw: JSON.stringify({ id: draftId, values: storedValues }),
      sourceKey: "draft",
    });
  });

  it("reads a legacy edit key only when the stable key has no record", () => {
    const legacyRaw = JSON.stringify({ id: draftId, values: storedValues });
    const storage = storageWith(null);
    storage.items.set("old-edit-key", legacyRaw);

    expect(
      readFormDraft(
        storage,
        "stable-edit-key",
        valuesSchema,
        () => ({ name: "", count: null }),
        "old-edit-key",
      ),
    ).toEqual({
      status: "ready",
      id: draftId,
      values: storedValues,
      stored: true,
      sourceRaw: legacyRaw,
      sourceKey: "old-edit-key",
    });
    expect(storage.getItem).toHaveBeenNthCalledWith(1, "stable-edit-key");
    expect(storage.getItem).toHaveBeenNthCalledWith(2, "old-edit-key");
  });

  it("keeps the source of invalid legacy data explicit for an informed discard", () => {
    const raw = "{invalid-old-edit";
    const storage = storageWith(null);
    storage.items.set("old-edit-key", raw);

    expect(
      readFormDraft(
        storage,
        "stable-edit-key",
        valuesSchema,
        () => ({ name: "", count: null }),
        "old-edit-key",
      ),
    ).toEqual({ status: "invalid", raw, sourceKey: "old-edit-key" });
  });

  it("rejects unexpected envelope and values fields rather than stripping them", () => {
    const extraEnvelopeField = storageWith(
      JSON.stringify({ id: draftId, values: storedValues, future: "unknown" }),
    );
    const extraValuesField = storageWith(
      JSON.stringify({ id: draftId, values: { ...storedValues, future: "unknown" } }),
    );

    expect(
      readFormDraft(extraEnvelopeField, "draft", valuesSchema, () => ({ name: "", count: null })),
    ).toMatchObject({ status: "invalid" });
    expect(
      readFormDraft(extraValuesField, "draft", valuesSchema, () => ({ name: "", count: null })),
    ).toMatchObject({ status: "invalid" });
    expect(extraEnvelopeField.items.get("draft")).toContain('"future":"unknown"');
    expect(extraValuesField.items.get("draft")).toContain('"future":"unknown"');
  });

  it("keeps a well-shaped snapshot raw when its identity does not match its values", () => {
    const raw = JSON.stringify({ id: draftId, values: storedValues });
    const storage = storageWith(raw);
    const result = readFormDraft(
      storage,
      "draft",
      valuesSchema,
      () => ({ name: "", count: null }),
      undefined,
      (snapshot) => snapshot.values.name !== "Punto de entrega",
    );

    expect(result).toEqual({ status: "invalid", raw, sourceKey: "draft" });
    expect(storage.items.get("draft")).toBe(raw);
  });

  it("does not expose a valid pending request bound to a different draft ID", () => {
    const otherId = "7e4d522d-f7cc-47b1-ae86-c8bc361f6b8a";
    const form = validErrandForm();
    const input = shipmentCreateInput.parse(toCreateInput(form, draftId, false));
    const values = shipmentDraftValues(form, {
      operation: "create",
      input,
    });
    const raw = JSON.stringify({ id: otherId, values });
    const storage = storageWith(raw);
    const result = readFormDraft(
      storage,
      "draft",
      shipmentDraftValuesSchema,
      () => shipmentDraftValues(emptyShipmentForm("2026-10-20")),
      undefined,
      (snapshot) => shipmentDraftSnapshotMatchesRoute(snapshot.id, snapshot.values, undefined),
    );

    expect(result).toEqual({ status: "invalid", raw, sourceKey: "draft" });
    expect(storage.items.get("draft")).toBe(raw);
  });

  it("fails closed when storage cannot be read instead of creating another identity", () => {
    const emptyValues = vi.fn(() => ({ name: "", count: null }));
    const storage = storageWith(null);
    storage.getItem.mockImplementation(() => {
      throw new Error("storage denied");
    });

    expect(readFormDraft(storage, "draft", valuesSchema, emptyValues)).toEqual({
      status: "unavailable",
    });
    expect(emptyValues).not.toHaveBeenCalled();
  });

  it("reports write and remove refusal without changing the stored identity", () => {
    const raw = JSON.stringify({ id: draftId, values: storedValues });
    const storage = storageWith(raw);
    storage.setItem.mockImplementation(() => {
      throw new Error("storage full");
    });
    storage.removeItem.mockImplementation(() => {
      throw new Error("storage denied");
    });

    expect(
      persistFormDraft(storage, "draft", { id: draftId, values: { name: "Nuevo", count: 2 } }),
    ).toBe(false);
    expect(removeStoredFormDraft(storage, "draft")).toBe(false);
    expect(storage.items.get("draft")).toBe(raw);
  });
});
