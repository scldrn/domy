import { betterAuth } from "better-auth";
import { isAPIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import type { Executor } from "./db/client.ts";
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

export type AuthConfig = {
  secret: string;
  baseUrl: string;
  sendResetPassword: (data: { email: string; name: string; url: string }) => Promise<void>;
};

export function createAuth(options: AuthConfig & { db: Executor; logger: Logger }) {
  return betterAuth({
    // R19: native diagnostics can contain attacker-controlled Origin/Referer and SQL args.
    // Keep their level/event through the existing logger; unexpected faults still reach Hono.
    logger: {
      level: "debug",
      log(level) {
        options.logger[level]({ authDiagnostic: true }, "Authentication diagnostic.");
      },
    },
    secret: options.secret,
    baseURL: options.baseUrl,
    basePath: "/api/auth",
    database: drizzleAdapter(options.db, { provider: "pg", schema, usePlural: true }),
    advanced: {
      database: { generateId: "uuid" },
      // SEC-8: Better Auth only sees a Request, never the socket. routes/auth.ts always sets
      // this header to the resolved client address (the trusted proxy's value only when
      // DOMY_TRUSTED_PROXY_IP is the peer, else the native peer); X-Forwarded-For is ignored.
      ipAddress: { ipAddressHeaders: ["x-domy-client-ip"] },
    },
    // R18/T150: native 4xx keep their response; unexpected faults reach Hono's
    // sanitized error handler, not the library's raw SQL/credential console logger.
    onAPIError: {
      onError(error) {
        if (!isAPIError(error) || error.statusCode >= 500) {
          if (error instanceof Error) throw error;
          throw new Error("Unexpected authentication failure");
        }
      },
    },
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
