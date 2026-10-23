import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { authCall } from "@/features/auth/session";
import {
  createAccount,
  deactivateAccount,
  endSessions,
  listAccounts,
  reactivateAccount,
  setRole,
  updateAccount,
} from "./api";

vi.mock("@/features/auth/session", () => ({ authCall: vi.fn() }));
const account = {
  id: "0194d9f0-0000-7000-8000-000000000001",
  name: "Operadora",
  email: "operadora@example.com",
  role: "dispatcher",
  banned: null,
  createdAt: "2026-10-01T15:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("navigator", {
    locks: { request: (_key: string, callback: () => unknown) => Promise.resolve().then(callback) },
  });
});

function authContractChecks() {
  expectTypeOf<Awaited<ReturnType<typeof authCall>>>().toBeUnknown();
  // @ts-expect-error T136: native auth payloads require schema validation, not a caller-selected type.
  void authCall<{ user: { id: string } }>("admin/create-user");
}

describe("Native Better Auth response boundaries (001/T136)", () => {
  it("keeps native auth responses unknown until validated", () => {
    expectTypeOf(authContractChecks).toBeFunction();
  });
  it("validates native JSON dates, nullable banned and configured roles", async () => {
    vi.mocked(authCall).mockResolvedValue({ users: [account], total: 1 });
    await expect(listAccounts()).resolves.toEqual([account]);
  });
  it.each([
    { ...account, role: "admin" },
    { ...account, createdAt: 4 },
    { ...account, id: "invalid" },
    { ...account, banned: "false" },
  ])("refuses malformed native account fields", async (invalid) => {
    vi.mocked(authCall).mockResolvedValue({ users: [invalid] });
    await expect(listAccounts()).rejects.toMatchObject({ status: 502, code: "invalid_response" });
  });
  it("validates the acknowledged created user identity", async () => {
    vi.mocked(authCall).mockResolvedValue({ user: account });
    await expect(
      createAccount(
        {
          name: account.name,
          email: account.email,
          role: "dispatcher",
          password: "password",
        },
        { actorId: "0194d9f0-0000-7000-8000-000000000002" },
      ),
    ).resolves.toEqual({ user: { id: account.id } });
    vi.mocked(authCall).mockResolvedValue({ user: {} });
    await expect(
      createAccount(
        {
          name: account.name,
          email: account.email,
          role: "dispatcher",
          password: "password",
        },
        { actorId: "0194d9f0-0000-7000-8000-000000000002" },
      ),
    ).rejects.toMatchObject({ status: 502, code: "invalid_response" });
  });
});

describe("Account mutation actor binding (001/T132)", () => {
  it("sends the session actor on every native account mutation", async () => {
    const actorId = "0194d9f0-0000-7000-8000-000000000002";
    vi.mocked(authCall).mockImplementation((path) => {
      if (path === "admin/create-user") return Promise.resolve({ user: { id: account.id } });
      if (path === "admin/update-user") return Promise.resolve(account);
      if (path === "admin/revoke-user-sessions") return Promise.resolve({ success: true });
      return Promise.resolve({ user: account });
    });

    await createAccount(
      { name: account.name, email: account.email, role: "dispatcher", password: "password" },
      { actorId },
    );
    await updateAccount(account.id, { name: account.name, email: account.email }, { actorId });
    await setRole(account.id, "dispatcher", { actorId });
    await deactivateAccount(account.id, { actorId });
    await reactivateAccount(account.id, { actorId });
    await endSessions(account.id, { actorId });

    expect(vi.mocked(authCall).mock.calls.map(([, , headers]) => headers)).toEqual(
      Array.from({ length: 6 }, () => ({ "X-Domy-Actor-Id": actorId })),
    );
  });

  it("sends the same actor with the courier-link action UUID", async () => {
    const actorId = "0194d9f0-0000-7000-8000-000000000002";
    const actionId = "0194d9f0-0000-7000-8000-000000000003";
    const userId = account.id;
    const courierId = "0194d9f0-0000-7000-8000-000000000004";
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(Response.json({ courier: null })),
    );
    vi.stubGlobal("fetch", fetcher);
    const { linkCourierAccount } = await import("@/features/master-data/api");

    await linkCourierAccount(userId, courierId, actorId, actionId);

    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.get("X-Domy-Actor-Id")).toBe(actorId);
    const body = fetcher.mock.calls[0]?.[1]?.body;
    expect(typeof body).toBe("string");
    if (typeof body !== "string") throw new Error("Link request body was not JSON text");
    const requestBody: unknown = JSON.parse(body);
    expect(requestBody).toEqual({
      actionId,
      courierId,
    });
  });
});

