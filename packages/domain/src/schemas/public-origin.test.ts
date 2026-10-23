import { describe, expect, it } from "vitest";
import { publicOriginSchema } from "./public-origin.ts";

describe("publicOriginSchema", () => {
  it.each([
    ["http://localhost:5173", "http://localhost:5173"],
    ["https://EXAMPLE.com:443/", "https://example.com"],
    ["http://[::1]:80/", "http://[::1]"],
  ])("normalizes %s", (input, expected) => {
    expect(publicOriginSchema.parse(input)).toBe(expected);
  });

  it.each([
    "ftp://example.com",
    "https://@example.com",
    "https://user:secret@example.com",
    "https://example.com/path",
    "https://example.com/a/..",
    "https://example.com//",
    "https://example.com?query",
    "https://example.com#fragment",
    "https://example.com?",
    "https://example.com#",
    "https:\\\\example.com",
    " https://example.com",
    "https://example.com ",
    "https://example .com",
    "https://example.com:invalid",
    "https://example.com\u0000",
    "//example.com",
  ])("rejects non-origin input %s", (input) => {
    const result = publicOriginSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success && input.includes("secret")) {
      expect(result.error.message).not.toContain("secret");
    }
  });
});
