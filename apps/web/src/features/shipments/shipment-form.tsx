import {
  bogotaToday,
  formatCop,
  formatTrackingNumber,
  paymentModeLabels,
  packageSizeLabels,
  packageSizes,
  serviceLevelLabels,
  serviceLevels,
  shipmentCreateInput,
  shipmentUpdateInput,
  shipmentKindLabels,
  codAmountError,
  reason,
  windowFromPreset,
  windowWarnings,
  type Shipment,
} from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import ErrorIcon from "@material-symbols/svg-400/rounded/error.svg?react";
import LockIcon from "@material-symbols/svg-400/rounded/lock.svg?react";
import WarningIcon from "@material-symbols/svg-400/rounded/warning.svg?react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Controller, FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { FormSection } from "@/components/form-section";
import { Icon } from "@/components/icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/option-select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { now } from "@/lib/clock";
import { formatDate, formatWindow } from "@/lib/format";
import {
  createShipment,
  findDuplicates,
  getShipmentByTrackingNumber,
  listCarriers,
  quoteFee,
  updateShipment,
} from "./api";
import { DeliveryWindowField } from "./delivery-window-field";
import { FeeField } from "./fee-field";
import { ChangedFields, ChangedMark } from "./changed-mark";
import { KindPicker } from "./kind-picker";
import { collectsOf, ShipmentSummary, type FormChange } from "./shipment-summary";
import {
  emptyShipmentForm,
  formFieldOf,
  fromShipment,
  pricingNeighborhood,
  shipmentDraftValues,
  shipmentDraftValuesSchema,
  shipmentDraftSnapshotMatchesRoute,
  toCreateInput,
  toUpdateInput,
  windowPresetOf,
  type ShipmentDraftValues,
  type ShipmentFormValues,
  type ShipmentPendingMutation,
} from "./form-values";
import { FormDraftRecovery, IntentReviewAcknowledgement } from "./form-draft-recovery";
import { MerchantCombobox } from "./merchant-combobox";
import { NeighborhoodCombobox } from "./neighborhood-combobox";
import { PaymentModeFields } from "./payment-mode-fields";
import { PickupPointSelect } from "./pickup-point-select";
import { RecipientAutocomplete } from "./recipient-autocomplete";
import {
  useFormDraft,
  type FormDraftSnapshotValidator,
  type ReadyFormDraft,
} from "./use-form-draft";

const shipmentMutationAckSchema = z.object({
  id: z.uuid(),
  trackingNumber: z.string().min(1),
  version: z.number().int().min(1),
});

const sessionExpiredMessage =
  "Tu sesión terminó. Ingresa de nuevo: los datos del formulario se conservan.";

/**
 * Registration of a single shipment (User Story 1) or, given a shipment, its correction
 * (User Story 3). An edit keeps its typed values per shipment version, so a newer version
 * starts from the saved values.
 */
export function ShipmentForm({ shipment }: { shipment?: Shipment }) {
  const emptyValues = useCallback(
    () =>
      shipmentDraftValues(
        shipment ? fromShipment(shipment) : emptyShipmentForm(bogotaToday(now())),
        null,
        false,
        shipment?.version ?? null,
      ),
    [shipment],
  );
  const validateSnapshot = useCallback<FormDraftSnapshotValidator<ShipmentDraftValues>>(
    ({ id, values }) => shipmentDraftSnapshotMatchesRoute(id, values, shipment),
    [shipment],
  );
  const draft = useFormDraft<ShipmentDraftValues>(
    shipment ? `shipment-edit:${shipment.id}` : "shipment",
    emptyValues,
    shipmentDraftValuesSchema,
    shipment ? `shipment-edit:${shipment.id}:${String(shipment.version)}` : undefined,
    validateSnapshot,
  );
  if (draft.status !== "ready") return <FormDraftRecovery draft={draft} />;
  if (draft.initialValues.needsIntentAcknowledgement) {
    const matchingLegacyVersion =
      shipment &&
      draft.sourceKey === `domy:draft:shipment-edit:${shipment.id}:${String(shipment.version)}`
        ? shipment.version
        : null;
    return (
      <IntentReviewAcknowledgement
        raw={draft.sourceRaw}
        title="Este borrador es de una versión anterior"
        description="Conservamos los datos del formulario, pero este borrador no guardó la solicitud exacta pendiente. El envío pudo haberse confirmado antes de cerrar o recargar la página. Descarga una copia y revisa el historial antes de preparar otro intento."
        downloadName="domy-borrador-anterior.txt"
        onAcknowledge={() =>
          void draft.startNew({
            ...draft.initialValues,
            needsIntentAcknowledgement: false,
            pending: null,
            baseVersion: matchingLegacyVersion,
          })
        }
      />
    );
  }
  if (
    shipment &&
    draft.initialValues.pending === null &&
    draft.initialValues.baseVersion !== shipment.version
  ) {
    return <ShipmentEditVersionRecovery draft={draft} shipment={shipment} />;
  }

  return (
    <ShipmentFormBody {...(shipment && { shipment })} draft={draft} emptyValues={emptyValues} />
  );
}

