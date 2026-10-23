import { beforeEach, expect, it, vi } from "vitest";
import { createAccount, setRole, updateAccount } from "./api";
import { linkCourierAccount } from "@/features/master-data/api";
import { runAccountWorkflow, readAccountWorkflow } from "./account-workflow";
vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  createAccount: vi.fn(),
  setRole: vi.fn(),
  updateAccount: vi.fn(),
}));
vi.mock("@/features/master-data/api", () => ({ linkCourierAccount: vi.fn() }));
const actorId = "0194d9f0-0000-7000-8000-000000000002";
const userId = "0194d9f0-0000-7000-8000-000000000003";
const courierId = "0194d9f0-0000-7000-8000-000000000004";
const input = { name: "Ana", email: "ana@example.com", role: "courier" as const, courierId };
const storage = new Map<string, string>();
const linked = {
  courier: {
    id: courierId,
    name: "Ana",
    phone: "3004445566",
    isActive: true,
    aliases: [],
    account: { id: userId, email: input.email },
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("navigator", {
    locks: { request: (_key: string, callback: () => unknown) => Promise.resolve().then(callback) },
  });
  vi.mocked(createAccount).mockResolvedValue({ user: { id: userId } });
  vi.mocked(linkCourierAccount).mockResolvedValue(linked);
});
it("resumes acknowledged creation and failed link after reload without password or another create", async () => {
  vi.mocked(linkCourierAccount).mockRejectedValueOnce(new Error("lost link ACK"));
  await expect(runAccountWorkflow(actorId, null, input, "secretpassword")).rejects.toThrow(
    "lost link ACK",
  );
  expect([...storage.values()].join()).not.toContain("secretpassword");
  const pending = await readAccountWorkflow(actorId, null);
  expect(pending).toMatchObject({ createdUserId: userId, acknowledged: ["create"] });
  vi.mocked(linkCourierAccount).mockResolvedValueOnce(linked);
  await runAccountWorkflow(actorId, null, input, "");
  expect(createAccount).toHaveBeenCalledTimes(1);
  expect(linkCourierAccount).toHaveBeenCalledTimes(2);
  expect(vi.mocked(linkCourierAccount).mock.calls[0]).toEqual(
    vi.mocked(linkCourierAccount).mock.calls[1],
  );
  expect(await readAccountWorkflow(actorId, null)).toBeNull();
});
it("does not repeat acknowledged profile or role when courier linking retries", async () => {
  const original = { ...input, name: "Anterior", role: "dispatcher" as const, courierId: null };
  vi.mocked(updateAccount).mockResolvedValue({
    id: userId,
    name: input.name,
    email: input.email,
    role: "dispatcher",
    banned: false,
    createdAt: "2026-10-01T15:00:00Z",
  });
  vi.mocked(setRole).mockResolvedValue({
    user: {
      id: userId,
      name: input.name,
      email: input.email,
      role: "courier",
      banned: false,
      createdAt: "2026-10-01T15:00:00Z",
    },
  });
  vi.mocked(linkCourierAccount).mockRejectedValueOnce(new Error("offline"));
  await expect(
    runAccountWorkflow(actorId, { id: userId, ...original }, input, ""),
  ).rejects.toThrow();
  await runAccountWorkflow(actorId, { id: userId, ...original }, input, "");
  expect(updateAccount).toHaveBeenCalledTimes(1);
  expect(setRole).toHaveBeenCalledTimes(1);
  expect(linkCourierAccount).toHaveBeenCalledTimes(2);
  expect(vi.mocked(updateAccount).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(setRole).mock.invocationCallOrder[0] ?? 0,
  );
  expect(vi.mocked(setRole).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(linkCourierAccount).mock.invocationCallOrder[0] ?? 0,
  );
});
it("unlinks before a courier loses its role and resumes only the failed role phase", async () => {
  vi.mocked(linkCourierAccount).mockResolvedValue({ courier: null });
  vi.mocked(setRole).mockRejectedValueOnce(new Error("offline"));
  const original = { id: userId, ...input };
  const wanted = { ...input, role: "dispatcher" as const, courierId: null };
  await expect(runAccountWorkflow(actorId, original, wanted, "")).rejects.toThrow();
  await runAccountWorkflow(actorId, original, wanted, "");
  expect(linkCourierAccount).toHaveBeenCalledTimes(1);
  expect(setRole).toHaveBeenCalledTimes(2);
  expect(vi.mocked(linkCourierAccount).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(setRole).mock.invocationCallOrder[0] ?? 0,
  );
});

