import { describe, expect, it } from "vitest";
import { reasonError } from "./reason-field";

/** Reassigning, undoing a dispatch, and cancelling state why in 5 to 200 characters (FR-016). */
describe("reasonError", () => {
  it.each([
    ["", "Escribe un motivo de al menos 5 caracteres."],
    ["  no ", "Escribe un motivo de al menos 5 caracteres."],
    ["x".repeat(201), "El motivo no puede pasar de 200 caracteres."],
  ])("refuses %j", (reason, message) => {
    expect(reasonError(reason)).toBe(message);
  });

  it.each(["Error", "La moto de Ana se varó", "x".repeat(200)])("accepts %j", (reason) => {
    expect(reasonError(reason)).toBeUndefined();
  });
});
