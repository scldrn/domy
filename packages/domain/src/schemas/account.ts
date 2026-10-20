import { z } from "zod";
import { userRole } from "./enums.ts";

/** FR-030/032 and research R18: only the declared administrative HTTP inputs. */
const name = z
  .string()
  .refine((value) => value.trim().length > 0, "Escribe el nombre de la cuenta.");
const email = z.email("Escribe un correo válido.");
const userId = z.uuid("El identificador de la cuenta no es válido.");

export const accountCreateInput = z.strictObject({
  name,
  email,
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(128, "La contraseña puede tener hasta 128 caracteres."),
  role: userRole.default("courier"),
});
export type AccountCreateInput = z.input<typeof accountCreateInput>;

export const accountUpdateInput = z.strictObject({
  userId,
  data: z
    .strictObject({ name: name.optional(), email: email.optional() })
    .refine(
      (value) => Object.keys(value).length > 0,
      "Indica el nombre o el correo que quieres cambiar.",
    ),
});
export type AccountUpdateInput = z.input<typeof accountUpdateInput>;

export const accountRoleInput = z.strictObject({ userId, role: userRole });
export const accountTargetInput = z.strictObject({ userId });

// Type-check the fields our wrapper reads; Better Auth validates its remaining native
// options. Bad password attempts are not account creation: do not enforce 8 chars here.
export const passwordSignInInput = z.looseObject({ email, password: z.string() });
