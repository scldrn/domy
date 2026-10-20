import { describe, expect, it } from "vitest";
import { NeighborhoodCreationLifecycle } from "./neighborhood-combobox";

describe("Neighborhood creation identity lifecycle (Finding IV-22, 001/T143)", () => {
  it("generates a fresh UUID for the second creation when multiple neighborhoods are created without remounting", () => {
    const lifecycle = new NeighborhoodCreationLifecycle();
    const firstId = lifecycle.getId();
    expect(firstId).toBeDefined();

    // First neighborhood created successfully
    const secondId = lifecycle.onSuccess();
    expect(secondId).toBeDefined();
    expect(secondId).not.toBe(firstId);
    expect(lifecycle.getId()).toBe(secondId);

    // Second neighborhood created successfully
    const thirdId = lifecycle.onSuccess();
    expect(thirdId).toBeDefined();
    expect(thirdId).not.toBe(secondId);
    expect(thirdId).not.toBe(firstId);
  });

  it("retains the exact identity when mutation outcome is uncertain or fails, ensuring idempotent retry", () => {
    const lifecycle = new NeighborhoodCreationLifecycle();
    const initialId = lifecycle.getId();

    // Submission attempt 1 fails or network dropped
    const retryId1 = lifecycle.onError();
    expect(retryId1).toBe(initialId);
    expect(lifecycle.getId()).toBe(initialId);

    // Submission attempt 2 fails again
    const retryId2 = lifecycle.onError();
    expect(retryId2).toBe(initialId);
    expect(lifecycle.getId()).toBe(initialId);

    // Finally succeeds: only now is identity rotated
    const freshId = lifecycle.onSuccess();
    expect(freshId).not.toBe(initialId);
  });

  it("resets identity upon cancellation or closing the dialog", () => {
    const lifecycle = new NeighborhoodCreationLifecycle();
    const initialId = lifecycle.getId();

    const newId = lifecycle.onCancel();
    expect(newId).not.toBe(initialId);
    expect(lifecycle.getId()).toBe(newId);
  });
});
