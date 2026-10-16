import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});
describe("phone notification subscription (FR-040)", () => {
  it("does not subscribe when permission is refused", async () => {
    const requestPermission = vi.fn().mockResolvedValue("denied");
    const subscribe = vi.fn();
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.resolve({ pushManager: { subscribe } }) },
    });
    const { enablePush } = await import("./push");
    expect(await enablePush("public-key")).toBe(false);
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(subscribe).not.toHaveBeenCalled();
  });
  it("uses the public key for a new subscription and registers exactly its browser endpoint/keys", async () => {
    const subscribe = vi.fn().mockResolvedValue({
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/device",
        keys: { p256dh: "device-key", auth: "device-auth" },
      }),
    });
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn() });
    vi.stubGlobal("navigator", {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: { getSubscription: () => Promise.resolve(null), subscribe },
        }),
      },
    });
    const { enablePush } = await import("./push");
    expect(await enablePush("public-key")).toBe(true);
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: "public-key",
    });
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/courier/push-subscriptions");
    if (typeof init.body !== "string") throw new Error("Expected a JSON request body");
    expect(JSON.parse(init.body)).toEqual({
      actionId: expect.any(String),
      endpoint: "https://fcm.googleapis.com/fcm/send/device",
      keys: { p256dh: "device-key", auth: "device-auth" },
    });
  });
});
