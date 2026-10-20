import { describe, expect, it } from "vitest";
import {
  accountCreateInput,
  accountRoleInput,
  accountTargetInput,
  accountUpdateInput,
  passwordSignInInput,
} from "./account.ts";

const userId = "b4f67dc0-f16e-4ac7-ae2b-1bc61cbd38a0";
const creation = {
  name: "Nueva cuenta",
  email: "nueva@domy.test",
  password: "contrasena-segura",
  role: "courier",
};

describe("account inputs (FR-030/032, T130, R18)", () => {
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
    expect(accountUpdateInput.safeParse({ userId, data: { name: "Actualizada" } }).success).toBe(
      true,
    );
    expect(
      accountUpdateInput.safeParse({ userId, data: { email: "otra@domy.test" } }).success,
    ).toBe(true);
  });
  it.each([{ role: "owner" }, { banned: true }, {}, null, { email: "incorrecto" }])(
    "refuses invalid generic edits: %j",
    (data) => {
      expect(accountUpdateInput.safeParse({ userId, data }).success).toBe(false);
    },
  );
  it.each(["admin", ["owner", "courier"], null, 42])(
    "accepts only one declared role: %j",
    (role) => {
      expect(accountRoleInput.safeParse({ userId, role }).success).toBe(false);
    },
  );
  it("accepts a supported dedicated role change", () => {
    expect(accountRoleInput.safeParse({ userId, role: "dispatcher" }).success).toBe(true);
  });
  it.each([42, "not-a-uuid", null])("refuses invalid target identifiers: %j", (invalid) => {
    expect(accountTargetInput.safeParse({ userId: invalid }).success).toBe(false);
  });
  it("does not expose temporary-ban or arbitrary fields", () => {
    expect(accountTargetInput.safeParse({ userId, banExpiresIn: 60 }).success).toBe(false);
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
