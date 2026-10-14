import { describe, expect, it } from "vitest";
import { routeCreateInput, routeReasonInput, stopOrderInput } from "../index.ts";

const actionId = "0194d9f0-0000-7000-8000-000000000001";

/** No English reaches a user (Constitution VII), even from inputs the screens never send. */
describe("route request messages", () => {
  it.each([
    ["an empty stop order", stopOrderInput, { actionId, version: 1, stopIds: [] }],
    [
      "a version that is not a number",
      routeReasonInput,
      { actionId, version: "1", reason: "Error" },
    ],
    [
      "a malformed identifier",
      routeCreateInput,
      { id: "x", actionId, serviceDate: "2026-10-01", shipmentIds: [] },
    ],
    ["a missing field", routeReasonInput, { actionId, version: 1 }],
  ])("explains %s in Spanish", (_, schema, input) => {
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
    for (const issue of result.error?.issues ?? []) {
      expect(issue.message).not.toMatch(/\b(expected|received|invalid|too small|too big)\b/i);
    }
  });

  it("caps the shipments of one request", () => {
    const shipmentIds = Array.from(
      { length: 201 },
      (_, index) => `0194d9f0-0000-7000-8000-${String(index).padStart(12, "0")}`,
    );
    const result = routeCreateInput.safeParse({
      id: actionId,
      actionId,
      serviceDate: "2026-10-01",
      shipmentIds,
    });
    expect(result.error?.issues[0]?.message).toBe("Elige máximo 200 envíos a la vez.");
  });
});