function ShipmentEditVersionRecovery({
  draft,
  shipment,
}: {
  draft: ReadyFormDraft<ShipmentDraftValues>;
  shipment: Shipment;
}) {
  const [downloaded, setDownloaded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  function downloadCopy() {
    const raw = draft.sourceRaw ?? JSON.stringify({ id: draft.id, values: draft.initialValues });
    const blob = new Blob([raw], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "domy-cambios-pendientes.txt";
    anchor.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
    setDownloaded(true);
  }

  return (
    <section className="max-w-3xl space-y-4 rounded-md border border-warning bg-warning-container p-6">
      <div role="alert" className="space-y-3 text-body-l text-on-warning-container">
        <h1 className="text-title-l">El envío cambió desde que guardaste este borrador</h1>
        <p>
          Este borrador corresponde a la versión {draft.initialValues.baseVersion ?? "desconocida"};
          {"; "}la ficha actual es la versión {String(shipment.version)}. No enviaremos estos
          cambios sobre otra versión. Descarga una copia, compara la ficha actual y transcribe los
          cambios necesarios después de cargar los datos del servidor.
        </p>
      </div>
      <Button type="button" variant="outline" onClick={downloadCopy}>
        Descargar copia local
      </Button>
      <label className="flex min-h-12 items-center gap-3 text-body-m text-on-warning-container">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!downloaded}
          onChange={(event) => {
            setConfirmed(event.currentTarget.checked);
          }}
          className="size-5 accent-primary"
        />
        Descargué la copia y entiendo que cargar la versión actual reemplaza el formulario.
      </label>
      <Button
        type="button"
        disabled={!downloaded || !confirmed}
        onClick={() => {
          draft.startNew(
            shipmentDraftValues(fromShipment(shipment), null, false, shipment.version),
          );
        }}
      >
        Cargar datos actuales
      </Button>
    </section>
  );
}

function ShipmentFormBody({
  shipment,
  draft,
  emptyValues,
}: {
  shipment?: Shipment;
  draft: ReadyFormDraft<ShipmentDraftValues>;
  emptyValues: () => ShipmentDraftValues;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<ShipmentFormValues>({ defaultValues: draft.initialValues.form });
  const { control, register, setValue, setError, clearErrors, formState } = form;
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<ShipmentPendingMutation | null>(
    draft.initialValues.pending,
  );
  const [pendingSnapshotRaw, setPendingSnapshotRaw] = useState<string | null>(draft.sourceRaw);
  const [pendingRequiresReview, setPendingRequiresReview] = useState(false);
  const [reviewedPendingRelease, setReviewedPendingRelease] = useState(false);
  const [versionConflict, setVersionConflict] = useState(false);

  const watchedValues = useWatch({ control });
  const values = form.getValues();
  const { save: saveDraft } = draft;
  const baseVersion = draft.initialValues.baseVersion;
  useEffect(() => {
    saveDraft(shipmentDraftValues(form.getValues(), pending, false, baseVersion));
  }, [baseVersion, form, pending, saveDraft, watchedValues]);
  const place = pricingNeighborhood(values);
  const initialPlace = useMemo(
    () => (shipment ? pricingNeighborhood(fromShipment(shipment)) : null),
    [shipment],
  );
  const pricingInputsChanged =
    !shipment ||
    (place?.id ?? null) !== (initialPlace?.id ?? null) ||
    values.serviceLevel !== shipment.serviceLevel;

  const quote = useQuery({
    queryKey: ["fee-quote", values.merchant?.id, values.kind, place?.id, values.serviceLevel],
    queryFn: () =>
      quoteFee({
        merchantId: values.merchant?.id ?? "",
        kind: values.kind,
        neighborhoodId: place?.id ?? null,
        serviceLevel: values.serviceLevel,
        ...(shipment && { registeredAt: shipment.registeredAt }),
      }),
    enabled: Boolean(values.merchant) && (values.kind === "errand" || Boolean(place)),
  });
  const calculatedFee = quote.data?.calculatedFee ?? null;
  const needsManualFee = values.kind === "errand" || (quote.data?.needsManualFee ?? false);

  // Editing: a new rate zone or service level discards an earlier override (US3 scenario 5).
  // T147: Non-pricing edits (e.g. instructions, phone) preserve historical fee and override.
  const rateZoneId = quote.data?.rateZone?.id;
  useEffect(() => {
    if (!shipment || pending !== null || !pricingInputsChanged || rateZoneId === undefined) return;
    if (rateZoneId !== shipment.rateZone?.id || values.serviceLevel !== shipment.serviceLevel) {
      setValue("feeOverridden", false);
      setValue("feeOverrideReason", "");
    }
  }, [shipment, pending, pricingInputsChanged, rateZoneId, values.serviceLevel, setValue]);

  // The fee follows the rate card until the dispatcher overrides it.
  useEffect(() => {
    if (pending !== null || !pricingInputsChanged) return;
    if (!values.feeOverridden && !needsManualFee && calculatedFee !== null) {
      setValue("fee", calculatedFee);
    }
  }, [
    pending,
    pricingInputsChanged,
    calculatedFee,
    needsManualFee,
    values.feeOverridden,
    setValue,
  ]);

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
    select: (trackingNumbers) =>
      trackingNumbers.filter((number) => number !== shipment?.trackingNumber),
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

  async function sendPendingMutation(
    mutation: ShipmentPendingMutation,
    formValues: ShipmentFormValues,
  ) {
    clearErrors();
    if (
      (mutation.operation === "create" && (shipment || mutation.input.id !== draft.id)) ||
      (mutation.operation === "update" &&
        (!shipment ||
          shipment.id !== mutation.shipmentId ||
          mutation.input.actionId !== draft.id ||
          mutation.input.version !== draft.initialValues.baseVersion)) ||
      !shipmentDraftSnapshotMatchesRoute(
        draft.id,
        shipmentDraftValues(formValues, mutation, false, draft.initialValues.baseVersion),
        shipment,
      )
    ) {
      setError("root", {
        message:
          "La solicitud pendiente no coincide con este borrador. Conservamos los datos y no la enviaremos.",
      });
      return;
    }
    const snapshotValues = shipmentDraftValues(
      formValues,
      mutation,
      false,
      draft.initialValues.baseVersion,
    );
    const parsedSnapshot = shipmentDraftValuesSchema.safeParse(snapshotValues);
    if (!parsedSnapshot.success || !draft.save(parsedSnapshot.data)) {
      setError("root", {
        type: "draft-storage",
        message:
          "Tus datos siguen en pantalla, pero no pudimos guardar la solicitud exacta en este navegador. Reintenta el guardado antes de enviar.",
      });
      return;
    }
    const pendingRaw = JSON.stringify({ id: draft.id, values: parsedSnapshot.data });
    setPendingSnapshotRaw(pendingRaw);
    setPending(mutation);
    setPendingRequiresReview(false);
    setReviewedPendingRelease(false);
    try {
      const response =
        mutation.operation === "create"
          ? await createShipment(mutation.input)
          : await updateShipment(mutation.shipmentId, mutation.input);
      const acknowledgement = shipmentMutationAckSchema.safeParse(response);
      const expectedId = mutation.operation === "create" ? mutation.input.id : mutation.shipmentId;
      if (!acknowledgement.success || acknowledgement.data.id !== expectedId) {
        setError("root", {
          message:
            "La respuesta no coincide con la solicitud pendiente. Conservamos la misma solicitud para reintentarla.",
        });
        return;
      }

      const latestUpdatedShipment =
        mutation.operation === "update" && shipment
          ? await getShipmentByTrackingNumber(shipment.trackingNumber)
          : null;
      if (
        latestUpdatedShipment &&
        (latestUpdatedShipment.id !== expectedId ||
          latestUpdatedShipment.version < acknowledgement.data.version)
      ) {
        setError("root", {
          message:
            "La respuesta de actualización no coincide con la ficha actual. Conservamos la solicitud para reintentarla.",
        });
        return;
      }

      let nextValues: ShipmentDraftValues;
      if (mutation.operation === "create") {
        nextValues = emptyValues();
      } else {
        if (!latestUpdatedShipment) {
          setError("root", {
            message:
              "No pudimos cargar el envío actualizado. Conservamos la solicitud para recuperar su resultado.",
          });
          return;
        }
        nextValues = shipmentDraftValues(
          fromShipment(latestUpdatedShipment),
          null,
          false,
          latestUpdatedShipment.version,
        );
      }
      const next = draft.startNew(nextValues);
      setPending(null);
      setPendingSnapshotRaw(null);
      setPendingRequiresReview(false);
      setReviewedPendingRelease(false);
      clearErrors();
      if (mutation.operation === "create") {
        const trackingNumber = formatTrackingNumber(acknowledgement.data.trackingNumber);
        toast.success(`Envío ${trackingNumber} registrado`, {
          action: {
            label: "Ver envío",
            onClick: () => {
              void navigate({
                to: "/envios/$trackingNumber",
                params: { trackingNumber: acknowledgement.data.trackingNumber },
              });
            },
          },
        });
        form.reset(next.values.form);
        if (!next.stored) {
          setError("root", {
            type: "draft-storage",
            message:
              "El envío quedó registrado, pero no pudimos guardar un identificador nuevo. Reintenta el guardado antes de enviar otro.",
          });
        }
        return;
      }

      if (shipment) {
        if (latestUpdatedShipment)
          queryClient.setQueryData(["shipment", shipment.trackingNumber], latestUpdatedShipment);
        toast.success("Cambios guardados");
        await navigate({
          to: "/envios/$trackingNumber",
          params: { trackingNumber: shipment.trackingNumber },
        });
      }
      if (!next.stored) {
        setError("root", {
          type: "draft-storage",
          message:
            "Los cambios quedaron confirmados, pero no pudimos guardar un identificador nuevo para este borrador.",
        });
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "confirmation_required") {
        if (
          draft.save(shipmentDraftValues(formValues, null, false, draft.initialValues.baseVersion))
        ) {
          setPending(null);
          setConfirming(true);
        } else {
          setError("root", {
            type: "draft-storage",
            message:
              "El servidor pidió confirmar, pero no pudimos guardar este estado. Reintenta el guardado antes de continuar.",
          });
        }
      } else if (error instanceof ApiError && error.status === 401) {
        setError("root", { message: sessionExpiredMessage });
      } else if (
        error instanceof ApiError &&
        error.code === "version_conflict" &&
        mutation.operation === "update"
      ) {
        setVersionConflict(true);
        setError("root", { message: error.message });
      } else if (error instanceof ApiError && error.code === "invalid_request") {
        for (const [path, message] of Object.entries(error.fields)) {
          setError(formFieldOf(formValues.kind, path), { message });
        }
        setPendingRequiresReview(true);
        setPendingSnapshotRaw(pendingRaw);
        setError("root", { message: error.message });
      } else {
        setError("root", {
          message:
            error instanceof ApiError
              ? error.message
              : "No pudimos confirmar el resultado. Conservamos la solicitud exacta para reintentarla.",
        });
      }
    }
  }

  function releaseRejectedPending() {
    if (!pending || !pendingRequiresReview) return;
    const values = shipmentDraftValues(
      form.getValues(),
      null,
      false,
      draft.initialValues.baseVersion,
    );
    if (reviewedPendingRelease) {
      if (!draft.save(values)) {
        setError("root", {
          type: "draft-storage",
          message:
            "La nueva intención todavía no quedó guardada. Reintenta el guardado antes de editar o enviar.",
        });
        return;
      }
    } else {
      const next = draft.startNew(values);
      setReviewedPendingRelease(true);
      if (!next.stored) {
        setError("root", {
          type: "draft-storage",
          message:
            "No pudimos guardar la nueva intención. Reintenta el guardado antes de editar o enviar.",
        });
        return;
      }
    }
    setPending(null);
    setPendingSnapshotRaw(null);
    setPendingRequiresReview(false);
    setReviewedPendingRelease(false);
    clearErrors("root");
  }

  async function loadCurrentVersionAfterConflict(mutation: ShipmentPendingMutation) {
    if (!shipment || mutation.operation !== "update") return;
    try {
      const current = await getShipmentByTrackingNumber(shipment.trackingNumber);
      if (current.id !== mutation.shipmentId || current.version <= mutation.input.version) {
        setError("root", {
          message:
            "No encontramos una versión más reciente para cargar. Conservamos los datos y la solicitud pendiente.",
        });
        return;
      }
      if (
        !draft.save(
          shipmentDraftValues(form.getValues(), null, false, draft.initialValues.baseVersion),
        )
      ) {
        setError("root", {
          type: "draft-storage",
          message:
            "No pudimos guardar la decisión local. La solicitud rechazada y tus datos siguen conservados; reintenta el guardado antes de cargar la versión actual.",
        });
        return;
      }
      setPending(null);
      setVersionConflict(false);
      clearErrors();
      queryClient.setQueryData(["shipment", shipment.trackingNumber], current);
    } catch (error) {
      setError("root", {
        message:
          error instanceof ApiError
            ? error.message
            : "No pudimos cargar la versión actual. Conservamos la solicitud rechazada y tus datos.",
      });
    }
  }

  async function save(formValues: ShipmentFormValues, confirmed: boolean) {
    clearErrors();
    if (pending !== null) return;
    if (shipment && draft.initialValues.baseVersion !== shipment.version) {
      setError("root", {
        message: "La versión del envío cambió. Recarga la ficha antes de guardar estos cambios.",
      });
      return;
    }
    const createInput = toCreateInput(formValues, shipment?.id ?? draft.id, confirmed);
    const parsedCreate = shipmentCreateInput.safeParse(createInput);
    if (!parsedCreate.success) {
      for (const issue of parsedCreate.error.issues) {
        const field = formFieldOf(formValues.kind, issue.path.join("."));
        setError(field, { message: issue.message });
      }
      return;
    }
    const codError = codAmountError(formValues.paymentMode, formValues.codAmount);
    if (codError) {
      setError("codAmount", { message: codError });
      return;
    }
    const feeQuoteInputReady =
      Boolean(formValues.merchant) &&
      (formValues.kind === "errand" || Boolean(pricingNeighborhood(formValues)));
    if ((!shipment || pricingInputsChanged) && feeQuoteInputReady && !quote.isSuccess) {
      if (quote.isError) void quote.refetch();
      setError("root", {
        message: quote.isError
          ? "No pudimos verificar la tarifa. Revisa tu conexión antes de enviar el formulario."
          : "Espera a que verifiquemos la tarifa antes de enviar el formulario.",
      });
      return;
    }
    const expectedFee = shipment && !pricingInputsChanged ? shipment.calculatedFee : calculatedFee;
    const feeQuoteReady = shipment && !pricingInputsChanged ? true : quote.isSuccess;
    const parsedFeeReason = reason.safeParse(formValues.feeOverrideReason);
    if (
      feeQuoteReady &&
      (expectedFee === null || formValues.fee !== expectedFee) &&
      !parsedFeeReason.success
    ) {
      const message =
        expectedFee === null && !formValues.feeOverrideReason.trim()
          ? "Escribe el motivo de la tarifa manual."
          : parsedFeeReason.error.issues[0]?.message;
      setError("feeOverrideReason", {
        message: message ?? "Escribe un motivo de al menos 5 caracteres.",
      });
      return;
    }
    let mutation: ShipmentPendingMutation;
    if (shipment) {
      const parsedUpdate = shipmentUpdateInput.safeParse(
        toUpdateInput(parsedCreate.data, formValues, shipment, draft.id),
      );
      if (!parsedUpdate.success) {
        for (const issue of parsedUpdate.error.issues) {
          const field = formFieldOf(formValues.kind, issue.path.join("."));
          setError(field, { message: issue.message });
        }
        return;
      }
      mutation = {
        operation: "update",
        shipmentId: shipment.id,
        input: parsedUpdate.data,
      };
    } else {
      mutation = { operation: "create", input: parsedCreate.data };
    }
    await sendPendingMutation(mutation, formValues);
  }

  /**
   * The domain schema validates in `save`, which marks the fields by hand; those marks are
   * cleared first, or one left on a field that was disabled then (the pickup point before a
   * merchant) would keep `handleSubmit` from ever saving (FR-038).
   */
  const attempt = (confirmed: boolean) => {
    clearErrors();
    return form.handleSubmit((formValues) => save(formValues, confirmed))();
  };

  const today = bogotaToday(now());
  const changes = shipment
    ? shipmentChanges(fromShipment(shipment), values, {
        carriers: carriers.data ?? [],
        points:
          queryClient.getQueryData<{ id: string; label: string }[]>([
            "pickup-points",
            values.merchant?.id,
          ]) ?? [],
      })
    : [];
  const changedFields = new Set(changes.map((change) => change.field));
  const fieldErrorCount = Object.keys(formState.errors).filter((key) => key !== "root").length;
  const submit = (className: string) => (
    <Button
      type="submit"
      variant="accent"
      size="lg"
      className={className}
      disabled={formState.isSubmitting || pending !== null || draft.writeFailed}
    >
      {shipment
        ? formState.isSubmitting
          ? "Guardando…"
          : "Guardar cambios"
        : formState.isSubmitting
          ? "Registrando…"
          : "Registrar envío"}
    </Button>
  );

  return (
    <FormProvider {...form}>
      {pending && pendingRequiresReview ? (
        reviewedPendingRelease ? (
          <section
            role="alert"
            className="max-w-3xl space-y-3 rounded-md border border-warning bg-warning-container p-6"
          >
            <p className="text-body-l text-on-warning-container">
              Ya revisaste el historial. Conservamos los datos, pero la nueva intención todavía no
              quedó guardada en este navegador.
            </p>
            <Button type="button" variant="outline" onClick={releaseRejectedPending}>
              Reintentar guardado
            </Button>
          </section>
        ) : (
          <IntentReviewAcknowledgement
            raw={pendingSnapshotRaw}
            downloadLabel="Descargar solicitud pendiente"
            onAcknowledge={releaseRejectedPending}
          />
        )
      ) : (
        pending && (
          <section className="max-w-3xl space-y-4 rounded-md border border-warning bg-warning-container p-6">
            {versionConflict ? (
              <p role="alert" className="text-body-l text-on-warning-container">
                El servidor rechazó este cambio porque el envío ya tiene otra versión. Tus valores
                siguen visibles y conservados; carga la versión actual para compararlos antes de
                preparar otro cambio.
              </p>
            ) : (
              <p role="status" className="text-body-l text-on-warning-container">
                Hay una solicitud de {pending.operation === "create" ? "registro" : "cambio"} sin
                confirmación. Conservamos sus datos y reintentaremos exactamente la misma solicitud.
              </p>
            )}
            {formState.errors.root && <FieldError errors={[formState.errors.root]} />}
            {draft.writeFailed && (
              <div role="alert" className="space-y-2 text-body-m text-error">
                <p>
                  No pudimos guardar la solicitud pendiente. Primero reintenta su guardado local.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (reviewedPendingRelease) {
                      releaseRejectedPending();
                    } else if (
                      draft.save(
                        shipmentDraftValues(
                          values,
                          pending,
                          false,
                          draft.initialValues.baseVersion,
                        ),
                      )
                    ) {
                      clearErrors("root");
                    }
                  }}
                >
                  Reintentar guardado
                </Button>
              </div>
            )}
            {versionConflict ? (
              <Button
                type="button"
                disabled={formState.isSubmitting || draft.writeFailed}
                onClick={() => void loadCurrentVersionAfterConflict(pending)}
              >
                Cargar versión actual
              </Button>
            ) : (
              <Button
                type="button"
                disabled={formState.isSubmitting || draft.writeFailed}
                onClick={() => void sendPendingMutation(pending, values)}
              >
                {formState.isSubmitting ? "Reintentando…" : "Reintentar solicitud pendiente"}
              </Button>
            )}
          </section>
        )
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void attempt(false);
        }}
        noValidate
        className="flex flex-wrap items-start gap-5"
      >
        <ChangedFields.Provider value={changedFields}>
          <fieldset disabled={pending !== null} className="contents">
            <div className="flex min-w-0 flex-[999_1_35rem] flex-col gap-4">
              <FormSection number={1} title="Tipo de envío">
                {shipment ? (
                  <Locked>{shipmentKindLabels[shipment.kind]}</Locked>
                ) : (
                  <Controller
                    control={control}
                    name="kind"
                    render={({ field }) => (
                      <KindPicker value={field.value} onChange={field.onChange} />
                    )}
                  />
                )}
              </FormSection>

              <FormSection number={2} title="Cliente y recogida">
                <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-4 gap-y-3.5 sm:grid-cols-2">
                  {shipment ? (
                    <Field>
                      <FieldLabel>Cliente</FieldLabel>
                      <Locked>{shipment.merchant.name}</Locked>
                    </Field>
                  ) : (
                    <MerchantCombobox autoFocus />
                  )}
                  <PickupPointSelect freezeDefault={pending !== null} />
                </div>
              </FormSection>

              <FormSection number={3} title={values.kind === "errand" ? "Diligencia" : "Destino"}>
                <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-4 gap-y-3.5 sm:grid-cols-2">
                  {(values.kind === "delivery" || values.kind === "reverse_pickup") && (
                    <>
                      <div className="empty:hidden sm:col-span-2">
                        <RecipientAutocomplete />
                      </div>
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
                      <div className="sm:col-span-2">
                        <NeighborhoodCombobox
                          name="handoffPlace"
                          label="Punto de entrega a transportadora"
                          handoffOnly
                        />
                      </div>
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
                      <TextField
                        name="recipientPhone"
                        label="Teléfono (opcional)"
                        inputMode="tel"
                      />
                    </>
                  )}
                  {values.kind === "errand" && (
                    <Field
                      data-invalid={Boolean(formState.errors.errandDescription)}
                      className="sm:col-span-2"
                    >
                      <FieldLabel htmlFor="errandDescription">
                        Descripción de la diligencia
                        <ChangedMark name="errandDescription" />
                      </FieldLabel>
                      <Textarea id="errandDescription" {...register("errandDescription")} />
                      <FieldError errors={[formState.errors.errandDescription]} />
                    </Field>
                  )}
                </div>
              </FormSection>

              <FormSection number={4} title="Pago y tarifa">
                <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-4 gap-y-3.5 sm:grid-cols-2">
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
                  <div className="border-t border-outline-variant pt-3.5 sm:col-span-2">
                    <FeeField
                      calculatedFee={calculatedFee}
                      needsManualFee={needsManualFee}
                      quoting={quote.isFetching}
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection number={5} title="Detalles">
                <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-4 gap-y-3.5 sm:grid-cols-3">
                  <Field data-invalid={Boolean(formState.errors.serviceDate)}>
                    <FieldLabel htmlFor="serviceDate">
                      Fecha del servicio
                      <ChangedMark name="serviceDate" />
                    </FieldLabel>
                    <Input id="serviceDate" type="date" {...register("serviceDate")} />
                    <FieldError errors={[formState.errors.serviceDate]} />
                  </Field>
                  <div className="sm:col-span-2">
                    <DeliveryWindowField />
                  </div>
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
                  <TextField name="merchantReference" label="Referencia del cliente" />
                  <Field className="sm:col-span-3">
                    <FieldLabel htmlFor="instructions">
                      Indicaciones
                      <ChangedMark name="instructions" />
                    </FieldLabel>
                    <Textarea id="instructions" {...register("instructions")} />
                  </Field>
                </div>
              </FormSection>
            </div>

            <aside
              aria-label={shipment ? "Cambios del envío" : "Resumen del envío"}
              className="sticky top-4 flex max-w-95 min-w-0 flex-[1_1_18.75rem] flex-col gap-3 max-[820px]:static max-[820px]:max-w-none max-[820px]:basis-full"
            >
              <ShipmentSummary
                values={values}
                window={window}
                today={today}
                carrier={
                  carriers.data?.find((carrier) => carrier.id === values.carrierId)?.name ?? null
                }
                {...(shipment && { changes })}
              />
              {(duplicates.data?.length ?? 0) > 0 && (
                <Notice>
                  Posible duplicado: ya hay un envío de este cliente para ese día con{" "}
                  {reference ? "la misma referencia" : "el mismo teléfono"} (
                  {duplicates.data?.map(formatTrackingNumber).join(", ")}).
                </Notice>
              )}
              {warnings.sunday && <Notice>La fecha del servicio es un domingo.</Notice>}
              {warnings.past && <Notice>La franja de entrega ya pasó.</Notice>}
              {!pending && formState.errors.root && <FieldError errors={[formState.errors.root]} />}
              {draft.writeFailed && !reviewedPendingRelease && (
                <div role="alert" className="space-y-2 text-body-m text-error">
                  <p>
                    Tus datos siguen en pantalla. Reintenta el guardado antes de enviar; si el
                    almacenamiento sigue fallando, no enviaremos la solicitud.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (
                        draft.save(
                          shipmentDraftValues(
                            values,
                            pending,
                            false,
                            draft.initialValues.baseVersion,
                          ),
                        )
                      )
                        clearErrors("root");
                    }}
                  >
                    Reintentar guardado
                  </Button>
                </div>
              )}
              <div className="flex flex-col gap-2 max-[820px]:hidden">
                {fieldErrorCount > 0 && (
                  <FieldCountError count={fieldErrorCount} editing={Boolean(shipment)} />
                )}
                {submit("w-full")}
                {shipment && (
                  <Link
                    to="/envios/$trackingNumber"
                    params={{ trackingNumber: shipment.trackingNumber }}
                    className={buttonVariants({ variant: "ghost" })}
                  >
                    Cancelar
                  </Link>
                )}
                <p className="text-center text-body-s text-on-surface-variant">
                  El borrador se guarda en este equipo mientras escribes.
                </p>
              </div>
            </aside>
          </fieldset>
        </ChangedFields.Provider>

        <div className="sticky bottom-0 z-10 -mx-4 hidden w-[calc(100%+2rem)] flex-col gap-2 border-t border-outline-variant bg-sheet px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-10px_24px_-18px] shadow-scrim/45 max-[820px]:flex">
          {fieldErrorCount > 0 && (
            <FieldCountError count={fieldErrorCount} editing={Boolean(shipment)} />
          )}
          <div className="flex items-center gap-3">
            <span className="min-w-0">
              <span className="block text-body-s text-on-surface-variant">El mensajero cobra</span>
              <strong className="block font-bold tabular-nums">
                {formatCop(collectsOf(values))}
              </strong>
            </span>
            {submit("flex-1")}
          </div>
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
                void attempt(true);
              }}
            >
              {shipment ? "Confirmar y guardar" : "Confirmar y registrar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormProvider>
  );
}

