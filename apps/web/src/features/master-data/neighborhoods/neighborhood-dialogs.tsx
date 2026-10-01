import { neighborhoodKindLabels, type NeighborhoodKind } from "@domy/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { OptionSelect } from "@/components/option-select";
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
 * Edits a neighborhood's name and spelling variants; the owner also changes its kind and
 * rate zone and confirms a dispatcher's addition (FR-026, FR-036).
 */
export function EditNeighborhoodDialog({ place }: { place: NeighborhoodOption }) {
  const queryClient = useQueryClient();
  const { user } = panelRoute.useRouteContext();
  const owner = user.role === "owner";
  const zones = useZones();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [variants, setVariants] = useState("");
  const [rateZoneId, setRateZoneId] = useState("");
  const [kind, setKind] = useState<NeighborhoodKind>("neighborhood");

  return (
    <FormDialog
      triggerLabel="Editar"
      triggerVariant="ghost"
      title={`Editar ${place.name}`}
      description={
        owner ? undefined : `Zona tarifaria: ${place.rateZone.name}. Solo el propietario la cambia.`
      }
      submitLabel="Guardar cambios"
      onOpen={() => {
        setKey(crypto.randomUUID());
        setName(place.name);
        setRateZoneId(place.rateZone.id);
        setKind(place.kind);
        setVariants("");
        void getNeighborhood(place.id).then((detail) => {
          setVariants(detail.variants.join(", "));
        });
      }}
      onSubmit={async () => {
        await updateNeighborhood(place.id, {
          actionId: key,
          name,
          variants: splitList(variants),
          ...(owner && { rateZoneId, kind }),
        });
        await queryClient.invalidateQueries({ queryKey: ["master", "neighborhoods"] });
        toast.success("Barrio actualizado");
      }}
    >
      <TextField label="Nombre del barrio" value={name} onChange={setName} autoFocus />
      <TextField
        label="Variantes"
        value={variants}
        onChange={setVariants}
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
