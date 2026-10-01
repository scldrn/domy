import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";
import { eq } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import * as schema from "./db/schema/index.ts";
import { users } from "./db/schema/index.ts";

const ac = createAccessControl(defaultStatements);

/** Owner manages users; dispatcher and courier have no user administration (FR-031). */
const roles = {
  owner: ac.newRole(adminAc.statements),
  dispatcher: ac.newRole(userAc.statements),
  courier: ac.newRole(userAc.statements),
};

const sessionDays = 30;

export function createAuth(options: {
  db: Db;
  secret: string;
  baseUrl: string;
  sendResetPassword: (data: { email: string; name: string; url: string }) => Promise<void>;
}) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseUrl,
    basePath: "/api/auth",
    database: drizzleAdapter(options.db, { provider: "pg", schema, usePlural: true }),
    advanced: { database: { generateId: "uuid" } },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      // A completed recovery also lifts a sign-in lock (FR-033).
      onPasswordReset: async ({ user }) => {
        await options.db
          .update(users)
          .set({ failedSignInCount: 0, lockedUntil: null })
          .where(eq(users.id, user.id));
      },
      sendResetPassword: async ({ user, url }) => {
        await options.sendResetPassword({ email: user.email, name: user.name, url });
      },
    },
    session: {
      expiresIn: sessionDays * 24 * 60 * 60,
      disableSessionRefresh: true,
    },
    plugins: [
      admin({
        ac,
        roles,
        adminRoles: ["owner"],
        defaultRole: "courier",
        bannedUserMessage: "Tu cuenta está desactivada. Comunícate con el propietario.",
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
