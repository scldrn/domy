import { randomBytes } from "node:crypto";

/** Creates a 128-bit public bearer code (004/R13). */
export function generateSecretCode(): string {
  return randomBytes(16).toString("base64url");
}
