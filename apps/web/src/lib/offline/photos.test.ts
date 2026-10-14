import { describe, expect, it } from "vitest";
import { scaledSize } from "./photos";

/** Photos reduced on the phone (feature 003, research R6, FR-009). */
describe("scaledSize", () => {
  it("brings the longest side down to 1600 px, keeping the proportions", () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it("leaves a small photo as it is", () => {
    expect(scaledSize(1200, 900)).toEqual({ width: 1200, height: 900 });
  });
});
