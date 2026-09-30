import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm, useFormContext } from "react-hook-form";
import { z } from "zod";
import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/option-select";
import { ApiError } from "@/lib/api-client";
import {
  addNeighborhood,
  listMunicipalities,
  listRateZones,
  searchNeighborhoods,
  type NeighborhoodOption,
} from "./api";
import type { ShipmentFormValues } from "./form-values";

const handoffKinds = new Set(["terminal", "airport", "carrier_office"]);

type NeighborhoodField = "recipientNeighborhood" | "pickupNeighborhood" | "handoffPlace";

/**
 * A place from the catalog, tolerant to accents, case, and spelling variants (FR-005). The
 * rate zone follows from it. Dispatchers can add a missing neighborhood (FR-036).
 */
export function NeighborhoodCombobox({
  name,
  label,
  handoffOnly = false,
}: {
  name: NeighborhoodField;
  label: string;
  handoffOnly?: boolean;
}) {
  const { control } = useFormContext<ShipmentFormValues>();
  const [adding, setAdding] = useState(false);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <SearchCombobox<NeighborhoodOption>
            id={name}
            label={label}
            queryKey={["neighborhoods", handoffOnly]}
            search={async (q) =>
              (await searchNeighborhoods(q)).filter(
                (place) => !handoffOnly || handoffKinds.has(place.kind),
              )
            }
            value={field.value}
            onChange={field.onChange}
            itemKey={(place) => place.id}
            itemLabel={(place) => place.name}
            renderItem={(place) => (
              <span className="flex w-full items-baseline justify-between gap-4">
                <span>{place.name}</span>
                <span className="text-body-s text-on-surface-variant">
                  {place.municipality.name} · {place.rateZone.name}
                </span>
              </span>
            )}
            placeholder={handoffOnly ? "Terminal, aeropuerto u oficina" : "Barrio o municipio"}
            emptyText="No está en el catálogo"
            invalid={fieldState.invalid}
            footer={
              handoffOnly ? undefined : (
                <Button
                  variant="ghost"
                  className="m-1 w-[calc(100%-0.5rem)] justify-start"
                  onClick={() => {
                    setAdding(true);
                  }}
                >
                  Agregar barrio al catálogo
                </Button>
              )
            }
          />
          {field.value && (
            <p className="text-body-s text-on-surface-variant">
              {field.value.municipality.name} · Zona {field.value.rateZone.name}
            </p>
          )}
          <FieldError errors={[fieldState.error]} />
          <AddNeighborhoodDialog
            open={adding}
            onOpenChange={setAdding}
            onAdded={(place) => {
              field.onChange(place);
              setAdding(false);
            }}
          />
        </Field>
      )}
    />
  );
}

const addSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del barrio."),
  municipalityId: z.string().min(1, "Elige el municipio."),
  rateZoneId: z.string().min(1, "Elige la zona tarifaria."),
});

function AddNeighborhoodDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (place: NeighborhoodOption) => void;
}) {
  const queryClient = useQueryClient();
  const municipalities = useQuery({ queryKey: ["municipalities"], queryFn: listMunicipalities });
  const zones = useQuery({ queryKey: ["rate-zones"], queryFn: listRateZones });
  const [id] = useState(() => crypto.randomUUID());
  const form = useForm<z.infer<typeof addSchema>>({
    resolver: zodResolver(addSchema),
    defaultValues: { name: "", municipalityId: "", rateZoneId: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const place = await addNeighborhood({ id, ...values });
      await queryClient.invalidateQueries({ queryKey: ["neighborhoods"] });
      onAdded(place);
    } catch (error) {
      form.setError("root", {
        message: error instanceof ApiError ? error.message : "No pudimos agregar el barrio.",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar barrio</DialogTitle>
          <DialogDescription>
            El propietario lo revisará antes de confirmarlo en el catálogo.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={Boolean(form.formState.errors.name)}>
            <FieldLabel htmlFor="new-neighborhood-name">Nombre</FieldLabel>
            <Input id="new-neighborhood-name" {...form.register("name")} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          {(
            [
              ["municipalityId", "Municipio", municipalities.data],
              ["rateZoneId", "Zona tarifaria", zones.data],
            ] as const
          ).map(([fieldName, fieldLabel, options]) => (
            <Controller
              key={fieldName}
              control={form.control}
              name={fieldName}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <OptionSelect
                    label={fieldLabel}
                    value={field.value}
                    onChange={field.onChange}
                    options={(options ?? []).map((option) => ({
                      value: option.id,
                      label: option.name,
                    }))}
                    placeholder="Elige una opción"
                    invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          ))}
          {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}
        </FieldGroup>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={form.formState.isSubmitting}>
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
