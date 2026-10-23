import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

it("sends a link replacement through the typed API with its actor and stable action ID", async () => {
  const merchantId = "0194d9f0-0000-7000-8000-000000000011";
  const actorId = "0194d9f0-0000-7000-8000-000000000012";
  const actionId = "0194d9f0-0000-7000-8000-000000000013";
  const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(
      Response.json({
        id: merchantId,
        name: "Cliente de prueba",
        whatsappPhone: null,
        isActive: true,
        aliases: [],
        linkCode: "0123456789abcdefghijk_",
      }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  const { replaceMerchantLink } = await import("./api");

  await replaceMerchantLink(merchantId, { actionId }, actorId);

  const request = fetcher.mock.calls[0]?.[0];
  const options = fetcher.mock.calls[0]?.[1];
  const requestUrl =
    typeof request === "string"
      ? request
      : request instanceof URL
        ? request.toString()
        : request?.url;
  expect(requestUrl).toContain(`/api/merchants/${merchantId}/replace-link`);
  expect(new Headers(options?.headers).get("X-Domy-Actor-Id")).toBe(actorId);
  expect(options?.method).toBe("POST");
  expect(typeof options?.body).toBe("string");
  if (typeof options?.body !== "string") throw new Error("The action body was not JSON text");
  const body: unknown = JSON.parse(options.body);
  expect(body).toEqual({ actionId });
});
