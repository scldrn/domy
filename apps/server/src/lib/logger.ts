import pino, { type DestinationStream } from "pino";

/** Structured logs without secrets, cookies, passwords, or recipient phones (Constitution IX). */
export function createLogger(level: string, destination?: DestinationStream) {
  const options = {
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
  };
  return destination ? pino(options, destination) : pino(options);
}
