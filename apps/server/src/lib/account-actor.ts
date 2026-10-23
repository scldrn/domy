import { z } from "zod";
import { AppError } from "./errors.ts";

const actorId = z.uuid();

/** Binds a persisted account intent to the authenticated session that created it (R19/T132). */
export function assertAccountActor(header: unknown, authenticatedActorId: string): void {
  const expected = actorId.safeParse(header);
  if (!expected.success) {
    throw new AppError("invalid_request", {
      message:
        "No pudimos confirmar la cuenta de esta acción. Actualiza la página e intenta de nuevo.",
    });
  }
  if (expected.data !== authenticatedActorId) throw new AppError("actor_changed");
}
