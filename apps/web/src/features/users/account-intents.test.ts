import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import {
  acquireAccountIntent,
  acknowledgeAccountIntent,
  withAccountIntent,
} from "./account-intents";
const actorId = "0194d9f0-0000-7000-8000-000000000002";
const target = "0194d9f0-0000-7000-8000-000000000003";
const input = { operation: "ban" as const, input: {} };
const data = new Map<string, string>();
beforeEach(() => {
  data.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
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
it("validates a complete strict persisted identity and public input, then shares its UUID", async () => {
  const created = await acquireAccountIntent({ actorId }, target, input);
  expect(created).toEqual({ actorId, target, ...input, id: expect.any(String) });
  expect(await acquireAccountIntent({ actorId }, target, input)).toEqual(created);
  expect(JSON.parse([...data.values()][0] ?? "null")).toEqual(created);
});
it("normalizes public creation data without accepting secrets or unknown metadata", async () => {
  const created = await acquireAccountIntent({ actorId }, null, {
    operation: "create",
    input: { name: " Ana ", email: "ANA@example.com", role: "courier" },
  });
  expect(created.input).toEqual({ name: "Ana", email: "ana@example.com", role: "courier" });
  const key = [...data.keys()][0] ?? "";
  data.set(key, JSON.stringify({ ...created, password: "never-accepted" }));
  await expect(
    acquireAccountIntent({ actorId }, null, {
      operation: "create",
      input: { name: "Ana", email: "ana@example.com", role: "courier" },
    }),
  ).rejects.toMatchObject({ code: "account_storage_invalid" });
  expect(data.get(key)).toContain("never-accepted");
});
it.each(["{broken", JSON.stringify({ id: "bad", actorId, target })])(
  "keeps malformed storage and blocks sending",
  async (raw) => {
    const original = await acquireAccountIntent({ actorId }, target, input);
    const key = [...data.keys()][0] ?? "";
    data.set(key, raw);
    const send = vi.fn().mockResolvedValue({ success: true });
    await expect(withAccountIntent({ actorId }, target, input, send)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
    expect(data.get(key)).toBe(raw);
    expect(original.id).toBeTypeOf("string");
  },
);
it("does not let an old tab ACK erase a newer intent", async () => {
  const first = await acquireAccountIntent({ actorId }, target, input);
  await acknowledgeAccountIntent(first);
  const second = await acquireAccountIntent({ actorId }, target, input);
  await acknowledgeAccountIntent(first);
  expect(await acquireAccountIntent({ actorId }, target, input)).toEqual(second);
  expect(second.id).not.toBe(first.id);
});
it.each([400, 401, 403, 408, 409, 429, 500, 502])(
  "retains uncertain or conflicting HTTP %i identities",
  async (status) => {
    const first = await acquireAccountIntent({ actorId }, target, input);
    await expect(
      withAccountIntent({ actorId }, target, input, () =>
        Promise.reject(
          new ApiError(status, {
            code: status === 409 ? "idempotency_conflict" : "failure",
            message: "Intenta de nuevo.",
          }),
        ),
      ),
    ).rejects.toThrow();
    expect(await acquireAccountIntent({ actorId }, target, input)).toEqual(first);
  },
);
it("releases a definite native rollback and uses a fresh identity", async () => {
  const first = await acquireAccountIntent({ actorId }, target, input);
  await expect(
    withAccountIntent({ actorId }, target, input, () =>
      Promise.reject(
        new ApiError(400, {
          code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
          message: "Corrige los datos.",
        }),
      ),
    ),
  ).rejects.toThrow();
  expect((await acquireAccountIntent({ actorId }, target, input)).id).not.toBe(first.id);
});
it("releases the Web Lock before a response so another tab can acquire the same identity", async () => {
  let resolveResponse: (() => void) | undefined;
  const response = new Promise<void>((resolve) => {
    resolveResponse = resolve;
  });
  let sentId: string | undefined;
  const sending = withAccountIntent({ actorId }, target, input, (id) => {
    sentId = id;
    return response;
  });
  let secondId: string | undefined;
  const otherSending = withAccountIntent({ actorId }, target, input, (id) => {
    secondId = id;
    return response;
  });
  await vi.waitFor(() => {
    expect(sentId).toBeTypeOf("string");
    expect(secondId).toBe(sentId);
  });
  resolveResponse?.();
  await Promise.all([sending, otherSending]);
});
it("blocks networking when the persistence write fails or Web Locks are unavailable", async () => {
  const send = vi.fn();
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  });
  await expect(withAccountIntent({ actorId }, target, input, send)).rejects.toMatchObject({
    code: "account_storage_unavailable",
  });
  vi.stubGlobal("navigator", {});
  await expect(withAccountIntent({ actorId }, target, input, send)).rejects.toMatchObject({
    code: "account_storage_unavailable",
  });
  expect(send).not.toHaveBeenCalled();
});
