import { describe, expect, it } from "vitest";
import { shipmentCreateInput } from "./shipment.ts";

const uuid = (n: number) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;

const delivery = {
  id: uuid(1),
  kind: "delivery",
  merchantId: uuid(2),
  pickupPointId: uuid(3),
  recipientName: "Laura Gómez",
  recipientPhone: "3001234567",
  recipientAddress: "Calle 10 # 43-12",
  recipientNeighborhoodId: uuid(4),
  paymentMode: "merchant_account",
  fee: 13000,
};

const issues = (input: unknown) =>
  shipmentCreateInput.safeParse(input).error?.issues.map((issue) => issue.path.join(".")) ?? [];

describe("shipmentCreateInput", () => {
  it("accepts a complete delivery", () => {
    expect(shipmentCreateInput.safeParse(delivery).success).toBe(true);
  });

  it("requires a client-generated UUID", () => {
    expect(issues({ ...delivery, id: undefined })).toContain("id");
    expect(issues({ ...delivery, id: "123" })).toContain("id");
  });

  it("requires the recipient fields for deliveries and reverse pickups", () => {
    for (const kind of ["delivery", "reverse_pickup"]) {
      const result = issues({
        ...delivery,
        kind,
        recipientName: undefined,
        recipientAddress: undefined,
      });
      expect(result).toEqual(expect.arrayContaining(["recipientName", "recipientAddress"]));
    }
  });

  it("requires handoff place, carrier, and destination town for carrier handoffs", () => {
    const result = issues({
      ...delivery,
      kind: "carrier_handoff",
      recipientNeighborhoodId: undefined,
    });
    expect(result).toEqual(
      expect.arrayContaining(["recipientNeighborhoodId", "carrierId", "destinationTown"]),
    );
  });

  it("requires a description for errands", () => {
    expect(issues({ ...delivery, kind: "errand" })).toContain("errandDescription");
  });

  it("requires a 10-digit phone", () => {
    expect(issues({ ...delivery, recipientPhone: "300123456" })).toContain("recipientPhone");
    expect(issues({ ...delivery, recipientPhone: "300 123 4567" })).toContain("recipientPhone");
  });

  it("requires reasons of 5 to 200 characters", () => {
    expect(issues({ ...delivery, feeOverrideReason: "ok" })).toContain("feeOverrideReason");
    expect(issues({ ...delivery, feeOverrideReason: "x".repeat(201) })).toContain(
      "feeOverrideReason",
    );
    expect(issues({ ...delivery, feeOverrideReason: "Precio acordado" })).toEqual([]);
  });

  it("requires a fee greater than zero in whole pesos", () => {
    expect(issues({ ...delivery, fee: 0 })).toContain("fee");
    expect(issues({ ...delivery, fee: 12.5 })).toContain("fee");
  });

  it("requires a package count of at least 1", () => {
    expect(issues({ ...delivery, packageCount: 0 })).toContain("packageCount");
    expect(issues({ ...delivery, packageCount: 2 })).toEqual([]);
  });

  it("requires a pickup point or a one-off pickup address with its neighborhood", () => {
    expect(issues({ ...delivery, pickupPointId: null })).toEqual(
      expect.arrayContaining(["pickupAddress"]),
    );
    expect(
      issues({
        ...delivery,
        pickupPointId: null,
        pickupAddress: "Cra 50 # 10-20",
        pickupNeighborhoodId: uuid(5),
      }),
    ).toEqual([]);
  });
});
