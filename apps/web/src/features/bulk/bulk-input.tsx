import UploadIcon from "@material-symbols/svg-400/rounded/upload_file.svg?react";
import Papa from "papaparse";
import { readSheet, type CellValue } from "read-excel-file/browser";
import { useId } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/** Rows as text: tab-separated like a spreadsheet copy, quoted where a cell needs it. */
export function rowsToText(rows: string[][]): string {
  return Papa.unparse(rows, { delimiter: "\t", newline: "\n" });
}

/** Rows pasted from a spreadsheet or chat; tabs or commas are detected (research R11). */
export function textToRows(text: string): string[][] {
  return Papa.parse<string[]>(text, { skipEmptyLines: "greedy" }).data;
}

function cellText(value: CellValue | null): string {
  if (value instanceof Date) {
    // Spreadsheet dates carry no time zone; their UTC day is the day typed.
    const day = String(value.getUTCDate()).padStart(2, "0");
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${String(value.getUTCFullYear())}`;
  }
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";
}

async function readFile(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const data = await readSheet(file);
    return data.map((row) => row.map(cellText));
  }
  return textToRows(await file.text());
}

/**
 * The list to register: pasted into the text area or read from an uploaded `.xlsx` or
 * `.csv` file, which fills the text area so the rows can be corrected there (FR-019).
 */
export function BulkInput({
  text,
  onTextChange,
  onFileRead,
  onFileError,
}: {
  text: string;
  onTextChange: (text: string) => void;
  onFileRead: (rows: string[][]) => void;
  onFileError: (message: string) => void;
}) {
  const textId = useId();
  const fileId = useId();
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor={textId}>Filas</FieldLabel>
        <Textarea
          id={textId}
          value={text}
          onChange={(event) => {
            onTextChange(event.target.value);
          }}
          rows={8}
          spellCheck={false}
          className="text-body-m"
          placeholder="Pega aquí las filas copiadas de la hoja de cálculo, con o sin la fila de títulos."
        />
        <FieldDescription>
          Usa las columnas de la plantilla:{" "}
          <a className="text-primary underline" href="/plantilla-envios.xlsx" download>
            Excel
          </a>{" "}
          o{" "}
          <a className="text-primary underline" href="/plantilla-envios.csv" download>
            CSV
          </a>
          . Hasta 200 filas por lista.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={fileId}>Subir archivo</FieldLabel>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id={fileId}
            type="file"
            accept=".xlsx,.csv"
            className="peer sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              readFile(file).then(onFileRead, () => {
                onFileError("No pudimos leer el archivo. Usa la plantilla en Excel (.xlsx) o CSV.");
              });
            }}
          />
          <label
            htmlFor={fileId}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-strong",
            )}
          >
            <Icon symbol={UploadIcon} size={20} />
            Elegir archivo
          </label>
          <span className="text-body-m text-on-surface-variant">
            Excel (.xlsx) o CSV con las columnas de la plantilla.
          </span>
        </div>
      </Field>
    </div>
  );
}
