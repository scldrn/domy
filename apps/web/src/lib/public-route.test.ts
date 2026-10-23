import { describe, expect, it } from "vitest";
import { isPublicPagePath } from "./public-route";

describe("isPublicPagePath", () => {
  it.each([
    "/seguimiento",
    "/seguimiento/ABC123",
    "/seguimiento/ABC123/",
    "/SEGUIMIENTO",
    "/SEGUIMIENTO/ABC123",
    "/sEgUiMiEnTo/ABC123",
    "/%73eguimiento/ABC123",
    "/%53EGUIMIENTO/ABC123",
    "/seguimiento/%ZZ",
    "/cliente",
    "/cliente/ABC123",
    "/cliente/ABC123/envios",
    "/CLIENTE",
    "/CLIENTE/ABC123",
    "/%63liente/ABC123",
    "/%43LIENTE/ABC123",
    "/cliente/%ZZ",
  ])("matches the public path %s", (pathname) => {
    expect(isPublicPagePath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/ingresar",
    "/mensajero",
    "/clientes/ABC123",
    "/clientela/ABC123",
    "/cliente-ejemplo/ABC123",
    "/seguimiento-ejemplo/ABC123",
    "/seguimientos/ABC123",
    "/CLIENTES/ABC123",
    "/SEGUIMIENTOX/ABC123",
    "/%73eguimientos/ABC123",
    "/%2Fseguimiento/ABC123",
    "/%ZZeguimiento/ABC123",
    "/%63liente-extra/ABC123",
    "//seguimiento/ABC123",
  ])("does not match the private or neighboring path %s", (pathname) => {
    expect(isPublicPagePath(pathname)).toBe(false);
  });
});
