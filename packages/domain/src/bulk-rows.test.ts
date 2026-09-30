import { describe, expect, it } from "vitest";
import { bulkColumns, parseBulkRow, parseWindowPhrase, readBulkTable } from "./bulk-rows.ts";

/** A row with the given template columns filled. */
function cells(values: Partial<Record<(typeof bulkColumns)[number], string>>): string[] {
  return bulkColumns.map((column) => values[column] ?? "");
}

describe("readBulkTable", () => {
  it("has the 19 columns of the template in order", () => {
    expect(bulkColumns).toHaveLength(19);
    expect(bulkColumns[0]).toBe("Tipo");
    expect(bulkColumns[5]).toBe("Barrio");
    expect(bulkColumns[18]).toBe("Motivo tarifa");
  });

  it("skips the header, detected by the column names in any case and accents", () => {
    const header = bulkColumns.map((column) => column.toUpperCase().replace("É", "E"));
    const result = readBulkTable([header, cells({ Destinatario: "Laura" })]);
    expect(result).toEqual({ rows: [cells({ Destinatario: "Laura" })] });
  });

  it("accepts rows without a header and drops blank rows", () => {
    const result = readBulkTable([cells({ Destinatario: "Laura" }), ["", " "], []]);
    expect(result).toEqual({ rows: [cells({ Destinatario: "Laura" })] });
  });

  it("accepts a header with fewer columns", () => {
    const result = readBulkTable([
      ["Tipo", "Fecha", "Destinatario"],
      ["Entrega", "", "Laura"],
    ]);
    expect(result).toEqual({ rows: [["Entrega", "", "Laura"]] });
  });

  it("rejects unknown or reordered columns (FR-019)", () => {
    expect(
      readBulkTable([
        ["Tipo", "Cliente"],
        ["Entrega", "Amy"],
      ]),
    ).toEqual({
      error: expect.stringContaining("«Cliente»") as string,
    });
    expect(readBulkTable([["Fecha", "Tipo"]])).toHaveProperty("error");
  });

  it("rejects cells beyond the last column", () => {
    const row = [...cells({ Destinatario: "Laura" }), "extra"];
    expect(readBulkTable([row])).toEqual({
      error: expect.stringContaining("La fila 1 tiene más de 19 columnas") as string,
    });
  });

  it("rejects more than 200 rows (FR-019)", () => {
    const rows = Array.from({ length: 201 }, () => cells({ Destinatario: "Laura" }));
    expect(readBulkTable(rows)).toEqual({ error: expect.stringContaining("201") as string });
    expect(readBulkTable(rows.slice(1))).toHaveProperty("rows");
  });

  it("rejects an empty list", () => {
    expect(readBulkTable([])).toHaveProperty("error");
  });
});

describe("parseBulkRow", () => {
  it("reads a delivery with defaults", () => {
    const { row, errors } = parseBulkRow(
      cells({
        Destinatario: "Laura Gómez",
        Teléfono: "300 123-4567",
        Dirección: "Calle 10 # 43-12",
        Barrio: "copàcabana",
        Referencia: "D-254",
      }),
    );
    expect(errors).toEqual({});
    expect(row).toEqual({
      kind: "delivery",
      paymentMode: "merchant_account",
      serviceLevel: "standard",
      recipientName: "Laura Gómez",
      recipientPhone: "3001234567",
      recipientAddress: "Calle 10 # 43-12",
      neighborhood: "copàcabana",
      merchantReference: "D-254",
    });
  });

  it("reads values in any case and without accents", () => {
    const { row, errors } = parseBulkRow(
      cells({
        Tipo: "entrega a TRANSPORTADORA",
        Modalidad: "contraentrega",
        "Valor a recaudar": "$ 85.000",
        Nivel: "EXPRES",
        Tamaño: "pequeno",
        Unidades: "2",
        Tarifa: "20000",
        "Motivo tarifa": "Acordado con el cliente",
      }),
    );
    expect(errors).toEqual({});
    expect(row).toMatchObject({
      kind: "carrier_handoff",
      paymentMode: "cash_on_delivery",
      codAmount: 85000,
      serviceLevel: "express",
      packageSize: "small",
      packageCount: 2,
      fee: 20000,
      feeOverrideReason: "Acordado con el cliente",
    });
  });

  it("reads dates as DD/MM/AAAA", () => {
    expect(parseBulkRow(cells({ Fecha: "2/10/2026" })).row.serviceDate).toBe("2026-10-02");
    expect(parseBulkRow(cells({ Fecha: "31/02/2026" })).errors).toHaveProperty("serviceDate");
    expect(parseBulkRow(cells({ Fecha: "2026-10-02" })).errors).toHaveProperty("serviceDate");
  });

  it("points each unreadable value at its field", () => {
    const { errors } = parseBulkRow(
      cells({
        Tipo: "Domicilio",
        Modalidad: "Efectivo",
        "Valor a recaudar": "85,5",
        Unidades: "0",
        Franja: "temprano",
      }),
    );
    expect(Object.keys(errors).sort()).toEqual(
      ["codAmount", "kind", "packageCount", "paymentMode", "window"].sort(),
    );
    expect(errors["kind"]).toContain("«Domicilio»");
  });
});

describe("parseWindowPhrase", () => {
  it.each([
    ["en la mañana", { preset: "morning" }],
    ["En la tarde", { preset: "afternoon" }],
    ["antes de las 5pm", { preset: "before", end: "17:00" }],
    ["antes de las 5 p. m.", { preset: "before", end: "17:00" }],
    ["antes de las 17:30", { preset: "before", end: "17:30" }],
    ["antes de las 11am", { preset: "before", end: "11:00" }],
    ["después de las 2pm", { preset: "after", start: "14:00" }],
    ["despues de las 2", { preset: "after", start: "14:00" }],
    ["de 1 a 5pm", { preset: "between", start: "13:00", end: "17:00" }],
    ["de 9am a 12pm", { preset: "between", start: "09:00", end: "12:00" }],
    ["entre las 2:30 y las 4pm", { preset: "between", start: "14:30", end: "16:00" }],
  ])("reads «%s»", (phrase, preset) => {
    expect(parseWindowPhrase(phrase)).toEqual(preset);
  });

  it("returns null for anything else", () => {
    expect(parseWindowPhrase("temprano")).toBeNull();
    expect(parseWindowPhrase("antes de las 25")).toBeNull();
  });
});
