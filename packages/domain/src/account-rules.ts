import type { UserRole } from "./schemas/enums.ts";

type AccountState = { role: UserRole; isActive: boolean };

/** FR-032 and feature 003 FR-002: the server supplies transactionally locked facts. */
export function accountChangeRefusal(
  current: AccountState,
  next: AccountState,
  context: { hasOtherActiveOwner: boolean; hasCourierLink: boolean },
): "last_owner" | "courier_account_linked" | null {
  if (
    current.role === "owner" &&
    current.isActive &&
    (next.role !== "owner" || !next.isActive) &&
    !context.hasOtherActiveOwner
  ) {
    return "last_owner";
  }
  if (current.role === "courier" && next.role !== "courier" && context.hasCourierLink) {
    return "courier_account_linked";
  }
  return null;
}
