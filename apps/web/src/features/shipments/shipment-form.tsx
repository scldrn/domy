import {
  bogotaToday,
  formatTrackingNumber,
  packageSizeLabels,
  packageSizes,
  serviceLevelLabels,
  serviceLevels,
  shipmentCreateInput,
  shipmentKindLabels,
  shipmentKinds,
  windowFromPreset,
  windowWarnings,
} from "@domy/domain";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { Controller, FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/segmented-control";
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
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/option-select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { createShipment, findDuplicates, listCarriers, quoteFee } from "./api";
import { DeliveryWindowField } from "./delivery-window-field";
import { FeeField } from "./fee-field";
import {
  emptyShipmentForm,
  formFieldOf,
  pricingNeighborhood,
  toCreateInput,
  windowPresetOf,
  type ShipmentFormValues,
} from "./form-values";
import { MerchantCombobox } from "./merchant-combobox";
import { NeighborhoodCombobox } from "./neighborhood-combobox";
import { PaymentModeFields } from "./payment-mode-fields";
import { PickupPointSelect } from "./pickup-point-select";
import { RecipientAutocomplete } from "./recipient-autocomplete";
import { useFormDraft } from "./use-form-draft";

const sessionExpiredMessage =
  "Tu sesión terminó. Ingresa de nuevo: los datos del formulario se conservan.";

/** Registration of a single shipment (User Story 1). */
export function ShipmentForm() {
  const navigate = useNavigate();
  const emptyValues = useCallback(() => emptyShipmentForm(bogotaToday(now())), []);
  const draft = useFormDraft("shipment", emptyValues);
  const form = useForm<ShipmentFormValues>({ defaultValues: draft.initialValues });
  const { control, register, setValue, setError, clearErrors, formState } = form;
  const [confirming, setConfirming] = useState(false);

  const values = useWatch({ control }) as ShipmentFormValues;
  const { save: saveDraft } = draft;
  useEffect(() => {
    saveDraft(values);
  }, [values, saveDraft]);
  const place = pricingNeighborhood(values);

  const quote = useQuery({
    queryKey: ["fee-quote", values.merchant?.id, values.kind, place?.id, values.serviceLevel],
    queryFn: () =>
      quoteFee({
        merchantId: values.merchant?.id ?? "",
        kind: values.kind,
        neighborhoodId: place?.id ?? null,
        serviceLevel: values.serviceLevel,
      }),
    enabled: Boolean(values.merchant) && (values.kind === "errand" || Boolean(place)),
  });
  const calculatedFee = quote.data?.calculatedFee ?? null;
  const needsManualFee = values.kind === "errand" || (quote.data?.needsManualFee ?? false);

  // The fee follows the rate card until the dispatcher overrides it.
  useEffect(() => {
    if (!values.feeOverridden && !needsManualFee && calculatedFee !== null) {
      setValue("fee", calculatedFee);
    }
  }, [calculatedFee, needsManualFee, values.feeOverridden, setValue]);

  const carriers = useQuery({
    queryKey: ["carriers"],
    queryFn: listCarriers,
    enabled: values.kind === "carrier_handoff",
  });

  const reference = values.merchantReference.trim();
  const phone = values.recipientPhone.replace(/\D/g, "");
  const duplicates = useQuery({
    queryKey: ["duplicates", values.merchant?.id, values.serviceDate, reference, phone],
    queryFn: () =>
      findDuplicates({
        merchantId: values.merchant?.id ?? "",
        serviceDate: values.serviceDate,
        ...(reference ? { merchantReference: reference } : { recipientPhone: phone }),
      }),
    enabled: Boolean(values.merchant) && (Boolean(reference) || phone.length === 10),
  });

  let window = null;
  try {
    const preset = windowPresetOf(values);
    window = preset ? windowFromPreset(values.serviceDate, preset) : null;
  } catch {
    // Invalid times are reported on save.
  }
  const warnings = values.serviceDate
    ? windowWarnings(values.serviceDate, window, now())
    : { sunday: false, past: false };

  async function save(formValues: ShipmentFormValues, confirmed: boolean) {
    clearErrors();
    const input = toCreateInput(formValues, draft.id, confirmed);
    const parsed = shipmentCreateInput.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = formFieldOf(formValues.kind, issue.path.join("."));
        setError(field, { message: issue.message });
      }
      return;
    }
    try {
      const shipment = await createShipment(input);
      const trackingNumber = formatTrackingNumber(shipment.trackingNumber);
      toast.success(`Envío ${trackingNumber} registrado`, {
        action: {
          label: "Ver envío",
          onClick: () => {
            void navigate({
              to: "/envios/$trackingNumber",
              params: { trackingNumber: shipment.trackingNumber },
            });
          },
        },
      });
      const next = draft.startNew();
      form.reset(next.values);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setError("root", { message: "No pudimos guardar el envío. Intenta de nuevo." });
      } else if (error.code === "confirmation_required") {
        setConfirming(true);
      } else if (error.code === "invalid_request") {
        for (const [path, message] of Object.entries(error.fields)) {
          setError(formFieldOf(formValues.kind, path), { message });
        }
      } else if (error.status === 401) {
        setError("root", { message: sessionExpiredMessage });
      } else {
        setError("root", { message: error.message });
      }
    }
  }

  const submit = form.handleSubmit((formValues) => save(formValues, false));

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => void submit(event)}
        noValidate
        className="grid max-w-5xl gap-8 lg:grid-cols-2"
      >
        <FieldSet className="lg:col-span-2">
          <FieldLegend>Tipo de envío</FieldLegend>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <SegmentedControl
                label="Tipo de envío"
                value={field.value}
                onChange={field.onChange}
                options={shipmentKinds.map((value) => ({
                  value,
                  label: shipmentKindLabels[value],
                }))}
              />
            )}
          />
        </FieldSet>

        <FieldSet>
          <FieldLegend>Cliente y recogida</FieldLegend>
          <FieldGroup>
            <MerchantCombobox autoFocus />
            <PickupPointSelect />
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>{values.kind === "errand" ? "Diligencia" : "Destino"}</FieldLegend>
          <FieldGroup>
            {(values.kind === "delivery" || values.kind === "reverse_pickup") && (
              <>
                <RecipientAutocomplete />
                <TextField name="recipientName" label="Nombre del destinatario" />
                <TextField
                  name="recipientPhone"
                  label="Teléfono"
                  inputMode="tel"
                  autoComplete="off"
                />
                <TextField
                  name="recipientAddress"
                  label={
                    values.kind === "reverse_pickup"
                      ? "Dirección donde se recoge"
                      : "Dirección de entrega"
                  }
                />
                <NeighborhoodCombobox name="recipientNeighborhood" label="Barrio" />
              </>
            )}
            {values.kind === "carrier_handoff" && (
              <>
                <NeighborhoodCombobox
                  name="handoffPlace"
                  label="Punto de entrega a transportadora"
                  handoffOnly
                />
                <Controller
                  control={control}
                  name="carrierId"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <OptionSelect
                        label="Transportadora"
                        value={field.value}
                        onChange={field.onChange}
                        options={(carriers.data ?? []).map((carrier) => ({
                          value: carrier.id,
                          label: carrier.name,
                        }))}
                        placeholder="Elige la transportadora"
                        invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <TextField name="destinationTown" label="Municipio de destino" />
                <TextField name="recipientName" label="Destinatario (opcional)" />
                <TextField name="recipientPhone" label="Teléfono (opcional)" inputMode="tel" />
              </>
            )}
            {values.kind === "errand" && (
              <Field data-invalid={Boolean(formState.errors.errandDescription)}>
                <FieldLabel htmlFor="errandDescription">Descripción de la diligencia</FieldLabel>
                <Textarea id="errandDescription" {...register("errandDescription")} />
                <FieldError errors={[formState.errors.errandDescription]} />
              </Field>
            )}
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Pago y tarifa</FieldLegend>
          <FieldGroup>
            <PaymentModeFields />
            <Controller
              control={control}
              name="serviceLevel"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Nivel de servicio</FieldLabel>
                  <SegmentedControl
                    label="Nivel de servicio"
                    value={field.value}
                    onChange={field.onChange}
                    options={serviceLevels.map((value) => ({
                      value,
                      label: serviceLevelLabels[value],
                    }))}
                  />
                </Field>
              )}
            />
            <FeeField
              calculatedFee={calculatedFee}
              needsManualFee={needsManualFee}
              quoting={quote.isFetching}
            />
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Detalles</FieldLegend>
          <FieldGroup>
            <Field data-invalid={Boolean(formState.errors.serviceDate)}>
              <FieldLabel htmlFor="serviceDate">Fecha del servicio</FieldLabel>
              <Input id="serviceDate" type="date" {...register("serviceDate")} />
              <FieldError errors={[formState.errors.serviceDate]} />
            </Field>
            <DeliveryWindowField />
            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={control}
                name="packageSize"
                render={({ field }) => (
                  <Field>
                    <OptionSelect
                      label="Tamaño"
                      value={field.value}
                      onChange={field.onChange}
                      options={packageSizes.map((value) => ({
                        value,
                        label: packageSizeLabels[value],
                      }))}
                      placeholder="Sin tamaño"
                    />
                  </Field>
                )}
              />
              <TextField name="packageCount" label="Unidades" type="number" min={1} />
            </div>
            <TextField name="merchantReference" label="Referencia del cliente" />
            <Field>
              <FieldLabel htmlFor="instructions">Indicaciones</FieldLabel>
              <Textarea id="instructions" {...register("instructions")} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <div className="flex flex-col gap-3 lg:col-span-2">
          {(duplicates.data?.length ?? 0) > 0 && (
            <p
              role="status"
              className="rounded-sm bg-warning-container p-3 text-body-m text-on-warning-container"
            >
              Posible duplicado: ya hay un envío de este cliente para ese día con{" "}
              {reference ? "la misma referencia" : "el mismo teléfono"} (
              {duplicates.data?.map(formatTrackingNumber).join(", ")}).
            </p>
          )}
          {warnings.sunday && (
            <p
              role="status"
              className="rounded-sm bg-warning-container p-3 text-body-m text-on-warning-container"
            >
              La fecha del servicio es un domingo.
            </p>
          )}
          {warnings.past && (
            <p
              role="status"
              className="rounded-sm bg-warning-container p-3 text-body-m text-on-warning-container"
            >
              La franja de entrega ya pasó.
            </p>
          )}
          {formState.errors.root && <FieldError errors={[formState.errors.root]} />}
          <Button type="submit" size="lg" className="self-start" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? "Registrando…" : "Registrar envío"}
          </Button>
        </div>
      </form>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmas los valores?</AlertDialogTitle>
            <AlertDialogDescription>
              La tarifa supera $ 100.000 o el valor a recaudar supera $ 2.000.000.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                void form.handleSubmit((formValues) => save(formValues, true))();
              }}
            >
              Confirmar y registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormProvider>
  );
}

type TextFieldName =
  | "recipientName"
  | "recipientPhone"
  | "recipientAddress"
  | "destinationTown"
  | "merchantReference"
  | "packageCount";

function TextField({
  name,
  label,
  ...props
}: { name: TextFieldName; label: string } & Omit<ComponentProps<typeof Input>, "name">) {
  const { register, formState } = useFormContext<ShipmentFormValues>();
  const error = formState.errors[name];
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} aria-invalid={Boolean(error)} {...props} {...register(name)} />
      <FieldError errors={[error]} />
    </Field>
  );
}
