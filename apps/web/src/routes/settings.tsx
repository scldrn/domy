import { companySettingsInput, type CompanySettings } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SearchCombobox } from "@/components/search-combobox";
import { Button } from "@/components/ui/button";
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

function Settings() {
  const settings = useQuery({ queryKey: ["company-settings"], queryFn: getCompanySettings });
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Configuración"
        description="La dirección donde se reciben y recogen paquetes en oficina."
      />
      {settings.isPending && <Skeleton className="h-64" />}
      {settings.isError && (
        <p role="alert" className="text-body-l text-error">
          No pudimos cargar la configuración.{" "}
          <Button variant="outline" onClick={() => void settings.refetch()}>
            Reintentar
          </Button>
        </p>
      )}
      {settings.data && (
        <OfficeForm
          key={`${settings.data.officeAddress ?? ""}|${settings.data.officeNeighborhood?.id ?? ""}`}
          settings={settings.data}
        />
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
      className="flex flex-col gap-4 rounded-md border border-outline-variant bg-sheet p-6"
    >
      <h2 className="text-title-l text-on-surface">Oficina</h2>
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
      <Button type="submit" disabled={form.formState.isSubmitting} className="self-start">
        Guardar configuración
      </Button>
    </form>
  );
}
