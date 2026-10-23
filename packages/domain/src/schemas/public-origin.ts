import { z } from "zod";

/** A canonical HTTP(S) origin with no credentials, path, query, or fragment. */
export const publicOriginSchema = z.string().transform((value, context) => {
  const bareOrigin = /^https?:\/\/[^/?#\\]+\/?$/iu.test(value);
  if (
    !bareOrigin ||
    value.includes("@") ||
    value.trim() !== value ||
    /\s/u.test(value) ||
    /\p{Cc}/u.test(value)
  ) {
    context.addIssue({ code: "custom", message: "Expected a bare HTTP(S) origin" });
    return z.NEVER;
  }

  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.pathname !== "/" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      context.addIssue({ code: "custom", message: "Expected a bare HTTP(S) origin" });
      return z.NEVER;
    }
    return parsed.origin;
  } catch {
    context.addIssue({ code: "custom", message: "Expected a bare HTTP(S) origin" });
    return z.NEVER;
  }
});

export type PublicOrigin = z.infer<typeof publicOriginSchema>;
