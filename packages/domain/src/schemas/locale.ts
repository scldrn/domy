import { z } from "zod";

/**
 * Zod's own messages in Spanish (Constitution VII): no English reaches a user, even for an
 * input the screens never send. Every field a person fills keeps a message of its own.
 */
z.config(z.locales.es());
