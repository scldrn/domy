import { useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { sessionQuery } from "@/features/auth/session";
import { replaceMerchantLink } from "@/features/master-data/api";
import { ApiError } from "@/lib/api-client";
import { merchantLinkIntent, type MerchantLinkIntent } from "./merchant-link-intent";
import {
  initialMerchantLinkControlsState,
  merchantLinkControlsReducer,
} from "./merchant-link-controls-state";

type MerchantLinkControlsProps = {
  actorId: string;
  isActive: boolean;
  linkCode: string;
  merchantId: string;
  merchantName: string;
};

export function merchantLinkUrl(publicBaseUrl: string, linkCode: string): string {
  return new URL(`/cliente/${encodeURIComponent(linkCode)}`, publicBaseUrl).toString();
}

export function MerchantLinkControls({
  actorId,
  isActive,
  linkCode,
  merchantId,
  merchantName,
}: MerchantLinkControlsProps) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(
    merchantLinkControlsReducer,
    initialMerchantLinkControlsState,
  );

  async function copyLink() {
    try {
      const url = merchantLinkUrl(import.meta.env.PUBLIC_BASE_URL, linkCode);
      await navigator.clipboard.writeText(url);
      toast.success("Enlace del cliente copiado");
    } catch {
      toast.error(
        "No pudimos copiar el enlace. Revisa el permiso del portapapeles e inténtalo de nuevo.",
      );
    }
  }

  function changeConfirmation(open: boolean) {
    dispatch({ type: open ? "open" : "close" });
  }

  async function confirmReplacement() {
    if (!isActive || state.replacing) return;

    let intent: MerchantLinkIntent;
    try {
      intent = merchantLinkIntent(state.intent, actorId, merchantId);
    } catch {
      dispatch({
        type: "fail",
        message:
          "La sesión cambió. Vuelve a ingresar con la cuenta que inició este reemplazo para reintentarlo.",
      });
      return;
    }

    dispatch({ type: "begin", intent });
    try {
      const currentUser = await queryClient.query({ ...sessionQuery, staleTime: 0 });
      if (!currentUser || currentUser.id !== intent.actorId) {
        dispatch({
          type: "fail",
          message:
            "La sesión cambió. Vuelve a ingresar con la cuenta que inició este reemplazo para reintentarlo.",
        });
        return;
      }

      await replaceMerchantLink(intent.merchantId, { actionId: intent.actionId }, intent.actorId);
      await queryClient.invalidateQueries({ queryKey: ["master"] });
      dispatch({ type: "succeed" });
      toast.success("Enlace reemplazado. El anterior dejó de funcionar.");
    } catch (error) {
      dispatch({
        type: "fail",
        message:
          error instanceof ApiError
            ? error.message
            : "No pudimos confirmar el reemplazo. Intenta de nuevo para comprobar el resultado.",
      });
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-outline-variant bg-sheet p-6">
      <div>
        <h2 className="text-title-m text-on-surface">Enlace del cliente</h2>
        <p className="text-body-m text-on-surface-variant">
          Comparte el enlace para que {merchantName} consulte sus envíos.
        </p>
      </div>
      {!isActive && (
        <p role="status" className="text-body-m text-on-surface-variant">
          Activa el cliente para compartir su enlace.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!isActive || state.intent !== null}
          onClick={() => {
            void copyLink();
          }}
        >
          Copiar enlace del cliente
        </Button>
        <Button
          variant="destructive"
          disabled={!isActive || state.intent !== null}
          onClick={() => {
            changeConfirmation(true);
          }}
        >
          Reemplazar enlace
        </Button>
      </div>

      {state.intent && state.error && (
        <div className="flex flex-col gap-2">
          <p role="status" aria-live="polite" className="text-body-m text-on-surface-variant">
            No pudimos confirmar si el enlace cambió. Reintenta para comprobarlo.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              changeConfirmation(true);
            }}
          >
            Reintentar reemplazo
          </Button>
        </div>
      )}

      <AlertDialog open={state.confirming} onOpenChange={changeConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar el enlace de {merchantName}?</AlertDialogTitle>
            <AlertDialogDescription>
              El enlace actual dejará de funcionar de inmediato. Tendrás que compartir el nuevo
              enlace con el cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {state.error && (
            <p role="alert" className="text-body-m text-error">
              {state.error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={state.replacing}>Volver</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={state.replacing}
              onClick={() => {
                void confirmReplacement();
              }}
            >
              {state.replacing
                ? "Reemplazando…"
                : state.intent && state.error
                  ? "Reintentar reemplazo"
                  : "Reemplazar enlace"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
