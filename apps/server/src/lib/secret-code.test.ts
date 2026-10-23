import { describe, expect, it } from "vitest";
import { generateSecretCode } from "./secret-code.ts";

describe("generateSecretCode (004/R13)", () => {
  it("encodes exactly 128 bits as canonical unpadded base64url", () => {
    const code = generateSecretCode();
    const bytes = Buffer.from(code, "base64url");

    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(bytes).toHaveLength(16);
    expect(bytes.toString("base64url")).toBe(code);
  });
});
