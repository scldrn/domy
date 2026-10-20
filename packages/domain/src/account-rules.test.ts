import { describe, expect, it } from "vitest";
import { accountChangeRefusal } from "./account-rules.ts";

describe("account change invariants (FR-032, feature 003 FR-002, T130)", () => {
  const owner = { role: "owner", isActive: true } as const;
  const courier = { role: "courier", isActive: true } as const;
  const alone = { hasOtherActiveOwner: false, hasCourierLink: false };

  it("refuses demotion and deactivation of the last active owner", () => {
    expect(accountChangeRefusal(owner, { role: "dispatcher", isActive: true }, alone)).toBe(
      "last_owner",
    );
    expect(accountChangeRefusal(owner, { role: "owner", isActive: false }, alone)).toBe(
      "last_owner",
    );
  });

  it("allows unchanged owner status and promotion/reactivation", () => {
    expect(accountChangeRefusal(owner, owner, alone)).toBeNull();
    expect(accountChangeRefusal(courier, owner, alone)).toBeNull();
    expect(accountChangeRefusal({ ...owner, isActive: false }, owner, alone)).toBeNull();
  });

  it("permits demotion/deactivation when another active owner remains", () => {
    const context = { ...alone, hasOtherActiveOwner: true };
    expect(accountChangeRefusal(owner, { role: "dispatcher", isActive: true }, context)).toBeNull();
    expect(accountChangeRefusal(owner, { role: "owner", isActive: false }, context)).toBeNull();
  });

  it("does not confuse an already inactive owner with the last active owner", () => {
    expect(
      accountChangeRefusal(
        { ...owner, isActive: false },
        { role: "dispatcher", isActive: false },
        alone,
      ),
    ).toBeNull();
  });

  it("refuses changing a linked courier's role, but permits deactivation and unchanged role", () => {
    const linked = { ...alone, hasCourierLink: true };
    expect(accountChangeRefusal(courier, owner, linked)).toBe("courier_account_linked");
    expect(accountChangeRefusal(courier, { role: "dispatcher", isActive: true }, linked)).toBe(
      "courier_account_linked",
    );
    expect(accountChangeRefusal(courier, courier, linked)).toBeNull();
    expect(accountChangeRefusal(courier, { ...courier, isActive: false }, linked)).toBeNull();
  });

  it("permits changing an unlinked courier's role", () => {
    expect(accountChangeRefusal(courier, owner, alone)).toBeNull();
  });
});
