import type { Courier } from "@domy/domain";
import { describe, expect, it, vi } from "vitest";
import { courierAccountsQuery, linkedCourier } from "./account-dialog";

const accountId = "e516c30c-fb7b-44d7-9402-4213cf0c610a";
const inactiveCourier: Courier = {
  id: "8d729aee-4605-4d1a-b13b-a86f96e42a2a",
  name: "Mensajero inactivo",
  phone: "3004445566",
  isActive: false,
  aliases: [],
  account: { id: accountId, email: "mensajero@example.com" },
};

describe("courier account readiness (003/T135)", () => {
  it("keeps an unknown courier list distinct from a loaded unlinked account", () => {
    expect(linkedCourier(undefined, accountId)).toBeUndefined();
    expect(linkedCourier([], accountId)).toBeNull();
  });

  it("finds the existing link even when the courier is inactive", () => {
    expect(linkedCourier([inactiveCourier], accountId)).toEqual(inactiveCourier);
  });

  it("loads inactive couriers so an existing relationship remains visible", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ items: [] }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      await courierAccountsQuery.queryFn();
      const request = fetchMock.mock.calls[0]?.[0];
      if (!request) throw new Error("Courier query did not issue an HTTP request");
      const url =
        request instanceof Request ? request.url : request instanceof URL ? request.href : request;
      expect(new URL(url, "http://localhost").searchParams.has("active")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
