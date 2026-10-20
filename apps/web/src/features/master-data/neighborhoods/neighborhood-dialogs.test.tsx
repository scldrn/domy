import { describe, expect, it } from "vitest";
import { NeighborhoodEditState } from "./neighborhood-dialogs";

describe("Neighborhood edit waits for authoritative detail (Finding IV-21, 001/T145)", () => {
  it("blocks saving while authoritative detail query is pending", () => {
    const state = new NeighborhoodEditState("Estadio");
    expect(state.getStatus()).toBe("pending");
    expect(state.isSaveAllowed()).toBe(false);

    // Editing only the name while pending still does not allow saving uninitialized variants
    state.setName("Estadio Deportivo");
    expect(state.isSaveAllowed()).toBe(false);
    expect(() => state.getEffectiveVariants()).toThrow(
      "Cannot save while detail is uninitialized or failed",
    );
  });

  it("blocks saving and enables retry when detail query fails, preventing destructive partial PATCH", () => {
    const state = new NeighborhoodEditState("Laureles");
    state.failDetail();
    expect(state.getStatus()).toBe("error");
    expect(state.isSaveAllowed()).toBe(false);

    state.retryDetail();
    expect(state.getStatus()).toBe("pending");
    expect(state.isSaveAllowed()).toBe(false);
  });

  it("preserves every existing variant when user performs a name-only edit after detail resolution", () => {
    const state = new NeighborhoodEditState("Florida Nueva");
    const existingVariants = ["florida", "nueva florida", "la 70"];

    // Authoritative detail resolves
    state.resolveDetail(existingVariants);
    expect(state.getStatus()).toBe("resolved");
    expect(state.isSaveAllowed()).toBe(true);
    expect(state.getVariantsText()).toBe("florida, nueva florida, la 70");

    // User edits only name
    state.setName("Florida Nueva Sector 1");

    // All existing variants are preserved
    expect(state.getEffectiveVariants()).toEqual(existingVariants);
  });

  it("allows intentional editing and explicit clearing of variants once resolved", () => {
    const state = new NeighborhoodEditState("San Joaquín");
    state.resolveDetail(["joaquin", "san joaquin"]);

    // User edits variants intentionally
    state.setVariants("san joaquin nuevo");
    expect(state.getEffectiveVariants()).toEqual(["san joaquin nuevo"]);

    // User clears variants intentionally
    state.setVariants("");
    expect(state.getEffectiveVariants()).toEqual([]);
  });
});
