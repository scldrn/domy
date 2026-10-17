import { describe, expect, it } from "vitest";
import { emptyRecordValues, recordValuesFor } from "./record-on-behalf-dialog";

describe("record form serialization (T125, FR-035)", () => {
  it("keeps blank required values for validation, omitting only an optional empty note", () => {
    expect(recordValuesFor(["receivedByName", "payee", "note"], emptyRecordValues)).toEqual({
      receivedByName: "",
      payee: "",
    });
  });
  it("does not submit fields inapplicable to the selected kind, including an errand's name", () => {
    expect(
      recordValuesFor(["cashAmount"], {
        ...emptyRecordValues,
        receivedByName: "Old recipient",
        cashAmount: 0,
      }),
    ).toEqual({ cashAmount: 0 });
  });
  it("does not omit the required note of a pickup problem", () => {
    expect(recordValuesFor(["note"], emptyRecordValues, true)).toEqual({ note: "" });
  });
});
