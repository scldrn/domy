# Contract: Audit Log Reads

## `GET /api/audit-events` — additive fields (owner only, as today)

`changes` keeps its current shape (`Record<string, [from, to]> | null`). Each item gains:

```ts
entityLabel: string; // the record's name; a shipment's tracking number; a user's name
changeLabels: Record<string, [string | null, string | null]>; // only for reference fields
```

- Reference fields resolved to names: merchant, courier, carrier, neighborhood, user, rate
  zone. A deactivated record still resolves to its name.
- A reference that cannot be resolved shows `Registro eliminado` rather than its identifier
  (records are never hard-deleted, so this is a safeguard).
- Identifiers remain in the payload for links; the screen renders `changeLabels` where
  present and never an identifier (FR-020, SC-005).
- Typed in `packages/domain/src/schemas/master-data.ts` (`AuditEvent`).