/** What a registered shipment keeps: its kind and its client. */
function Locked({ children }: { children: ReactNode }) {
  return (
    <p className="flex min-h-12 items-center gap-2 text-body-l font-semibold text-on-surface">
      <Icon symbol={LockIcon} size={20} className="text-on-surface-variant" />
      {children}
      <span className="sr-only"> (no cambia después de registrar)</span>
    </p>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex gap-2.5 rounded-md bg-warning-container p-3 text-body-m text-on-warning-container"
    >
      <Icon symbol={WarningIcon} size={20} />
      <span>{children}</span>
    </p>
  );
}

/** "Revisa los 3 campos marcados antes de registrar." next to the button. */
function FieldCountError({ count, editing }: { count: number; editing: boolean }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-label-m text-error">
      <Icon symbol={ErrorIcon} size={20} />
      Revisa {count === 1 ? "el campo marcado" : `los ${String(count)} campos marcados`} antes de{" "}
      {editing ? "guardar" : "registrar"}.
    </p>
  );
}

const changeLabels: [keyof ShipmentFormValues, string][] = [
  ["pickupPointId", "Punto de recogida"],
  ["pickupAddress", "Dirección de recogida"],
  ["pickupNeighborhood", "Barrio de recogida"],
  ["recipientName", "Destinatario"],
  ["recipientPhone", "Teléfono"],
  ["recipientAddress", "Dirección"],
  ["recipientNeighborhood", "Barrio"],
  ["handoffPlace", "Punto de entrega a transportadora"],
  ["carrierId", "Transportadora"],
  ["destinationTown", "Municipio de destino"],
  ["errandDescription", "Descripción de la diligencia"],
  ["paymentMode", "Modalidad de pago"],
  ["codAmount", "Valor a recaudar"],
  ["serviceLevel", "Nivel de servicio"],
  ["fee", "Tarifa"],
  ["feeOverrideReason", "Motivo de la tarifa"],
  ["serviceDate", "Fecha del servicio"],
  ["window", "Franja de entrega"],
  ["packageSize", "Tamaño"],
  ["packageCount", "Unidades"],
  ["merchantReference", "Referencia del cliente"],
  ["instructions", "Indicaciones"],
];

