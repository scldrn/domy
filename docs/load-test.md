# Load test

How much load Domy holds, measured on 2026-11-09 before the client demonstration. Rerun it before
go-live on the production machine (against a disposable database, never the real one).

## Method

`scripts/load-test.ts` signs in as the owner and then:

1. Registers shipments through `POST /api/shipments` from several clients at once, as a bulk day.
2. For a set time, runs office users (board 50 %, routes board 20 %, history search 20 %,
   merchants 10 %, each every 0.2–0.5 s) and recipients opening their tracking page every
   0.5–1.5 s, each recipient with its own public rate-limit identity.

The API ran from source in development mode (one Node 24 process, pool of 10 PostgreSQL
connections, request logs on) on a MacBook, with PostgreSQL 18 in Docker. Production puts Caddy in
front, which compresses responses (`encode zstd gzip`) and keeps connections to the app open.

```bash
docker exec domy-postgres-1 createdb -U domy domy_load
DATABASE_URL=postgres://domy:domy@localhost:5432/domy_load pnpm db:migrate
DATABASE_URL=postgres://domy:domy@localhost:5432/domy_load pnpm db:seed   # prints the owner's password
# add merchants with a default pickup point, then start the API on the load database:
cd apps/server && DATABASE_URL=postgres://domy:domy@localhost:5432/domy_load API_PORT=3300 \
  DOMY_TRUSTED_PROXY_IP=127.0.0.1 node --env-file-if-exists=../../.env src/index.ts
node scripts/load-test.ts http://127.0.0.1:3300 propietario@example.com <password> 300 10 60 30 300
```

## Results

Cohex registers about 20 shipments a day (90th percentile 28, maximum 36; business-master.md).

| Scenario | Requests | Errors | Latency |
| --- | --- | --- | --- |
| 300 shipments in the day (≈10× the maximum), 30 office users and 300 recipients for 60 s | 22,412 (300 registrations in 0.6 s) | 0 | p99 under 110 ms on every endpoint; board p50 12 ms, tracking p50 3 ms |
| The same for 5 minutes (soak), 200 recipients | 83,000 (≈277 per second) | 0 from the server | board p50 19 ms, p99 319 ms; memory rose from 211 to 416 MB and fell back to 309 MB after the load: no leak |
| 3,000 shipments in the day (≈100× the maximum), 30 office users and 100 recipients | 8,586 (2,000 registrations in 5.9 s, 336 per second) | 0 | board p50 747 ms, p95 1.1 s: the board then sends 2.2 MB of JSON, and serializing it holds the one Node thread |

- The public limit of 60 requests a minute per person answers `429` to a recipient refreshing
  every second, as designed (FR-011, research R14).
- A burst of hundreds of new connections in the same instant overflows the test machine's listen
  backlog (`kern.ipc.somaxconn` 128 on macOS) and some are reset before reaching Node; the script
  therefore brings recipients in over a few seconds. Behind Caddy and on Linux (backlog 4096) this
  does not arise.

## Conclusion

At ten times Cohex's busiest day the system answers every request in well under a second, with
no errors and stable memory. Only at about a hundred times that volume does the board slow down,
because it sends the whole day; paging it is not worth its complexity until volume grows by that
much.
