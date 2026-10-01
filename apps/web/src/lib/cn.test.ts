import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps a text color next to a type scale size", () => {
    expect(cn("bg-primary text-on-primary", "text-title-m")).toBe(
      "bg-primary text-on-primary text-title-m",
    );
  });

  it("still resolves conflicts within each group", () => {
    expect(cn("text-body-m", "text-title-m")).toBe("text-title-m");
    expect(cn("text-primary", "text-error")).toBe("text-error");
  });
});
