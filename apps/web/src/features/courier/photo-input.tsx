import CloseIcon from "@material-symbols/svg-400/rounded/close.svg?react";
import PhotoCameraIcon from "@material-symbols/svg-400/rounded/photo_camera.svg?react";
import { maxPhotosPerKind } from "@domy/domain";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { compressPhoto } from "@/lib/offline/photos";

/** A photo taken for a record, reduced and waiting to be saved with it. */
export type TakenPhoto = { id: string; image: Blob };

/**
 * Photos through the phone's camera, up to three, always skippable (feature 003, research
 * R6, FR-009). A photo that cannot be used is reported and never blocks the record.
 */
export function PhotoInput({
  label,
  photos,
  onChange,
}: {
  label: string;
  photos: TakenPhoto[];
  onChange: (photos: TakenPhoto[]) => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const urls = useMemo(() => photos.map((photo) => URL.createObjectURL(photo.image)), [photos]);
  useEffect(
    () => () => {
      for (const url of urls) URL.revokeObjectURL(url);
    },
    [urls],
  );

  const add = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const image = await compressPhoto(file);
    setBusy(false);
    if (!image) {
      setProblem("No pudimos usar esa foto. Toma otra o sigue sin ella.");
      return;
    }
    setProblem(null);
    onChange([...photos, { id: crypto.randomUUID(), image }]);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label-l text-on-surface" id={`${inputId}-label`}>
        {label}
      </span>
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-labelledby={`${inputId}-label`}>
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative">
              <img
                src={urls[index]}
                alt={`Foto ${String(index + 1)}`}
                className="size-24 rounded-sm border border-outline-variant object-cover"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label={`Quitar la foto ${String(index + 1)}`}
                className="absolute -top-2 -right-2 rounded-full shadow"
                onClick={() => {
                  onChange(photos.filter((each) => each.id !== photo.id));
                }}
              >
                <Icon symbol={CloseIcon} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {photos.length < maxPhotosPerKind && (
        <>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-labelledby={`${inputId}-label`}
            onChange={(event) => {
              const [file] = event.target.files ?? [];
              event.target.value = "";
              void add(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Icon symbol={PhotoCameraIcon} />
            {busy ? "Preparando la foto…" : photos.length === 0 ? "Tomar foto" : "Tomar otra foto"}
          </Button>
        </>
      )}
      {problem && (
        <p role="status" className="text-body-m text-error">
          {problem}
        </p>
      )}
    </div>
  );
}
