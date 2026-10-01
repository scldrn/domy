import type { Logger } from "pino";
import { Resend } from "resend";

export type ResetEmail = { email: string; name: string; url: string };

/**
 * Transactional email through Resend (research R5). In tests the messages are kept in
 * memory; in development without an API key the link is logged so it can be followed.
 */
export function createMailer(options: {
  nodeEnv: "development" | "test" | "production";
  apiKey: string | undefined;
  from: string;
  logger: Logger;
}) {
  const outbox: ResetEmail[] = [];
  if (options.nodeEnv === "production" && !options.apiKey) {
    throw new Error("RESEND_API_KEY is required in production to send recovery emails");
  }
  const resend = options.apiKey ? new Resend(options.apiKey) : null;

  /** The single-use recovery link, valid for 60 minutes (FR-030). */
  async function sendResetPassword(message: ResetEmail): Promise<void> {
    if (options.nodeEnv === "test") {
      outbox.push(message);
      return;
    }
    if (!resend) {
      options.logger.info({ url: message.url }, "password reset link (email not configured)");
      return;
    }
    const text = [
      `Hola, ${message.name}:`,
      "",
      "Recibimos una solicitud para restablecer tu contraseña de Domy. Usa este enlace en los próximos 60 minutos; solo funciona una vez:",
      "",
      message.url,
      "",
      "Si no la pediste, ignora este correo: tu contraseña no cambia.",
      "",
      "Cohex",
    ].join("\n");
    const { error } = await resend.emails.send({
      from: options.from,
      to: message.email,
      subject: "Restablece tu contraseña de Domy",
      text,
    });
    // The screen answers the same whether or not the email exists, so a failure is only logged.
    if (error) options.logger.error({ err: error }, "password reset email failed");
  }

  return { sendResetPassword, outbox };
}
