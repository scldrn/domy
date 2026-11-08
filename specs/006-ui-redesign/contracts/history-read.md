# Contract: History Read

## `GET /api/shipments/search` — additive field

Added when the owner approved «Historial» (2026-11-08), whose sentence reads «38 envíos del 1
al 3 de noviembre; 3 tienen la tarifa por revisar» and whose footer reads «Mostrando 50 de 38…».
`ShipmentSearchResult` gains:

```ts
counts: { total: number; feeReview: number } | null;
```

- `total`: every shipment the same search finds (the same conditions as `items`, without the
  page); `feeReview`: how many of them have `feeNeedsReview`.
- Present on the first page (no `cursor`); `null` on the next pages, which keep the counts
  the screen already has.
- Typed in `packages/domain/src/schemas/search.ts`; the web client infers it through Hono RPC.
  Existing fields, their order, paging, and the roles allowed do not change.

Errors: unchanged.
