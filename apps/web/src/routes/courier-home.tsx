import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/auth-card";
import { sessionQuery, signOut } from "@/features/auth/session";

/** Where a courier lands until the courier app of feature 003 exists. */
export const Route = createFileRoute("/mensajero")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.query(sessionQuery);
    if (!user) throw redirect({ to: "/ingresar" });
    if (user.role !== "courier") throw redirect({ to: "/" });
    return { user };
  },
  head: () => ({ meta: [{ title: "Mensajero · Domy" }] }),
  component: CourierHome,
});

function CourierHome() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <AuthCard
      title={`Hola, ${user.name}`}
      description="La aplicación del mensajero estará disponible pronto. El panel de despacho es solo para la oficina."
    >
      <Button
        variant="outline"
        onClick={() => {
          void signOut().then(async () => {
            queryClient.clear();
            await navigate({ to: "/ingresar" });
          });
        }}
      >
        Cerrar sesión
      </Button>
    </AuthCard>
  );
}
