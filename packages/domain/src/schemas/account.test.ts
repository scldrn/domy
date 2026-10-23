import { describe, expect, it } from "vitest";
import {
  accountCreateInput,
  accountRoleInput,
  accountTargetInput,
  accountUpdateInput,
  passwordSignInInput,
} from "./account.ts";

const userId = "b4f67dc0-f16e-4ac7-ae2b-1bc61cbd38a0";
const actionId = "4a1966eb-dc9e-47eb-8cab-8c6cc999b293";
const creation = {
  id: actionId,
  name: "Nueva cuenta",
  email: "nueva@domy.test",
  password: "contrasena-segura",
  role: "courier",
};

describe("account inputs (FR-030/032, T130, R18)", () => {
  it("requires a valid client intent UUID for every account mutation (T132)", () => {
    const { id: _id, ...withoutId } = creation;
    expect(accountCreateInput.safeParse(withoutId).success).toBe(false);
    expect(accountCreateInput.safeParse({ ...creation, id: "invalid" }).success).toBe(false);
    expect(accountTargetInput.safeParse({ userId }).success).toBe(false);
    expect(accountTargetInput.safeParse({ userId, actionId: "invalid" }).success).toBe(false);
  });
  it("accepts supported account creation and the native default courier role", () => {
    expect(accountCreateInput.safeParse(creation).success).toBe(true);
    const { role: _role, ...withoutRole } = creation;
    expect(accountCreateInput.parse(withoutRole).role).toBe("courier");
  });
  it.each(["corta", "x".repeat(129)])(
    "refuses a password outside the creation bounds",
    (password) => {
      expect(accountCreateInput.safeParse({ ...creation, password }).success).toBe(false);
    },
  );
  it.each(["", "   "])("refuses an empty account name", (name) => {
    expect(accountCreateInput.safeParse({ ...creation, name }).success).toBe(false);
  });
  it("does not add an unapproved business cap on account names", () => {
    expect(accountCreateInput.safeParse({ ...creation, name: "a".repeat(1000) }).success).toBe(
      true,
    );
  });
  it("refuses generic plugin data and internal creation fields", () => {
    expect(accountCreateInput.safeParse({ ...creation, data: { banned: true } }).success).toBe(
      false,
    );
    expect(accountCreateInput.safeParse({ ...creation, banned: true }).success).toBe(false);
  });
  it("accepts name/email-only edits, including either field alone", () => {
    expect(
      accountUpdateInput.safeParse({ actionId, userId, data: { name: "Actualizada" } }).success,
    ).toBe(true);
    expect(
      accountUpdateInput.safeParse({ actionId, userId, data: { email: "otra@domy.test" } }).success,
    ).toBe(true);
  });
  it.each([{ role: "owner" }, { banned: true }, {}, null, { email: "incorrecto" }])(
    "refuses invalid generic edits: %j",
    (data) => {
      expect(accountUpdateInput.safeParse({ actionId, userId, data }).success).toBe(false);
    },
  );
  it.each(["admin", ["owner", "courier"], null, 42])(
    "accepts only one declared role: %j",
    (role) => {
      expect(accountRoleInput.safeParse({ actionId, userId, role }).success).toBe(false);
    },
  );
  it("accepts a supported dedicated role change", () => {
    expect(accountRoleInput.safeParse({ actionId, userId, role: "dispatcher" }).success).toBe(true);
  });
  it.each([42, "not-a-uuid", null])("refuses invalid target identifiers: %j", (invalid) => {
    expect(accountTargetInput.safeParse({ actionId, userId: invalid }).success).toBe(false);
  });
  it("does not expose temporary-ban or arbitrary fields", () => {
    expect(accountTargetInput.safeParse({ actionId, userId, banExpiresIn: 60 }).success).toBe(
      false,
    );
  });
  it("validates sign-in types without applying creation password-length rules", () => {
    expect(passwordSignInInput.safeParse({ email: "nueva@domy.test", password: "x" }).success).toBe(
      true,
    );
    expect(passwordSignInInput.safeParse({ email: 42, password: "x" }).success).toBe(false);
    expect(passwordSignInInput.safeParse({ email: "nueva@domy.test", password: 42 }).success).toBe(
      false,
    );
  });
});
