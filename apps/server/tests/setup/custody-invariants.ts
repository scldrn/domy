import {
  resolveCourierRecord,
  type CourierRecordKind,
  type RecordOutcome,
  type RouteDetail,
  type Shipment,
} from "@domy/domain";
import { sql } from "drizzle-orm";
import { expect } from "vitest";
import type { Db } from "../../src/db/client.ts";
import { loadState } from "../../src/lib/courier-records.ts";
import type { createTestApp } from "./app.ts";
import type { Catalog } from "./catalog.ts";
import { courierWithAccount, sendRecords, type CourierAccount } from "./courier.ts";
import { createRoute, registerShipment, routeAction, send } from "./routes.ts";

type TestApp = ReturnType<typeof createTestApp>;
type Random = { pick: <T>(values: readonly T[]) => T | undefined };
type Command = { name: string; run: () => Promise<void> | void };
type SentRecord = {
  input: Record<string, unknown> & {
    id: string;
    shipmentId: string;
    kind: CourierRecordKind;
    occurredAt: string;
  };
  courier: CourierAccount;
  onBehalf: boolean;
  outcome: RecordOutcome;
  recordedAt: string;
  authorUserId: string;
};

/** T082: a second generated lane; never relax the legacy route-only invariants. */
export async function generatedCustodySequence(
  db: Db,
  t: TestApp,
  catalog: Catalog,
  ownerAccount: { cookie: string; userId: string },
  random: Random,
) {
  const owner = ownerAccount.cookie;
  const ledger = new Map<string, SentRecord>();
  const executed = new Map<string, number>();
  const count = (name: string) => executed.set(name, (executed.get(name) ?? 0) + 1);
  const query = async <T extends Record<string, unknown>>(statement: ReturnType<typeof sql>) => [
    ...(await db.execute<T>(statement)),
  ];
  // Full rows catch changes hidden by equal counts/summed versions, including payload edits.
  const fingerprint = async () =>
    JSON.stringify(
      await query(sql`select
    (select jsonb_agg(to_jsonb(x) order by id) from shipments x) as shipments,
    (select jsonb_agg(to_jsonb(x) order by id) from courier_records x) as records,
    (select jsonb_agg(to_jsonb(x) order by id) from shipment_events x) as shipment_events,
    (select jsonb_agg(to_jsonb(x) order by id) from route_events x) as route_events,
    (select jsonb_agg(to_jsonb(x) order by id) from routes x) as routes,
    (select jsonb_agg(to_jsonb(x) order by id) from route_tasks x) as tasks,
    (select jsonb_agg(to_jsonb(x) order by id) from route_stops x) as stops,
    (select jsonb_agg(to_jsonb(x) order by id) from handovers x) as handovers,
    (select jsonb_agg(to_jsonb(x) order by id) from courier_notices x) as notices,
    (select jsonb_agg(to_jsonb(x) order by id) from record_photos x) as photos`),
    );

  async function invariants(label: string) {
    // Independent SQL: exception/office/off-route custody is legitimate in feature 003.
    const broken = await query<{ rule: string; id: string }>(sql`
      select 'two simultaneous holders' as rule, id::text from shipments
        where custody_courier_id is not null and held_at_office
      union all
      select 'final shipment has a holder', id::text from shipments
        where status in ('delivered', 'returned', 'voided') and (custody_courier_id is not null or held_at_office)
      union all
      select 'held package has no responsible party', id::text from shipments
        where kind <> 'errand' and status in ('picked_up', 'exception') and custody_courier_id is null and not held_at_office
      union all
      select 'errand gained custody', id::text from shipments
        where kind = 'errand' and (custody_courier_id is not null or held_at_office)
      union all
      select 'unheld preparatory package has a courier', id::text from shipments
        where status in ('registered', 'assigned', 'dispatched') and custody_courier_id is not null
      union all
      select 'stored record has no correlated shipment', r.id::text from courier_records r
        left join shipments s on s.id = r.shipment_id where s.id is null
      union all
      select 'record time moved after receipt', id::text from courier_records where occurred_at > recorded_at
      union all
      select 'pending handover has wrong holder', h.id::text from handovers h
        join shipments s on s.id = h.shipment_id where h.status = 'pending'
          and (s.custody_courier_id is distinct from h.from_courier_id or s.held_at_office or s.route_id is distinct from h.to_route_id)`);
    expect(broken, label).toEqual([]);
    const brokenChain = await query<{ id: string; field: string }>(sql`
      with movements as (
        select id, shipment_id, occurred_at, field,
          changes -> field -> 0 as previous, changes -> field -> 1 as next
        from shipment_events
        cross join (values ('custodyCourierId'), ('heldAtOffice')) fields(field)
        where changes ? field
      ), chain as (
        select *, lag(next) over (
          partition by shipment_id, field order by occurred_at, id
        ) as preceding, row_number() over (
          partition by shipment_id, field order by occurred_at desc, id desc
        ) as last_movement from movements
      )
      select c.id::text, c.field from chain c join shipments s on s.id = c.shipment_id
      where previous is distinct from coalesce(preceding,
          case when field = 'heldAtOffice' then 'false'::jsonb else 'null'::jsonb end)
        or (last_movement = 1 and next is distinct from
          case when field = 'heldAtOffice' then to_jsonb(s.held_at_office)
            else coalesce(to_jsonb(s.custody_courier_id), 'null'::jsonb) end)`);
    expect(
      brokenChain,
      `${label}: custody history is continuous and agrees with current holder`,
    ).toEqual([]);
    const stored = await query<{
      id: string;
      shipment_id: string;
      courier_id: string;
      author_user_id: string;
      kind: string;
      outcome: string;
      on_behalf: boolean;
      occurred_at: string;
      recorded_at: string;
    }>(sql`
      select id, shipment_id, courier_id, author_user_id, kind, outcome, on_behalf, occurred_at, recorded_at from courier_records order by id`);
    expect(stored.length, `${label}: one row per submitted identity`).toBe(ledger.size);
    for (const row of stored) {
      const sent = ledger.get(row.id);
      if (!sent) throw new Error("Untracked record in generated custody lane");
      expect(
        {
          shipment: row.shipment_id,
          courier: row.courier_id,
          author: row.author_user_id,
          kind: row.kind,
          outcome: row.outcome,
          onBehalf: row.on_behalf,
        },
        label,
      ).toEqual({
        shipment: sent.input.shipmentId,
        courier: sent.courier.id,
        author: sent.authorUserId,
        kind: sent.input.kind,
        outcome: sent.outcome,
        onBehalf: sent.onBehalf,
      });
      expect(new Date(row.occurred_at).toISOString(), label).toBe(sent.input.occurredAt);
      expect(new Date(row.recorded_at).toISOString(), label).toBe(sent.recordedAt);
    }
    // Every custody-affecting applied fact has exactly one effect event. Corrections and
    // reverts add their own distinct events, never replace the original fact's history.
    const wrongHistory = await query<{ id: string }>(sql`select r.id::text from courier_records r
      where (r.outcome = 'applied' and r.kind in ('pickup','delivery','exception','return','handover_confirmation')
        and (select count(*) from shipment_events e where e.courier_record_id = r.id and e.type in ('status_changed','handover_confirmed')) <> 1)
        or (r.outcome <> 'applied' and exists (select 1 from shipment_events e where e.courier_record_id = r.id and e.type in ('status_changed','handover_confirmed')))`);
    expect(wrongHistory, `${label}: exactly one original effect per applied record`).toEqual([]);
    const misattributed = await query<{ id: string }>(sql`select e.id::text
      from shipment_events e join courier_records r on r.id = e.courier_record_id
      where e.type in ('status_changed', 'handover_confirmed') and
        (e.actor_user_id is distinct from r.author_user_id
          or e.occurred_at is distinct from r.occurred_at
          or e.recorded_at is distinct from r.recorded_at
          or e.on_behalf is distinct from r.on_behalf)`);
    expect(misattributed, `${label}: original effects retain their actor and both clocks`).toEqual(
      [],
    );
  }

  async function replay(record: SentRecord) {
    const before = await fingerprint();
    const response = record.onBehalf
      ? await send<{ id: string; outcome: string }>(
          t,
          owner,
          `/api/shipments/${record.input.shipmentId}/records`,
          record.input,
        )
      : await sendRecords(t, record.courier, [record.input]);
    expect(response.status).toBe(200);
    if (record.onBehalf)
      expect(response.body).toMatchObject({ id: record.input.id, outcome: record.outcome });
    else
      expect(response.body).toMatchObject({
        results: [{ id: record.input.id, outcome: record.outcome }],
      });
    expect(await fingerprint(), "replaying a record must preserve complete operational rows").toBe(
      before,
    );
    count("identity-replay");
  }

  async function record(
    courier: CourierAccount,
    shipment: Shipment,
    kind: CourierRecordKind,
    expected: RecordOutcome = "applied",
    options: {
      onBehalf?: boolean;
      input?: Record<string, unknown>;
      queued?: SentRecord["input"];
      duplicateInBatch?: boolean;
    } = {},
  ) {
    const input = options.queued ?? {
      id: crypto.randomUUID(),
      shipmentId: shipment.id,
      kind,
      occurredAt: t.now().toISOString(),
      ...(["delivery", "return"].includes(kind) && { receivedByName: "Persona de la prueba" }),
      ...(kind === "delivery" && { cashAmount: 50000 }),
      ...(kind === "exception" && { reason: "recipient_absent" }),
      ...options.input,
    };
    const state = await loadState(db, shipment.id);
    const resolution = resolveCourierRecord(state.forRecord, { kind, courierId: courier.id });
    expect(resolution.outcome, "approved scenario and domain oracle must agree").toBe(expected);
    const onBehalf = options.onBehalf ?? false;
    const response = onBehalf
      ? await send<{ id: string; outcome: string }>(
          t,
          owner,
          `/api/shipments/${shipment.id}/records`,
          input,
        )
      : await sendRecords(t, courier, options.duplicateInBatch ? [input, input] : [input]);
    expect(response.status, `generated ${kind} request`).toBe(200);
    expect(response.body).toMatchObject(
      onBehalf
        ? { id: input.id, outcome: expected }
        : {
            results: Array.from({ length: options.duplicateInBatch ? 2 : 1 }, () => ({
              id: input.id,
              outcome: expected,
            })),
          },
    );
    const sent = {
      input,
      courier,
      onBehalf,
      outcome: expected,
      recordedAt: t.now().toISOString(),
      authorUserId: onBehalf ? ownerAccount.userId : courier.userId,
    };
    ledger.set(input.id, sent);
    if (options.duplicateInBatch) count("offline-batch-duplicate");
    if (resolution.outcome === "applied") {
      const after = (await loadState(db, shipment.id)).row;
      if (resolution.effect.status) expect(after.status).toBe(resolution.effect.status);
      if (resolution.effect.custody) {
        expect(after.custodyCourierId).toBe(resolution.effect.custody.courierId);
        expect(after.heldAtOffice).toBe(resolution.effect.custody.heldAtOffice);
      }
    }
    count(`kind:${kind}`);
    count(`outcome:${expected}`);
    if (onBehalf) count("on-behalf");
    await replay(sent);
    return sent;
  }

  async function post(path: string, body: Record<string, unknown>) {
    const response = await send(t, owner, path, { actionId: crypto.randomUUID(), ...body });
    expect(response.status, path).toBe(200);
    return response;
  }
  async function dispatched(courier: CourierAccount, shipment: Shipment) {
    const created = await createRoute(t, owner, {
      shipmentIds: [shipment.id],
      courierId: courier.id,
    });
    const result = await routeAction(t, owner, created, "/dispatch");
    expect(result.status).toBe(200);
    return result.body;
  }
  async function setup(name: string) {
    return {
      courier: await courierWithAccount(t, db, name),
      shipment: await registerShipment(t, owner, catalog),
    };
  }
  const late = await setup("Generated Late");
  const office = await setup("Generated Office");
  const transfer = await setup("Generated Transfer");
  const receiver = await setup("Generated Receiver");
  const behalf = await setup("Generated Dispatch");
  const settings = await send(
    t,
    owner,
    "/api/settings",
    {
      actionId: crypto.randomUUID(),
      officeAddress: "Carrera 90 # 65C-10",
      officeNeighborhoodId: catalog.place.estadio,
    },
    "PATCH",
  );
  expect(settings.status).toBe(200);
  let lateRoute: RouteDetail;
  let queuedPickup: SentRecord["input"];
  let returned: SentRecord;
  let receiverRoute: RouteDetail;
  let behalfDelivery: SentRecord;
  const step = (name: string, run: Command["run"]): Command => ({ name, run });
  const workflows = [
    [
      step("late:dispatch", async () => {
        lateRoute = await dispatched(late.courier, late.shipment);
      }),
      step("late:queue", () => {
        queuedPickup = {
          id: crypto.randomUUID(),
          shipmentId: late.shipment.id,
          kind: "pickup",
          occurredAt: t.now().toISOString(),
        };
        count("offline-queued");
      }),
      step("late:remove", async () => {
        expect(
          (await routeAction(t, owner, lateRoute, `/shipments/${late.shipment.id}/remove`)).status,
        ).toBe(200);
      }),
      step("late:pickup", async () => {
        await record(late.courier, late.shipment, "pickup", "applied", {
          queued: queuedPickup,
          duplicateInBatch: true,
        });
        count("late-arrival");
      }),
      step("late:fresh-duplicate", async () => {
        await record(late.courier, late.shipment, "pickup", "duplicate");
      }),
      step("late:deliver", async () => {
        await record(late.courier, late.shipment, "delivery");
      }),
      step("late:unapplied", async () => {
        await record(late.courier, late.shipment, "return", "not_applied");
      }),
    ],
    [
      step("office:dispatch", async () => {
        await dispatched(office.courier, office.shipment);
      }),
      step("office:pickup", async () => {
        await record(office.courier, office.shipment, "pickup");
      }),
      step("office:exception", async () => {
        await record(office.courier, office.shipment, "exception");
      }),
      step("office:receive", async () => {
        await post(`/api/shipments/${office.shipment.id}/office-receipt`, {});
      }),
      step("office:return-decision", async () => {
        await post(`/api/shipments/${office.shipment.id}/exception-decision`, {
          decision: "return",
        });
      }),
      step("office:return-route", async () => {
        await dispatched(office.courier, office.shipment);
      }),
      step("office:collect", async () => {
        await record(office.courier, office.shipment, "pickup");
      }),
      step("office:return", async () => {
        returned = await record(office.courier, office.shipment, "return");
      }),
      step("office:revert", async () => {
        await post(`/api/courier-records/${returned.input.id}/revert`, {
          reason: "Devolución registrada por equivocación",
        });
        await replay(returned);
      }),
      step("office:redo-return", async () => {
        await record(office.courier, office.shipment, "return");
      }),
    ],
    [
      step("transfer:dispatch", async () => {
        await dispatched(transfer.courier, transfer.shipment);
      }),
      step("transfer:receiver-route", async () => {
        receiverRoute = await dispatched(receiver.courier, receiver.shipment);
      }),
      step("transfer:pickup", async () => {
        await record(transfer.courier, transfer.shipment, "pickup");
      }),
      step("transfer:reassign", async () => {
        await post(`/api/shipments/${transfer.shipment.id}/reassign`, {
          toRouteId: receiverRoute.id,
          reason: "Otro sector para la entrega",
        });
      }),
      step("transfer:confirm", async () => {
        await record(receiver.courier, transfer.shipment, "handover_confirmation");
      }),
      step("transfer:deliver", async () => {
        await record(receiver.courier, transfer.shipment, "delivery");
      }),
    ],
    [
      step("behalf:dispatch", async () => {
        await dispatched(behalf.courier, behalf.shipment);
      }),
      step("behalf:problem", async () => {
        await record(behalf.courier, behalf.shipment, "problem", "applied", {
          input: { note: "La recogida tuvo una demora" },
        });
      }),
      step("behalf:pickup", async () => {
        await record(behalf.courier, behalf.shipment, "pickup", "applied", { onBehalf: true });
      }),
      step("behalf:disbursement", async () => {
        await record(behalf.courier, behalf.shipment, "disbursement", "applied", {
          onBehalf: true,
          input: { amount: 1500, payee: "Transportadora de prueba" },
        });
      }),
      step("behalf:delivery", async () => {
        behalfDelivery = await record(behalf.courier, behalf.shipment, "delivery", "applied", {
          onBehalf: true,
        });
      }),
      step("behalf:correct", async () => {
        await post(`/api/courier-records/${behalfDelivery.input.id}/correct`, {
          reason: "Nombre confirmado con el mensajero",
          receivedByName: "Nombre corregido",
        });
        await replay(behalfDelivery);
      }),
      step("behalf:revert", async () => {
        await post(`/api/courier-records/${behalfDelivery.input.id}/revert`, {
          reason: "Entrega registrada por equivocación",
        });
        await replay(behalfDelivery);
      }),
      step("behalf:redo", async () => {
        await record(behalf.courier, behalf.shipment, "delivery");
      }),
    ],
  ].map((commands) => ({ commands, cursor: 0 }));
  // Dependencies are per-workflow; the seed interleaves independent custody chains.
  for (let index = 0; index < 90; index++) {
    t.setNow(new Date(Date.UTC(2026, 9, 1, 15, index)).toISOString());
    const runnable = workflows.filter((workflow) => workflow.cursor < workflow.commands.length);
    const selected = random.pick(runnable);
    if (selected) {
      const command = selected.commands[selected.cursor];
      if (!command) throw new Error("Missing generated command");
      await command.run();
      count(command.name);
      selected.cursor++;
    } else {
      const sent = random.pick([...ledger.values()]);
      if (!sent) throw new Error("No generated record to replay");
      await replay(sent);
    }
    await invariants(`generated command ${String(index)}`);
  }
  expect(workflows.every((workflow) => workflow.cursor === workflow.commands.length)).toBe(true);
  for (const kind of [
    "pickup",
    "delivery",
    "exception",
    "problem",
    "return",
    "disbursement",
    "handover_confirmation",
  ])
    expect(executed.get(`kind:${kind}`)).toBeGreaterThan(0);
  for (const outcome of ["applied", "duplicate", "not_applied"])
    expect(executed.get(`outcome:${outcome}`)).toBeGreaterThan(0);
  for (const name of [
    "offline-queued",
    "offline-batch-duplicate",
    "late-arrival",
    "on-behalf",
    "office:receive",
    "transfer:confirm",
    "office:revert",
    "behalf:correct",
    "behalf:revert",
  ])
    expect(executed.get(name), name).toBeGreaterThan(0);
  expect(executed.get("identity-replay")).toBeGreaterThan(50);
  // Keep timings and coverage bounded and non-sensitive; no identities or payloads printed.
  console.info("generated custody coverage (T082)", {
    commands: 90,
    identities: ledger.size,
    branches: Object.fromEntries(executed),
  });
}