it("releases only an unacknowledged definitely rolled back workflow, allowing corrected public input", async () => {
  const { ApiError } = await import("@/lib/api-client");
  vi.mocked(createAccount).mockRejectedValueOnce(
    new ApiError(400, {
      code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
      message: "Ese correo ya existe.",
    }),
  );
  await expect(runAccountWorkflow(actorId, null, input, "password")).rejects.toThrow();
  expect(await readAccountWorkflow(actorId, null)).toBeNull();
  await runAccountWorkflow(
    actorId,
    null,
    { ...input, email: "otra@example.com", courierId: null },
    "password",
  );
  expect(createAccount).toHaveBeenCalledTimes(2);
});

it.each([
  { courier: null },
  { courier: { ...linked.courier, id: actorId } },
  { courier: { ...linked.courier, account: { id: actorId, email: input.email } } },
])(
  "retains the link intent and create ACK when 2xx names the wrong courier or account",
  async (reply) => {
    vi.mocked(linkCourierAccount).mockResolvedValueOnce(reply);
    await expect(runAccountWorkflow(actorId, null, input, "password")).rejects.toMatchObject({
      status: 502,
      code: "invalid_response",
    });
    expect(await readAccountWorkflow(actorId, null)).toMatchObject({
      acknowledged: ["create"],
      createdUserId: userId,
    });
    const first = vi.mocked(linkCourierAccount).mock.calls[0];
    await runAccountWorkflow(actorId, null, input, "");
    expect(createAccount).toHaveBeenCalledTimes(1);
    expect(vi.mocked(linkCourierAccount).mock.calls[1]).toEqual(first);
  },
);
it.each([null, {}, { courier: { id: "invalid" } }])(
  "retains link uncertainty for malformed native 2xx JSON",
  async (invalid) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json(invalid))),
    );
    vi.mocked(linkCourierAccount).mockImplementationOnce(async (...args) => {
      const actual = await vi.importActual<typeof import("@/features/master-data/api")>(
        "@/features/master-data/api",
      );
      return actual.linkCourierAccount(...args);
    });
    await expect(runAccountWorkflow(actorId, null, input, "password")).rejects.toMatchObject({
      status: 502,
      code: "invalid_response",
    });
    expect(await readAccountWorkflow(actorId, null)).toMatchObject({ acknowledged: ["create"] });
  },
);
it("refuses a non-null unlink ACK and preserves the unlink identity", async () => {
  const original = { id: userId, ...input };
  const wanted = { ...input, courierId: null };
  await expect(runAccountWorkflow(actorId, original, wanted, "")).rejects.toMatchObject({
    status: 502,
    code: "invalid_response",
  });
  expect(await readAccountWorkflow(actorId, userId)).not.toBeNull();
  vi.mocked(linkCourierAccount).mockResolvedValue({ courier: null });
  await runAccountWorkflow(actorId, original, wanted, "");
  expect(vi.mocked(linkCourierAccount).mock.calls[0]).toEqual(
    vi.mocked(linkCourierAccount).mock.calls[1],
  );
});

it("does not persist an invalid fresh creation, so public input can be corrected", async () => {
  await expect(runAccountWorkflow(actorId, null, input, "short")).rejects.toMatchObject({
    code: "account_input_invalid",
  });
  expect(createAccount).not.toHaveBeenCalled();
  expect(storage.size).toBe(0);
  await runAccountWorkflow(
    actorId,
    null,
    { ...input, email: "corrected@example.com", courierId: null },
    "valid-password",
  );
  expect(createAccount).toHaveBeenCalledTimes(1);
});
it("keeps an uncertain workflow unchanged when password re-entry fails locally", async () => {
  vi.mocked(createAccount).mockRejectedValueOnce(new Error("ACK lost"));
  await expect(runAccountWorkflow(actorId, null, input, "valid-password")).rejects.toThrow();
  const before = [...storage.entries()];
  await expect(runAccountWorkflow(actorId, null, input, "")).rejects.toMatchObject({
    code: "account_input_invalid",
  });
  expect([...storage.entries()]).toEqual(before);
  expect(createAccount).toHaveBeenCalledTimes(1);
  await runAccountWorkflow(actorId, null, input, "valid-password");
  expect(vi.mocked(createAccount).mock.calls[1]?.[1]).toEqual(
    vi.mocked(createAccount).mock.calls[0]?.[1],
  );
});
