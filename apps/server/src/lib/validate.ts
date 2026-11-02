import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";
import { AppError } from "./errors.ts";

/** Request validation with the shared schemas; problems become `400 invalid_request` with fields. */
export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".") || "_";
        fields[path] ??= issue.message;
      }
      throw new AppError("invalid_request", { fields });
    }
  });
}

/** True when a database error is the violation of a unique constraint, or of the given one. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const cause = error instanceof Error && "cause" in error ? error.cause : error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    (constraint === undefined ||
      ("constraint_name" in cause && cause.constraint_name === constraint))
  );
}
