import { z } from "zod";
import { createDb } from "../../src/db/client.ts";
import { createTestApp } from "../setup/app.ts";

const url = z.url().parse(process.env["DATABASE_URL"]);
const mode = z.enum(["redirect", "callback", "same-origin"]).parse(process.argv[2]);
const db = createDb(url);
try {
  const app = createTestApp(db);
  const account = await app.signIn("dispatcher");
  const context = await app.auth.$context;
  const response =
    mode === "callback"
      ? await app.app.request(
          "http://localhost:3000/api/auth/reset-password/invalid?callbackURL=https%3A%2F%2Fforeign.example.invalid%2Fx",
        )
      : await app.request("/api/auth/request-password-reset", {
          method: "POST",
          body: {
            email: account.email,
            redirectTo:
              mode === "redirect" ? "https://foreign.example.invalid/steal" : "/restablecer",
          },
        });
  let callbackStatus: number | undefined;
  let callbackOrigin: string | undefined;
  if (mode === "same-origin") {
    const link = app.emails[0]?.url;
    if (!link) throw new Error("Expected captured synthetic recovery link");
    const callback = await app.app.request(link);
    callbackStatus = callback.status;
    callbackOrigin = new URL(callback.headers.get("location") ?? "", "http://localhost:3000")
      .origin;
  }
  console.log(
    JSON.stringify({
      originCheckEnabled: context.skipOriginCheck === false,
      status: response.status,
      redirected: response.headers.has("location"),
      mailCount: app.emails.length,
      callbackStatus,
      callbackOrigin,
    }),
  );
} finally {
  await db.$client.end();
}
