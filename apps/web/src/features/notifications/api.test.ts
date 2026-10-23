import { afterEach, describe, expect, it, vi } from "vitest";
import { getNotifications, markNotifications, notificationListQueryOptions } from "./api";

function requestUrl(input: RequestInfo | URL | undefined): URL {
  if (input === undefined) throw new Error("The notification API did not make a request.");
  const value = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return new URL(value, "https://domy.test");
}

const actorId = "b4f67dc0-f16e-4ac7-ae2b-1bc61cbd38a0";
const merchantId = "4a1966eb-dc9e-47eb-8cab-8c6cc999b293";
const shipmentId = "f3b6a343-117e-4df5-8818-9ba610b1386f";
const actionId = "75a4b63b-ae32-4cdc-b0e1-d71c23db68b8";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notification API", () => {
  it("uses the inferred date query and returns the server's inactive-state flag", async () => {
    const responseBody = {
      merchants: [
        {
          merchantId,
          name: "Tienda Aurora",
          whatsappPhone: null,
          linkCode: "AAAAAAAAAAAAAAAAAAAAAA",
          isActive: false,
          shipments: [],
        },
      ],
    };
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(Response.json(responseBody)),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(getNotifications("2026-10-22")).resolves.toEqual(responseBody);
    const request = fetcher.mock.calls[0]?.[0];
    expect(requestUrl(request).pathname).toBe("/api/notifications");
    expect(requestUrl(request).searchParams.get("date")).toBe("2026-10-22");
  });

  it("posts the immutable batch with the captured actor header and expects no response body", async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(markNotifications({ actionId, shipmentIds: [shipmentId] }, actorId)).resolves.toBe(
      undefined,
    );
    const call = fetcher.mock.calls[0];
    if (!call) throw new Error("The notification API did not make a request.");
    const [input, init] = call;
    expect(requestUrl(input).pathname).toBe("/api/notifications");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("X-Domy-Actor-Id")).toBe(actorId);
    expect(bodyJson(init?.body)).toEqual({ actionId, shipmentIds: [shipmentId] });
  });

  it("refuses an invalid batch before networking", async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(markNotifications({ actionId, shipmentIds: [] }, actorId)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects an invalid service date and isolates cached lists by captured actor", async () => {
    const fetcher = vi.fn(() => Promise.resolve(Response.json({ merchants: [] })));
    vi.stubGlobal("fetch", fetcher);

    await expect(getNotifications("2026-02-30")).rejects.toMatchObject({
      code: "notification_input_invalid",
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(notificationListQueryOptions(actorId, "2026-10-22").queryKey).not.toEqual(
      notificationListQueryOptions(merchantId, "2026-10-22").queryKey,
    );
  });
});

function bodyJson(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") throw new Error("The notification API body was not JSON text.");
  const parsed: unknown = JSON.parse(body);
  return parsed;
}
