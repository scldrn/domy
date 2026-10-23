import { describe, expect, it } from "vitest";
import {
  isPublicApiPath,
  isPublicDocumentPath,
  isPublicResponsePath,
  publicPathForLog,
} from "./public-path.ts";

describe("public request paths (R14)", () => {
  it("never retains unmatched request paths in logs (OP-01)", () => {
    expect(publicPathForLog("/missing/private-marker")).toBe(":unmatched");
  });
  it("recognizes public API and web document boundaries through encoded path segments", () => {
    expect(isPublicApiPath("/%61pi/%70ublic/tracking/code")).toBe(true);
    expect(isPublicDocumentPath("/seguimiento/code")).toBe(true);
    expect(isPublicDocumentPath("/cliente/code")).toBe(true);
    expect(isPublicResponsePath("/api/public/tracking/code")).toBe(true);
    expect(isPublicResponsePath("/private/shipments")).toBe(false);
  });

  it("redacts raw, encoded, malformed, unknown and web bearer path segments", () => {
    expect(publicPathForLog("/api/public/tracking/secret-code")).toBe("/api/public/tracking/:code");
    expect(publicPathForLog("/api/public/tracking/%73ecret-code")).toBe(
      "/api/public/tracking/:code",
    );
    expect(publicPathForLog("/api/public/tracking/%ZZsecret-code")).toBe(
      "/api/public/tracking/:code",
    );
    expect(publicPathForLog("/api/public/secret-code")).toBe("/api/public/:route");
    expect(publicPathForLog("/seguimiento/secret-code")).toBe("/seguimiento/:code");
    expect(publicPathForLog("/cliente/secret-code/private")).toBe("/cliente/:code");
  });

  it("preserves safe route templates and existing recovery-token redaction", () => {
    expect(publicPathForLog("/api/public/test-error/secret-code")).toBe(
      "/api/public/test-error/:code",
    );
    expect(publicPathForLog("/api/public/merchant/code/photos/photo-id")).toBe(
      "/api/public/merchant/:code/photos/:photoId",
    );
    expect(publicPathForLog("/api/auth/%72eset-password/secret-token")).toBe(
      "/api/auth/reset-password/:token",
    );
  });
});
