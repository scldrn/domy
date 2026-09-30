import pino from "pino";

/** Structured logs without secrets, cookies, passwords, or recipient phones (Constitution IX). */
export function createLogger(level: string) {
  return pino({
    level,
    redact: {
      paths: [
        "req.headers.cookie",
        "req.headers.authorization",
        "password",
        "*.password",
        "newPassword",
        "*.newPassword",
        "recipientPhone",
        "*.recipientPhone",
      ],
      censor: "[oculto]",
    },
  });
}
