import {
  recordCorrectionFields,
  recordCorrectionInput,
  recordCorrectionProblem,
  recordRevertInput,
  type CourierRecord,
  type ShipmentDetail,
} from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { correctCourierRecord, revertCourierRecord } from "./api";
import { RecordFields, recordValuesFor, type RecordValues } from "./record-on-behalf-dialog";

/** T076 / FR-035: dispatch corrections never replace the original author or delete the fact. */
export function RecordActions({
  shipment,
  record,
}: {
  shipment: ShipmentDetail;
  record: CourierRecord;
}) {
  const [mode, setMode] = useState<"correct" | "revert" | null>(null);
  const queryClient = useQueryClient();
  if (record.outcome !== "applied" || record.reverted) return null;
  const correctable = recordCorrectionFields[record.kind].length > 0;
  const revertible =
    record.kind === "delivery" || record.kind === "exception" || record.kind === "return";
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {correctable && (
          <Button
            variant="outline"
            onClick={() => {
              setMode("correct");
            }}
          >
            Corregir registro
          </Button>
        )}
        {revertible && (
          <Button
            variant="ghost"
            onClick={() => {
              setMode("revert");
            }}
          >
            Revertir registro
          </Button>
        )}
      </div>
      {mode && (
        <CorrectionForm
          key={mode}
          mode={mode}
          shipment={shipment}
          record={record}
          onClose={() => {
            setMode(null);
          }}
          onSaved={async () => {
            await Promise.all(
              ["shipment", "board", "routes-board", "route", "unassigned"].map((key) =>
                queryClient.invalidateQueries({
                  queryKey: key === "shipment" ? [key, shipment.trackingNumber] : [key],
                }),
              ),
            );
            setMode(null);
          }}
        />
      )}
    </>
  );
}
function CorrectionForm({
  mode,
  shipment,
  record,
  onClose,
  onSaved,
}: {
  mode: "correct" | "revert";
  shipment: ShipmentDetail;
  record: CourierRecord;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const reasonId = useId();
  const [actionId] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [values, setValues] = useState<RecordValues>({
    receivedByName: record.receivedByName ?? "",
    cashAmount: record.cashAmount,
    companyTransferAmount: record.companyTransferAmount,
    merchantTransferAmount: record.merchantTransferAmount,
    exceptionReason: record.exceptionReason ?? "recipient_absent",
    note: record.note ?? "",
    amount: record.disbursementAmount,
    payee: record.payee ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields: readonly string[] = recordCorrectionFields[record.kind].filter(
    (field) => shipment.kind !== "errand" || field !== "receivedByName",
  );
  async function save() {
    const parsed =
      mode === "correct"
        ? recordCorrectionInput.safeParse({ actionId, reason, ...recordValuesFor(fields, values) })
        : recordRevertInput.safeParse({ actionId, reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa el motivo y los datos.");
      return;
    }
    if (mode === "correct") {
      const { actionId: _, reason: __, ...changed } = parsed.data;
      const problem = recordCorrectionProblem(record, changed, shipment.codAmount);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "correct") await correctCourierRecord(record.id, parsed.data);
      else await revertCourierRecord(record.id, parsed.data);
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos guardar el cambio. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle>
            {mode === "correct" ? "Corregir registro" : "Revertir registro"}
          </DialogTitle>
          <DialogDescription>
            {mode === "correct"
              ? "El historial conserva los valores anteriores, tu nombre y el motivo."
              : "El registro se conserva como revertido y deja de contar en los intentos y recaudos. El envío vuelve a quedar pendiente, sin reabrir rutas finalizadas."}
          </DialogDescription>
        </DialogHeader>
        {mode === "correct" && (
          <RecordFields fields={fields} values={values} onChange={setValues} disabled={busy} />
        )}
        <Field>
          <FieldLabel htmlFor={reasonId}>Motivo</FieldLabel>
          <Textarea
            id={reasonId}
            value={reason}
            maxLength={200}
            disabled={busy}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </Field>
        {error && (
          <p role="alert" className="text-body-m text-error">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            {mode === "correct" ? "Guardar corrección" : "Confirmar reversión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
