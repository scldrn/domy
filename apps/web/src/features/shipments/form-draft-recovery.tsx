import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RecoverableFormDraft } from "./use-form-draft";

/** Keeps untrusted persisted data away from form consumers until it is recovered explicitly. */
export function FormDraftRecovery<T>({ draft }: { draft: RecoverableFormDraft<T> }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  function downloadCopy() {
    if (draft.status !== "invalid") return;
    const blob = new Blob([draft.raw], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "domy-borrador-recuperacion.txt";
    anchor.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
    setDownloaded(true);
  }

  return (
    <section className="max-w-3xl rounded-md border border-outline-variant bg-sheet p-6">
      {draft.status === "invalid" ? (
        <>
          <div role="alert" className="space-y-3 text-body-l text-on-surface">
            <p>
              El borrador guardado no tiene un formato válido. Descarga una copia local antes de
              descartarlo. Si el último envío quedó sin respuesta, el servidor pudo haberlo
              confirmado; descartar no cancela esa operación.
            </p>
            {draft.discardFailed && (
              <p>
                No pudimos descartar el borrador. Sus datos siguen guardados; revisa el
                almacenamiento del navegador e inténtalo de nuevo.
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={downloadCopy}>
              Descargar copia local
            </Button>
            <Button
              variant="destructive"
              disabled={!downloaded}
              onClick={() => {
                setConfirmDiscard(true);
              }}
            >
              Descartar borrador
            </Button>
          </div>
          <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Descartar el borrador local?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción elimina la copia de este navegador. Si una creación quedó sin
                  respuesta, el envío todavía podría existir en el servidor. Descarga primero la
                  copia si necesitas conservar sus datos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Volver</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    setConfirmDiscard(false);
                    draft.discardInvalid();
                  }}
                >
                  Sí, descartar el borrador
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <div role="alert" className="space-y-3 text-body-l text-on-surface">
          <p>
            No pudimos leer el borrador guardado. No creamos uno nuevo ni enviamos datos. Verifica
            el almacenamiento del navegador e intenta de nuevo.
          </p>
          <Button variant="outline" onClick={draft.retryRead}>
            Reintentar lectura
          </Button>
        </div>
      )}
    </section>
  );
}

/** Requires a local copy and history review before an uncertain intent is replaced. */
export function IntentReviewAcknowledgement({
  raw,
  onAcknowledge,
  title = "La solicitud pendiente necesita revisión",
  description = "El servidor rechazó los datos enviados, pero un intento anterior pudo haber registrado el envío. Conservamos tu información. Descarga la copia local y revisa el historial de envíos. Si ya aparece allí, no prepares otro intento.",
  downloadName = "domy-solicitud-pendiente.txt",
  downloadLabel = "Descargar copia local",
  actionLabel = "Preparar un intento nuevo",
}: {
  raw: string | null;
  onAcknowledge: () => void;
  title?: string;
  description?: string;
  downloadName?: string;
  downloadLabel?: string;
  actionLabel?: string;
}) {
  const [downloaded, setDownloaded] = useState(false);
  const [historyChecked, setHistoryChecked] = useState(false);

  function downloadCopy() {
    if (raw === null) return;
    const blob = new Blob([raw], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadName;
    anchor.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
    setDownloaded(true);
  }

  return (
    <section className="max-w-3xl space-y-4 rounded-md border border-warning bg-warning-container p-6">
      <div role="alert" className="space-y-3 text-body-l text-on-warning-container">
        <h1 className="text-title-l">{title}</h1>
        <p>{description}</p>
      </div>
      <Button type="button" variant="outline" disabled={raw === null} onClick={downloadCopy}>
        {downloadLabel}
      </Button>
      <label className="flex min-h-12 items-center gap-3 text-body-m text-on-warning-container">
        <input
          type="checkbox"
          checked={historyChecked}
          disabled={!downloaded}
          onChange={(event) => {
            setHistoryChecked(event.currentTarget.checked);
          }}
          className="size-5 accent-primary"
        />
        Ya descargué la copia y revisé el historial de envíos.
      </label>
      <Button type="button" disabled={!downloaded || !historyChecked} onClick={onAcknowledge}>
        {actionLabel}
      </Button>
    </section>
  );
}