/**
 * What the dispatcher changed against the registered shipment, field by field, as the summary
 * lists it ("antes → ahora"); the same fields carry "Cambiado" in the form. Nothing here
 * decides what is saved: the form sends its values as before.
 */
function shipmentChanges(
  before: ShipmentFormValues,
  after: ShipmentFormValues,
  names: { carriers: { id: string; name: string }[]; points: { id: string; label: string }[] },
): (FormChange & { field: string })[] {
  const windowText = (values: ShipmentFormValues) => {
    try {
      const preset = windowPresetOf(values);
      const window = preset ? windowFromPreset(values.serviceDate, preset) : null;
      return (
        formatWindow(
          window?.windowStart?.toISOString() ?? null,
          window?.windowEnd?.toISOString() ?? null,
        ) ?? "Sin franja"
      );
    } catch {
      return "Franja incompleta";
    }
  };
  const show = (key: keyof ShipmentFormValues, values: ShipmentFormValues): string => {
    const value = values[key];
    switch (key) {
      case "pickupPointId":
        return values.pickupPointId === null
          ? "Otra dirección"
          : (names.points.find((point) => point.id === values.pickupPointId)?.label ??
              "Punto de recogida");
      case "pickupNeighborhood":
      case "recipientNeighborhood":
      case "handoffPlace":
        return values[key]?.name ?? "—";
      case "carrierId":
        return names.carriers.find((carrier) => carrier.id === values.carrierId)?.name ?? "—";
      case "paymentMode":
        return paymentModeLabels[values.paymentMode];
      case "serviceLevel":
        return serviceLevelLabels[values.serviceLevel];
      case "codAmount":
      case "fee":
        return formatCop(values[key] ?? 0);
      case "serviceDate":
        return values.serviceDate ? formatDate(values.serviceDate) : "—";
      case "window":
        return windowText(values);
      case "packageSize":
        return values.packageSize ? packageSizeLabels[values.packageSize] : "Sin tamaño";
      default:
        return typeof value === "string" && value.trim() ? value : "—";
    }
  };
  return changeLabels
    .filter(([key]) => show(key, before) !== show(key, after))
    .map(([key, label]) => ({ field: key, label, from: show(key, before), to: show(key, after) }));
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
      <FieldLabel htmlFor={name}>
        {label}
        <ChangedMark name={name} />
      </FieldLabel>
      <Input id={name} aria-invalid={Boolean(error)} {...props} {...register(name)} />
      <FieldError errors={[error]} />
    </Field>
  );
}
