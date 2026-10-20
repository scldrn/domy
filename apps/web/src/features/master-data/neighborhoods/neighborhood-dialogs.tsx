import { neighborhoodKindLabels, type NeighborhoodKind } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { OptionSelect } from "@/components/option-select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  addNeighborhood,
  listMunicipalities,
  listRateZones,
  type NeighborhoodOption,
} from "@/features/shipments/api";
import { getNeighborhood, updateNeighborhood } from "../api";
import { FormDialog, splitList } from "../form-dialog";
import { TextField } from "../text-field";

const panelRoute = getRouteApi("/_panel");

function useZones() {
  return useQuery({ queryKey: ["rate-zones"], queryFn: listRateZones });
}

/** Adds a neighborhood with an existing rate zone; a dispatcher's waits for review (FR-026). */
export function AddNeighborhoodDialog() {
  const queryClient = useQueryClient();
  const zones = useZones();
  const municipalities = useQuery({ queryKey: ["municipalities"], queryFn: listMunicipalities });
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [municipalityId, setMunicipalityId] = useState("");
  const [rateZoneId, setRateZoneId] = useState("");

  return (
    <FormDialog
      triggerLabel="Agregar barrio"
      title="Agregar barrio"
      description="Si lo agrega el coordinador, queda pendiente de revisión del propietario."
      submitLabel="Agregar barrio"
      onOpen={() => {
        setKey(crypto.randomUUID());
        setName("");
        setMunicipalityId("");
        setRateZoneId("");
      }}
      onSubmit={async () => {
        await addNeighborhood({ id: key, name, municipalityId, rateZoneId });
        await queryClient.invalidateQueries({ queryKey: ["master", "neighborhoods"] });
        toast.success(`Barrio ${name} agregado`);
      }}
    >
      <TextField label="Nombre del barrio" value={name} onChange={setName} autoFocus />
      <Field>
        <OptionSelect
          label="Municipio"
          value={municipalityId}
          onChange={setMunicipalityId}
          options={(municipalities.data ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          placeholder="Elige el municipio"
        />
      </Field>
      <Field>
        <OptionSelect
          label="Zona tarifaria"
          value={rateZoneId}
          onChange={setRateZoneId}
          options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
          placeholder="Elige la zona"
        />
      </Field>
    </FormDialog>
  );
}

/**
 * State machine managing authoritative detail loading for neighborhood editing (Finding IV-21, 001/T145).
 * Prevents early destructive save while detail is pending or failed; preserves existing variants on name-only edits.
 */
export class NeighborhoodEditState {
  private status: "pending" | "resolved" | "error" = "pending";
  private initialVariants: string[] = [];
  private currentVariants: string = "";
  private variantsDirty: boolean = false;
  private currentName: string = "";

  constructor(initialName: string) {
    this.currentName = initialName;
  }

  isSaveAllowed(): boolean {
    return this.status === "resolved";
  }

  resolveDetail(variants: string[]): void {
    this.status = "resolved";
    this.initialVariants = [...variants];
    if (!this.variantsDirty) {
      this.currentVariants = variants.join(", ");
    }
  }

  failDetail(): void {
    this.status = "error";
  }

  retryDetail(): void {
    this.status = "pending";
  }

  setVariants(text: string): void {
    this.currentVariants = text;
    this.variantsDirty = true;
  }

  setName(name: string): void {
    this.currentName = name;
  }

  getStatus(): "pending" | "resolved" | "error" {
    return this.status;
  }

  getVariantsText(): string {
    return this.currentVariants;
  }

  getEffectiveVariants(): string[] {
    if (!this.isSaveAllowed()) {
      throw new Error("Cannot save while detail is uninitialized or failed");
    }
    if (!this.variantsDirty) {
      return this.initialVariants;
    }
    return splitList(this.currentVariants);
  }
}

/**
 * Edits a neighborhood's name and spelling variants; the owner also changes its kind and
 * rate zone and confirms a dispatcher's addition (FR-026, FR-036).
 */
export function EditNeighborhoodDialog({ place }: { place: NeighborhoodOption }) {
  const queryClient = useQueryClient();
  const { user } = panelRoute.useRouteContext();
  const owner = user.role === "owner";
  const zones = useZones();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(place.name);
  const [variants, setVariants] = useState("");
  const [rateZoneId, setRateZoneId] = useState(place.rateZone.id);
  const [kind, setKind] = useState<NeighborhoodKind>(place.kind);
  const [editState, setEditState] = useState(() => new NeighborhoodEditState(place.name));
  const [status, setStatus] = useState<"pending" | "resolved" | "error">("pending");

  const loadDetail = async (state: NeighborhoodEditState) => {
    setStatus("pending");
    try {
      const detail = await getNeighborhood(place.id);
      state.resolveDetail(detail.variants);
      setVariants(state.getVariantsText());
      setStatus("resolved");
    } catch {
      state.failDetail();
      setStatus("error");
    }
  };

  const handleOpen = () => {
    setKey(crypto.randomUUID());
    setName(place.name);
    setRateZoneId(place.rateZone.id);
    setKind(place.kind);
    const nextState = new NeighborhoodEditState(place.name);
    setEditState(nextState);
    setVariants("");
    void loadDetail(nextState);
  };

  return (
    <FormDialog
      triggerLabel="Editar"
      triggerVariant="ghost"
      title={`Editar ${place.name}`}
      description={
        owner ? undefined : `Zona tarifaria: ${place.rateZone.name}. Solo el propietario la cambia.`
      }
      submitLabel="Guardar cambios"
      submitDisabled={status !== "resolved"}
      onOpen={handleOpen}
      onSubmit={async () => {
        await updateNeighborhood(place.id, {
          actionId: key,
          name,
          variants: editState.getEffectiveVariants(),
          ...(owner && { rateZoneId, kind }),
        });
        await queryClient.invalidateQueries({ queryKey: ["master", "neighborhoods"] });
        toast.success("Barrio actualizado");
      }}
    >
      <TextField
        label="Nombre del barrio"
        value={name}
        onChange={(val) => {
          setName(val);
          editState.setName(val);
        }}
        autoFocus
      />
      {status === "pending" && (
        <p className="text-body-s text-on-surface-variant animate-pulse">
          Cargando variantes registradas…
        </p>
      )}
      {status === "error" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-sm border border-error/30 bg-error/5 p-3 text-body-s text-error"
        >
          <span>No pudimos cargar las variantes del barrio.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              editState.retryDetail();
              void loadDetail(editState);
            }}
          >
            Reintentar
          </Button>
        </div>
      )}
      <TextField
        label="Variantes"
        value={variants}
        disabled={status !== "resolved"}
        onChange={(val) => {
          setVariants(val);
          editState.setVariants(val);
        }}
        description="Otras formas de escribirlo, separadas por comas (por ejemplo «estadio»)."
      />
      {owner && (
        <>
          <Field>
            <OptionSelect
              label="Zona tarifaria"
              value={rateZoneId}
              onChange={setRateZoneId}
              options={(zones.data ?? []).map((zone) => ({ value: zone.id, label: zone.name }))}
            />
          </Field>
          <Field>
            <OptionSelect
              label="Tipo de lugar"
              value={kind}
              onChange={setKind}
              options={(Object.keys(neighborhoodKindLabels) as NeighborhoodKind[]).map((value) => ({
                value,
                label: neighborhoodKindLabels[value],
              }))}
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
