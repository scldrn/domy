# Contract: Board Reads

## `GET /api/routes/board` — additive field

Each `RouteSummary` in `routes` and `routesFromPreviousDays` gains:

```ts
stopMarks: Array<{
  kind: "pickup" | "delivery";
  state: "done" | "exception" | "pending";
}>;
```

- Length equals `totalStops`; `done` + `exception` marks equal `completedStops`.
- Order: completed marks by completion time, then pending marks in route order.
- Draft routes ("En preparación") return every mark `pending`.
- Typed in `packages/domain/src/schemas/routes.ts`; the web client infers it through Hono
  RPC. Existing fields and their meaning do not change.

## `GET /api/shipments/board` — additive field

Each `BoardEntry` in `shipments` and `pendingFromPreviousDays` gains:

```ts
pendingHandover: {
  id: string;
  fromCourier: { id: string; name: string };
  toCourier: { id: string; name: string };
  requestedAt: string;
} | null;
```

- Present only while a handover of that shipment is `pending`; the confirm and cancel actions
  stay the existing handover endpoints.
- Typed in `packages/domain/src/schemas/board.ts`.

Errors for both: unchanged (the endpoints' current validation and role rules).

## Attention list — domain function, no endpoint

`buildAttention({ shipments, role, now })` in `packages/domain/src/attention.ts` takes the
board's `BoardEntry` list (status, window, `returnDecided`, `recordFlags` including
`pickup_problem`, `collection_differs`, `needs_review`, `no_photo`, `feeNeedsReview`,
`pendingHandover`) and returns `{ items: AttentionItem[], minor: Record<MinorFlag, number> }`
ordered as in [data-model.md](../data-model.md). At-risk and late reuse the existing domain
rule for delivery windows; nothing is recomputed differently from the board's flags.
