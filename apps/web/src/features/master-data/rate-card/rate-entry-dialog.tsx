import { bogotaToday, rateEntryKindLabels, type RateEntryKind } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/money-input";
import { OptionSelect } from "@/components/option-select";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { listRateZones } from "@/features/shipments/api";
import { now } from "@/lib/clock";
import { addRateCardEntry } from "../api";
import { FormDialog } from "../form-dialog";

/**
 * Adds a rate card entry from a day on, standard or for one merchant (FR-028). Entries are
 * never edited: a correction is a new entry for the same day, which wins.
 */
export function RateEntryDialog({ merchant }: { merchant: { id: string; name: string } | null }) {
  const queryClient = useQueryClient();
  const zones = useQuery({ queryKey: ["rate-zones"], queryFn: listRateZones });
  const amountId = useId();
  const dateId = useId();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<RateEntryKind>("zone_rate");
  const [rateZoneId, setRateZoneId] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState("");

  return (
    <FormDialog
      triggerLabel="Nueva tarifa"
      title={merchant ? `Nueva tarifa para ${merchant.name}` : "Nueva tarifa estándar"}
      description="Rige desde las 12:00 a. m. del día elegido. Las tarifas no se editan: para corregir una, agrega otra con la misma fecha."
      submitLabel="Guardar tarifa"
      onOpen={() => {
        setKey(crypto.randomUUID());
        setKind("zone_rate");
        setRateZoneId("");
        setAmount(null);
        setEffectiveFrom(bogotaToday(now()));
      }}
      onSubmit={async () => {
        await addRateCardEntry({
          id: key,
          kind,
          merchantId: merchant?.id ?? null,
          rateZoneId: kind === "zone_rate" ? rateZoneId || null : null,
          amount: amount ?? -1,
          effectiveFrom,
        });
        await queryClient.invalidateQueries({ queryKey: ["master", "rate-card"] });
        toast.success("Tarifa guardada");
      }}
    >
      <Field>
        <OptionSelect
          label="Tipo"
          value={kind}
          onChange={setKind}
          options={(Object.keys(rateEntryKindLabels) as RateEntryKind[]).map((value) => ({
            value,
            label: rateEntryKindLabels[value],
          }))}
        />
      </Field>
      {kind === "zone_rate" && (
        <Field>
          <OptionSelect
            label="Zona"
            value={rateZoneId}
            onChange={setRateZoneId}
            options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
            placeholder="Elige la zona"
          />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor={amountId}>Valor</FieldLabel>
        <MoneyInput id={amountId} value={amount} onChange={setAmount} />
        {kind === "express_surcharge" && (
          <FieldDescription>
            Se suma a la tarifa de zona en los envíos exprés; puede ser $ 0.
          </FieldDescription>
        )}
      </Field>
      <Field>
        <FieldLabel htmlFor={dateId}>Vigente desde</FieldLabel>
        <Input
          id={dateId}
          type="date"
          min={bogotaToday(now())}
          value={effectiveFrom}
          onChange={(event) => {
            setEffectiveFrom(event.target.value);
          }}
        />
      </Field>
    </FormDialog>
  );
}
