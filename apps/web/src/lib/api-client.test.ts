import { Hono } from "hono";
import { hc } from "hono/client";
import type { Handover, RouteDetail } from "@domy/domain";
import { cancelRoute, confirmHandover } from "@/features/routes/api";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { api, ApiError, unwrap, unwrapEmpty } from "./api-client";

const app = new Hono()
  .get("/success", (c) => c.json({ id: "shipment-id", count: 2 }))
  .get("/failure", (c) =>
    c.json(
      {
        error: {
          code: "invalid_request",
          message: "Revisa los datos.",
          fields: { name: "Escribe un nombre." },
          retryAt: "later",
        },
      },
      400,
    ),
  )
  .get("/malformed", (c) => c.json({ error: { code: 5 } }, 500))
  .post("/empty", (c) => c.body(null, 204));
const client = hc<typeof app>("http://localhost", {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    app.request(input instanceof Request ? input : String(input), init),
});

// Constitution V / T136: these checks compile without making requests.
async function responseContractChecks() {
  expectTypeOf<Awaited<ReturnType<typeof cancelRoute>>>().toExtend<RouteDetail>();
  expectTypeOf<Awaited<ReturnType<typeof confirmHandover>>>().toExtend<Handover>();
  const response = await unwrap(api.api.municipalities.$get());
  expectTypeOf(response.items[0]?.id).toEqualTypeOf<string | undefined>();
  // @ts-expect-error T136: endpoint-inferred output rejects nonexistent response properties.
  expect(response.imaginary).toBeUndefined();
  // @ts-expect-error T136: callers cannot select an unrelated unchecked success shape.
  void unwrap<{ imaginary: string }>(api.api.municipalities.$get());
  // @ts-expect-error T136: native Responses do not supply an inferred RPC JSON contract.
  void unwrap(Promise.resolve(new Response("{}")));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RPC response boundary (001/T136)", () => {
  it("keeps compile-time contract assertions in the typecheck", () => {
    expectTypeOf(responseContractChecks).toBeFunction();
  });
  it("infers and returns the endpoint JSON", async () => {
    const result = await unwrap(client.success.$get());
    expectTypeOf(result).toEqualTypeOf<{ id: string; count: number }>();
    expect(result).toEqual({ id: "shipment-id", count: 2 });
  });

  it("retains Spanish error messages, fields and structured details", async () => {
    await expect(unwrap(client.failure.$get())).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
      message: "Revisa los datos.",
      fields: { name: "Escribe un nombre." },
      details: { retryAt: "later" },
    });
  });

  it("uses a safe actionable error for invalid error envelopes", async () => {
    await expect(unwrap(client.malformed.$get())).rejects.toMatchObject({
      status: 500,
      code: "unknown_error",
      message: "Ocurrió un error inesperado. Intenta de nuevo.",
    });
  });

  it("does not read JSON from a successful 204 mutation", async () => {
    await expect(unwrapEmpty(client.empty.$post())).resolves.toBeUndefined();
  });

  it("applies validated errors to bodyless mutations too", async () => {
    await expect(unwrapEmpty(client.failure.$get())).rejects.toMatchObject({
      status: 400,
      code: "invalid_request",
    });
  });

  it("handles non-JSON HTTP errors safely", async () => {
    const unavailable = hc<typeof app>("http://localhost", {
      fetch: () => Promise.resolve(new Response("upstream unavailable", { status: 502 })),
    });
    await expect(unwrap(unavailable.success.$get())).rejects.toMatchObject({
      status: 502,
      code: "unknown_error",
    });
  });

  it("turns a native fetch failure into an actionable network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(unwrap(api.api.municipalities.$get())).rejects.toMatchObject({
      status: 0,
      code: "network_error",
      message: "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.",
    });
  });

  // ROB-4: a request that never answers ends as the same network error after 30 s.
  it("turns a request that never answers into a network error after 30 s", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const signals: AbortSignal[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(
          (_input: RequestInfo | URL, init?: RequestInit) =>
            new Promise<Response>((_, reject) => {
              if (init?.signal) signals.push(init.signal);
              init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
              });
            }),
        ),
      );
      const outcome = unwrap(api.api.municipalities.$get()).then(
        () => "resolved",
        (error: unknown) => error,
      );

      await vi.advanceTimersByTimeAsync(29_999);
      expect(await Promise.race([outcome, Promise.resolve("pending")])).toBe("pending");
      await vi.advanceTimersByTimeAsync(1);

      expect(signals).toHaveLength(1);
      expect(await outcome).toMatchObject({ status: 0, code: "network_error" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves transport failures without manufacturing success", async () => {
    const error = new ApiError(0, { code: "network_error", message: "Revisa tu internet." });
    await expect(unwrap(Promise.reject(error))).rejects.toBe(error);
  });
});