// 001/T132: transport uncertainty must preserve the browser's original account intent.
describe("Durable account intent transport", () => {
  const actor = "0194d9f0-0000-7000-8000-000000000002";
  const otherActor = "0194d9f0-0000-7000-8000-000000000003";
  const input = {
    name: "Operadora",
    email: account.email,
    role: "dispatcher" as const,
    password: "password",
  };
  const storage = new Map<string, string>();
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    let queue = Promise.resolve();
    vi.stubGlobal("navigator", {
      locks: {
        request: (_key: string, callback: () => unknown) => {
          const result = queue.then(callback);
          queue = result.then(
            () => undefined,
            () => undefined,
          );
          return result;
        },
      },
    });
  });
  it("persists before send, retains lost ACK identity across reload and keeps passwords out of storage", async () => {
    vi.mocked(authCall).mockImplementation(() => {
      expect(storage.size).toBe(1);
      expect([...storage.values()].join()).not.toContain("password");
      return Promise.reject(new Error("lost ACK"));
    });
    await expect(createAccount(input, { actorId: actor })).rejects.toThrow();
    const first: unknown = vi.mocked(authCall).mock.calls[0]?.[1];
    vi.resetModules();
    const { createAccount: reloaded } = await import("./api");
    await expect(reloaded(input, { actorId: actor })).rejects.toThrow();
    expect(vi.mocked(authCall).mock.calls[1]?.[1]).toEqual(first);
    expect(first).toMatchObject({ id: expect.any(String) });
  });
  it("shares identity between concurrent tabs without holding a lock during requests", async () => {
    vi.mocked(authCall).mockRejectedValue(new Error("offline"));
    await Promise.allSettled([
      createAccount(input, { actorId: actor }),
      createAccount(input, { actorId: actor }),
    ]);
    const first = vi.mocked(authCall).mock.calls[0]?.[1];
    expect(first).toMatchObject({ id: expect.any(String) });
    expect(vi.mocked(authCall).mock.calls[1]?.[1]).toEqual(first);
  });
  it("blocks changed pending input and preserves the original", async () => {
    vi.mocked(authCall).mockRejectedValue(new Error("offline"));
    await expect(createAccount(input, { actorId: actor })).rejects.toThrow();
    const before = [...storage.entries()];
    await expect(
      createAccount({ ...input, name: "Distinto" }, { actorId: actor }),
    ).rejects.toMatchObject({ code: "account_intent_pending" });
    expect(authCall).toHaveBeenCalledTimes(1);
    expect([...storage.entries()]).toEqual(before);
  });
  it("isolates actors and rotates identity only after an acknowledged success", async () => {
    vi.mocked(authCall).mockRejectedValue(new Error("offline"));
    await expect(createAccount(input, { actorId: actor })).rejects.toThrow();
    await expect(createAccount(input, { actorId: otherActor })).rejects.toThrow();
    expect(storage.size).toBe(2);
    vi.mocked(authCall).mockResolvedValue({ user: account });
    await createAccount(input, { actorId: actor });
    await createAccount(input, { actorId: actor });
    expect(vi.mocked(authCall).mock.calls[2]?.[1]).not.toEqual(
      vi.mocked(authCall).mock.calls[3]?.[1],
    );
    expect(storage.size).toBe(1);
  });
  it("blocks sends when persistence is unavailable", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    await expect(createAccount(input, { actorId: actor })).rejects.toMatchObject({
      code: "account_storage_unavailable",
    });
    expect(authCall).not.toHaveBeenCalled();
  });
});

describe("Account operation lifecycle ordering (001/T132 N2)", () => {
  const context = { actorId: "0194d9f0-0000-7000-8000-000000000002" };
  it("requires recovering an uncertain ban before unban, then gives the next ban a fresh identity", async () => {
    vi.mocked(authCall).mockRejectedValueOnce(new Error("committed but ACK lost"));
    await expect(deactivateAccount(account.id, context)).rejects.toThrow();
    const original = vi.mocked(authCall).mock.calls[0]?.[1];
    await expect(reactivateAccount(account.id, context)).rejects.toMatchObject({
      code: "account_intent_pending",
    });
    expect(authCall).toHaveBeenCalledTimes(1);
    vi.mocked(authCall).mockResolvedValue({ user: { ...account, banned: true } });
    await deactivateAccount(account.id, context);
    expect(vi.mocked(authCall).mock.calls[1]?.[1]).toEqual(original);
    vi.mocked(authCall).mockResolvedValue({ user: { ...account, banned: false } });
    await reactivateAccount(account.id, context);
    vi.mocked(authCall).mockResolvedValue({ user: { ...account, banned: true } });
    await deactivateAccount(account.id, context);
    expect(vi.mocked(authCall).mock.calls[3]?.[1]).not.toEqual(original);
  });
});

it("keeps a lost creation ACK's identity when password re-entry is empty or invalid", async () => {
  const context = { actorId: "0194d9f0-0000-7000-8000-000000000002" };
  const input = {
    name: account.name,
    email: account.email,
    role: "dispatcher" as const,
    password: "password",
  };
  vi.mocked(authCall).mockRejectedValueOnce(new Error("committed but lost ACK"));
  await expect(createAccount(input, context)).rejects.toThrow();
  const first = vi.mocked(authCall).mock.calls[0]?.[1];
  vi.mocked(authCall).mockResolvedValue({ user: account });
  for (const password of ["", "short"]) {
    await expect(createAccount({ ...input, password }, context)).rejects.toMatchObject({
      code: "account_input_invalid",
    });
  }
  expect(authCall).toHaveBeenCalledTimes(1);
  await createAccount(input, context);
  expect(vi.mocked(authCall).mock.calls[1]?.[1]).toEqual(first);
});
