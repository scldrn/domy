import { bogotaToday } from "./bogota-time.ts";
import type { CourierRecordKind, RecordOutcome } from "./courier-records.ts";

/**
 * "Mi día" (feature 003, FR-037): the courier's day from their own records, computed the same
 * way on the server and on the phone, where records still to synchronize are included. It is
 * an estimate until the cash-up of Phase 2.
 */

export type SummaryRecord = {
  kind: CourierRecordKind;
  outcome: RecordOutcome;
  reverted: boolean;
  occurredAt: Date;
  cashAmount: number;
  companyTransferAmount: number;
  merchantTransferAmount: number;
  disbursementAmount: number;
};

export type DaySummary = {
  date: string;
  deliveries: number;
  exceptions: number;
  returns: number;
  pendingStops: number;
  cash: number;
  companyTransfer: number;
  merchantTransfer: number;
  disbursements: number;
  /** Cash collected minus disbursements; negative when the company owes the courier. */
  cashToHandOver: number;
};

/** The amount collected at a delivery, across the three payment methods (FR-010). */
export function collectedTotal(collection: {
  cashAmount: number;
  companyTransferAmount: number;
  merchantTransferAmount: number;
}): number {
  return (
    collection.cashAmount + collection.companyTransferAmount + collection.merchantTransferAmount
  );
}

/**
 * The summary of a Bogotá date from the courier's records. Only applied, not reverted records
 * count; pending stops come from the route, not from records.
 */
export function daySummary(
  records: SummaryRecord[],
  day: { date: string; pendingStops: number },
): DaySummary {
  const counted = records.filter(
    (record) =>
      record.outcome === "applied" &&
      !record.reverted &&
      bogotaToday(record.occurredAt) === day.date,
  );
  const of = (kind: CourierRecordKind) => counted.filter((record) => record.kind === kind);
  const total = (list: SummaryRecord[], pick: (record: SummaryRecord) => number) =>
    list.reduce((sum, record) => sum + pick(record), 0);
  const deliveries = of("delivery");
  const cash = total(deliveries, (record) => record.cashAmount);
  const disbursements = total(of("disbursement"), (record) => record.disbursementAmount);
  return {
    date: day.date,
    deliveries: deliveries.length,
    exceptions: of("exception").length,
    returns: of("return").length,
    pendingStops: day.pendingStops,
    cash,
    companyTransfer: total(deliveries, (record) => record.companyTransferAmount),
    merchantTransfer: total(deliveries, (record) => record.merchantTransferAmount),
    disbursements,
    cashToHandOver: cash - disbursements,
  };
}
