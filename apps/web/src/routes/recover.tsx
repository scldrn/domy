import { createFileRoute } from "@tanstack/react-router";
import { RecoveryRequest } from "@/features/auth/recovery-request-form";

export const Route = createFileRoute("/recuperar")({
  head: () => ({ meta: [{ title: "Recuperar contraseña · Domy" }] }),
  component: RecoveryRequest,
});
