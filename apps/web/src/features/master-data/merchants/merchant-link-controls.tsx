import AutorenewIcon from "@material-symbols/svg-400/rounded/autorenew.svg?react";
import ChatIcon from "@material-symbols/svg-400/rounded/chat.svg?react";
import CopyIcon from "@material-symbols/svg-400/rounded/content_copy.svg?react";
import LinkIcon from "@material-symbols/svg-400/rounded/link.svg?react";
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
import { Icon } from "@/components/icon";
import { Button, buttonVariants } from "@/components/ui/button";
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
  whatsappPhone: string | null;
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
  whatsappPhone,
}: MerchantLinkControlsProps) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(
    merchantLinkControlsReducer,
    initialMerchantLinkControlsState,
  );

  async function copyLink() {
    try {
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

  const url = merchantLinkUrl(import.meta.env.PUBLIC_BASE_URL, linkCode);
  const whatsapp = whatsappPhone ? new URL(`https://wa.me/57${whatsappPhone}`) : null;
  whatsapp?.searchParams.set(
    "text",
    `Hola, ${merchantName}. En este enlace ves tus envíos del día con Cohex: ${url}`,
  );

  // As approved in feature 006 (US5): the link, copy and WhatsApp, then replacing it apart.
  return (
    <section
      aria-labelledby="enlace-cliente"
      className="flex flex-col gap-3.5 rounded-lg border border-outline-variant bg-sheet px-5.5 py-5"
    >
      <div>
        <h2 id="enlace-cliente" className="text-title-l text-on-surface">
          Enlace del cliente
        </h2>
        <p className="mt-1 text-body-m text-on-surface-variant">
          Con este enlace {merchantName} ve sus envíos del día, sin cuenta ni contraseña.
        </p>
      </div>
      {isActive ? (
        <p className="flex min-h-12 items-center gap-2.5 truncate rounded-sm border border-outline-variant bg-surface-container-low px-3.5 text-body-m font-semibold text-on-surface">
          <Icon symbol={LinkIcon} size={20} className="text-on-surface-variant" />
          <span className="truncate">
            {url.replace(/^https?:\/\//, "").replace(/[^/]{14}$/, "…")}
          </span>
        </p>
      ) : (
        <p role="status" className="text-body-m text-on-surface-variant">
          Activa el cliente para compartir su enlace.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          aria-label="Copiar enlace del cliente"
          disabled={!isActive || state.intent !== null}
          onClick={() => {
            void copyLink();
          }}
        >
          <Icon symbol={CopyIcon} size={20} />
          Copiar
        </Button>
        {whatsapp && isActive && (
          <a
            href={whatsapp.toString()}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <Icon symbol={ChatIcon} size={20} />
            Enviar por WhatsApp
          </a>
        )}
      </div>
      <div className="h-px bg-outline-variant" />
      <p className="text-body-m text-on-surface-variant">
        Si el enlace llegó a quien no debía, reemplázalo: el anterior deja de funcionar.
      </p>
      <Button
        variant="ghost"
        className="self-start text-error hover:text-error"
        disabled={!isActive || state.intent !== null}
        onClick={() => {
          changeConfirmation(true);
        }}
      >
        <Icon symbol={AutorenewIcon} size={20} />
        Reemplazar enlace
      </Button>

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
