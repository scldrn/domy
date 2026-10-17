import {
  collectionProblem,
  courierRecordKindLabels,
  exceptionReasonLabels,
  exceptionReasons,
  recordCorrectionFields,
  recordOnBehalfInput,
  onBehalfCourierId,
  type ExceptionReason,
  type RecordOnBehalfInput,
  type ShipmentDetail,
} from "@domy/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { OptionSelect } from "@/components/option-select";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { enterCourierRecord } from "./api";

export type RecordValues = {
  receivedByName: string;
  cashAmount: number | null;
  companyTransferAmount: number | null;
  merchantTransferAmount: number | null;
  exceptionReason: ExceptionReason;
  note: string;
  amount: number | null;
  payee: string;
};
export const emptyRecordValues: RecordValues = {
  receivedByName: "",
  cashAmount: 0,
  companyTransferAmount: 0,
  merchantTransferAmount: 0,
  exceptionReason: "recipient_absent",
  note: "",
  amount: null,
  payee: "",
};
const labels = {
  receivedByName: "Quién recibe",
  cashAmount: "Efectivo",
  companyTransferAmount: "Transferencia a la empresa",
  merchantTransferAmount: "Transferencia al cliente",
  note: "Nota",
  amount: "Valor del pago",
  payee: "A quién se pagó",
};

/** US6: correction and entry share labels, controls and domain-declared field applicability. */
export function RecordFields({
  fields,
  values,
  onChange,
  disabled,
}: {
  fields: readonly string[];
  values: RecordValues;
  onChange: (values: RecordValues) => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <fieldset disabled={disabled} className="contents">
      {Object.entries(labels)
        .filter(([field]) => fields.includes(field))
        .map(([field, label]) => {
          const key = field as keyof typeof labels;
          const money =
            key === "cashAmount" ||
            key === "companyTransferAmount" ||
            key === "merchantTransferAmount" ||
            key === "amount";
          return (
            <Field key={key}>
              <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
              {money ? (
                <MoneyInput
                  id={`${id}-${key}`}
                  value={values[key]}
                  onChange={(value) => {
                    onChange({ ...values, [key]: value });
                  }}
                />
              ) : key === "note" ? (
                <Textarea
                  id={`${id}-${key}`}
                  maxLength={200}
                  value={values.note}
                  onChange={(event) => {
                    onChange({ ...values, note: event.target.value });
                  }}
                />
              ) : (
                <Input
                  id={`${id}-${key}`}
                  maxLength={100}
                  value={values[key]}
                  onChange={(event) => {
                    onChange({ ...values, [key]: event.target.value });
                  }}
                />
              )}
            </Field>
          );
        })}
      {fields.includes("exceptionReason") && (
        <Field>
          <OptionSelect
            label="Motivo de la novedad"
            value={values.exceptionReason}
            options={exceptionReasons.map((value) => ({
              value,
              label: exceptionReasonLabels[value],
            }))}
            onChange={(value) => {
              onChange({ ...values, exceptionReason: value });
            }}
          />
        </Field>
      )}
    </fieldset>
  );
}

/** Only optional blank notes are omitted; blank required fields must reach validation (T125). */
export function recordValuesFor(
  fields: readonly string[],
  values: RecordValues,
  requiredNote = false,
) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([field, value]) =>
        fields.includes(field) && (field !== "note" || requiredNote || value !== ""),
    ),
  );
}

export function RecordOnBehalfDialog({ shipment }: { shipment: ShipmentDetail }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const courierId = onBehalfCourierId({
    custodyCourierId: shipment.custodyCourier?.id ?? null,
    route: shipment.route && {
      status: shipment.route.status,
      courierId: shipment.route.courier?.id ?? null,
    },
  });
  return (
    <>
      <Button
        variant="outline"
        disabled={!courierId}
        onClick={() => {
          setOpen(true);
        }}
      >
        Registrar por mensajero
      </Button>
      {open && (
        <EntryForm
          shipment={shipment}
          onClose={() => {
            setOpen(false);
          }}
          onSaved={async () => {
            await Promise.all(
              ["shipment", "board", "routes-board", "route", "unassigned"].map((key) =>
                queryClient.invalidateQueries({
                  queryKey: key === "shipment" ? [key, shipment.trackingNumber] : [key],
                }),
              ),
            );
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
function EntryForm({
  shipment,
  onClose,
  onSaved,
}: {
  shipment: ShipmentDetail;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const id = useId();
  const [recordId] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<RecordOnBehalfInput["kind"]>(
    shipment.kind === "errand" ? "delivery" : "pickup",
  );
  const [values, setValues] = useState<RecordValues>({
    ...emptyRecordValues,
    cashAmount: shipment.codAmount,
  });
  const [occurredAt, setOccurredAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields: readonly string[] = (
    kind === "problem" ? ["note"] : recordCorrectionFields[kind]
  ).filter((field) => shipment.kind !== "errand" || field !== "receivedByName");
  async function save() {
    const { exceptionReason, ...entered } = recordValuesFor(fields, values, kind === "problem");
    const parsed = recordOnBehalfInput.safeParse({
      id: recordId,
      kind,
      ...entered,
      ...(kind === "exception" && { reason: exceptionReason }),
      ...(occurredAt && { occurredAt: new Date(`${occurredAt}-05:00`).toISOString() }),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos del registro.");
      return;
    }
    if (parsed.data.kind === "delivery") {
      const problem = collectionProblem(shipment.codAmount, parsed.data);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await enterCourierRecord(shipment.id, parsed.data);
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos guardar el registro. Intenta de nuevo.",
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
          <DialogTitle>Registrar por mensajero</DialogTitle>
          <DialogDescription>
            A nombre de {(shipment.custodyCourier ?? shipment.route?.courier)?.name}. Quedará
            marcado como «Registrado por despacho».
          </DialogDescription>
        </DialogHeader>
        <Field>
          <OptionSelect
            label="Registro"
            value={kind}
            disabled={busy}
            onChange={(value) => {
              setKind(value);
              setError(null);
            }}
            options={(
              ["pickup", "delivery", "exception", "problem", "return", "disbursement"] as const
            ).map((value) => ({ value, label: courierRecordKindLabels[value] }))}
          />
        </Field>
        <RecordFields fields={fields} values={values} onChange={setValues} disabled={busy} />
        <Field>
          <FieldLabel htmlFor={`${id}-occurred`}>Cuándo ocurrió (opcional)</FieldLabel>
          <Input
            id={`${id}-occurred`}
            type="datetime-local"
            value={occurredAt}
            disabled={busy}
            onChange={(event) => {
              setOccurredAt(event.target.value);
            }}
          />
          <p className="text-body-m text-on-surface-variant">
            Hora de Colombia. Si lo dejas vacío, se registra con la hora actual.
          </p>
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
            Guardar registro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
