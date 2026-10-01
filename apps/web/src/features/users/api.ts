import type { UserRole } from "@domy/domain";
import { authCall } from "@/features/auth/session";

/** Accounts, managed by the owner through Better Auth's admin endpoints (FR-032). */

export type Account = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  banned: boolean | null;
  createdAt: string;
};

export async function listAccounts(): Promise<Account[]> {
  const { users } = await authCall<{ users: Account[] }>(
    "admin/list-users?limit=500&sortBy=name&sortDirection=asc",
  );
  return users;
}

export const createAccount = (input: {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}) => authCall("admin/create-user", input);

export const updateAccount = (userId: string, data: { name: string; email: string }) =>
  authCall("admin/update-user", { userId, data });

export const setRole = (userId: string, role: UserRole) =>
  authCall("admin/set-role", { userId, role });

export const deactivateAccount = (userId: string) => authCall("admin/ban-user", { userId });
export const reactivateAccount = (userId: string) => authCall("admin/unban-user", { userId });
export const endSessions = (userId: string) => authCall("admin/revoke-user-sessions", { userId });
