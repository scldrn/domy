import { companySettingsInput, type CompanySettings } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import CallIcon from "@material-symbols/svg-400/rounded/call.svg?react";
import ChatIcon from "@material-symbols/svg-400/rounded/chat.svg?react";
import { Icon } from "@/components/icon";
import { QueryErrorAlert } from "@/components/query-state";
import { MasterHeader } from "@/features/master-data/master-page";
import { SearchCombobox } from "@/components/search-combobox";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompanySettings, updateCompanySettings } from "@/features/master-data/api";
import { searchNeighborhoods } from "@/features/shipments/api";
import { ApiError } from "@/lib/api-client";

/**
 * "Configuración": the office address (feature 003, FR-041), reached from the navigation once
 * its form lands (tasks.md T059).
 */
export const Route = createFileRoute("/_panel/configuracion")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "owner") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Configuración · Domy" }] }),
  component: Settings,
});

/**
 * As approved in feature 006 (US5): what recipients see when they ask for help, with its live
 * preview, beside the office returns go back to.
 */
function Settings() {
  const settings = useQuery({ queryKey: ["company-settings"], queryFn: getCompanySettings });
  return (
    <div className="flex flex-col gap-6">
      <MasterHeader
        title="Configuración"
        sentence={[
          {
            text: "Lo que ven los destinatarios cuando piden ayuda, y la oficina a la que vuelven los envíos.",
          },
        ]}
      />
      {settings.isPending && <Skeleton className="h-64" />}
      {settings.isError && (
        <QueryErrorAlert
          title="No pudimos cargar la configuración"
          message="Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => void settings.refetch()}
        />
      )}
      {settings.data && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <SupportForm
            key={`${settings.data.supportPhone ?? ""}|${settings.data.companyName}`}
            settings={settings.data}
          />
          <OfficeForm
            key={`${settings.data.officeAddress ?? ""}|${settings.data.officeNeighborhood?.id ?? ""}`}
            settings={settings.data}
          />
        </div>
      )}
    </div>
  );
}

/** US4 T059: validation uses the same input schema as PATCH; unchanged saves keep receipts. */
function OfficeForm({ settings }: { settings: CompanySettings }) {
  const id = useId();
  const queryClient = useQueryClient();
  const [actionId, setActionId] = useState(() => crypto.randomUUID());
  const [hood, setHood] = useState(settings.officeNeighborhood);
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ defaultValues: { officeAddress: settings.officeAddress ?? "" } });
  const submit = form.handleSubmit(async (values) => {
    const parsed = companySettingsInput.safeParse({
      ...values,
      actionId,
      officeNeighborhoodId: hood?.id,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa la dirección y el barrio.");
      return;
    }
    setError(null);
    try {
      await updateCompanySettings(parsed.data);
      // T106/FR-019: retries keep the key until acknowledgment, then the next save is new.
      setActionId(crypto.randomUUID());
      await queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["master", "audit-events"] });
      toast.success("Configuración guardada");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos guardar la configuración. Intenta de nuevo.",
      );
    }
  });
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-4 rounded-lg border border-outline-variant bg-sheet px-5.5 py-5"
    >
      <div>
        <h2 className="text-title-l text-on-surface">Oficina</h2>
        <p className="mt-1 text-body-m text-on-surface-variant">
          A esta dirección vuelven los envíos que se reciben en la oficina, y los mensajeros la ven
          como parada.
        </p>
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-address`}>Dirección de la oficina</FieldLabel>
        <Input
          id={`${id}-address`}
          {...form.register("officeAddress")}
          disabled={form.formState.isSubmitting}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-hood`}>Barrio de la oficina</FieldLabel>
        <SearchCombobox
          id={`${id}-hood`}
          label="Barrio de la oficina"
          queryKey={["neighborhoods"]}
          search={searchNeighborhoods}
          value={hood}
          onChange={setHood}
          itemKey={(item) => item.id}
          itemLabel={(item) => item.name}
        />
      </Field>
      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={form.formState.isSubmitting} className="self-end">
        Guardar configuración
      </Button>
    </form>
  );
}

function SupportForm({ settings }: { settings: CompanySettings }) {
  const id = useId();
  const queryClient = useQueryClient();
  const [actionId, setActionId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      supportPhone: settings.supportPhone ?? "",
      companyName: settings.companyName,
    },
  });
  const companyName = useWatch({ control: form.control, name: "companyName" });
  const supportPhone = useWatch({ control: form.control, name: "supportPhone" });
  const submit = form.handleSubmit(async (values) => {
    const parsed = companySettingsInput.safeParse({
      actionId,
      supportPhone: values.supportPhone === "" ? null : values.supportPhone,
      companyName: values.companyName,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos de soporte.");
      return;
    }
    setError(null);
    try {
      await updateCompanySettings(parsed.data);
      setActionId(crypto.randomUUID());
      await queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["master", "audit-events"] });
      toast.success("Configuración guardada");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos guardar los datos de soporte. Intenta de nuevo.",
      );
    }
  });

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-4 rounded-lg border border-outline-variant bg-sheet px-5.5 py-5"
    >
      <div>
        <h2 className="text-title-l text-on-surface">Atención al cliente</h2>
        <p className="mt-1 text-body-m text-on-surface-variant">
          Con estos datos los destinatarios llaman o escriben desde su página de seguimiento.
        </p>
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-company-name`}>Nombre de la empresa</FieldLabel>
        <Input
          id={`${id}-company-name`}
          autoComplete="organization"
          {...form.register("companyName")}
          disabled={form.formState.isSubmitting}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-support-phone`}>Celular de soporte</FieldLabel>
        <Input
          id={`${id}-support-phone`}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          aria-describedby={`${id}-phone-help`}
          {...form.register("supportPhone")}
          disabled={form.formState.isSubmitting}
        />
        <p id={`${id}-phone-help`} className="text-body-s text-on-surface-variant">
          Escribe 10 dígitos, sin indicativo del país.
        </p>
      </Field>
      <div
        aria-label="Así lo ve el destinatario"
        role="group"
        className="flex flex-col gap-1.5 rounded-md border border-dashed border-outline bg-surface-container-low p-4"
      >
        <span className="text-label-s font-bold tracking-wide text-on-surface-variant uppercase">
          Así lo ve el destinatario
        </span>
        <span className="text-title-m text-on-surface">¿Necesitas ayuda?</span>
        <span className="text-body-m text-on-surface-variant">
          Contacta a {companyName.trim() || "la empresa"}.
        </span>
        {supportPhone.trim() ? (
          <span aria-hidden="true" className="mt-1 flex flex-wrap gap-2">
            <span
              className={buttonVariants({ variant: "outline", className: "pointer-events-none" })}
            >
              <Icon symbol={CallIcon} size={20} />
              Llamar
            </span>
            <span
              className={buttonVariants({ variant: "outline", className: "pointer-events-none" })}
            >
              <Icon symbol={ChatIcon} size={20} />
              WhatsApp
            </span>
          </span>
        ) : (
          <span className="text-body-m text-on-surface-variant">
            Sin celular de soporte, la página no ofrece llamar ni escribir.
          </span>
        )}
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={form.formState.isSubmitting} className="self-end">
        Guardar datos de soporte
      </Button>
    </form>
  );
}
