// Load test of the API (docs/load-test.md). Run it against a disposable database, never production:
//   node scripts/load-test.ts <base> <email> <password> [creates] [createClients] [seconds] [officeUsers] [recipients]
// Start the API with DOMY_TRUSTED_PROXY_IP=127.0.0.1 so each simulated recipient has its own public
// rate-limit identity (X-Domy-Client-IP), as behind the production proxy.

type Stat = { latencies: number[]; codes: Map<string, number> };
type Item = { id: string };

const [
  base = "http://127.0.0.1:3300",
  email = "",
  password = "",
  creates = "300",
  createClients = "10",
  seconds = "60",
  officeUsers = "30",
  recipients = "300",
] = process.argv.slice(2);
const origin = "http://localhost:5173";
const stats = new Map<string, Stat>();

function record(name: string, ms: number, code: string): void {
  const stat = stats.get(name) ?? { latencies: [], codes: new Map<string, number>() };
  stats.set(name, stat);
  stat.latencies.push(ms);
  stat.codes.set(code, (stat.codes.get(code) ?? 0) + 1);
}

async function timed(name: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const start = performance.now();
  try {
    const response = await fetch(url, init);
    const body: unknown = await response.json().catch(() => null);
    record(name, performance.now() - start, String(response.status));
    return response.ok ? body : null;
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : null;
    const code = cause && "code" in cause ? String(cause.code) : "network";
    record(name, performance.now() - start, `ERR:${code}`);
    return null;
  }
}

function report(title: string): void {
  console.log(`\n== ${title}`);
  for (const [name, stat] of stats) {
    const sorted = stat.latencies.sort((a, b) => a - b);
    const at = (p: number) =>
      (sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0).toFixed(0);
    const codes = [...stat.codes].map(([code, n]) => `${code}:${String(n)}`).join(" ");
    console.log(
      `${name.padEnd(18)} n=${String(sorted.length).padStart(6)} p50=${at(0.5).padStart(5)}ms p95=${at(0.95).padStart(5)}ms p99=${at(0.99).padStart(5)}ms  ${codes}`,
    );
  }
  stats.clear();
}

const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ email, password }),
});
if (!signIn.ok) throw new Error(`Sign-in failed with ${String(signIn.status)}`);
const headers = {
  cookie: signIn.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0] ?? "")
    .join("; "),
  origin,
};
const get = async <T>(path: string): Promise<T> =>
  (await (await fetch(`${base}${path}`, { headers })).json()) as T;

const merchants = (await get<{ items: Item[] }>("/api/merchants?q=")).items;
const places = (await get<{ items: Item[] }>("/api/neighborhoods?q=")).items;
const points = new Map<string, string>();
for (const merchant of merchants) {
  const [point] = (await get<{ items: Item[] }>(`/api/merchants/${merchant.id}/pickup-points`))
    .items;
  if (point) points.set(merchant.id, point.id);
}
const usable = merchants.filter((merchant) => points.has(merchant.id));
if (usable.length === 0 || places.length === 0)
  throw new Error("The database needs merchants with a pickup point and neighborhoods");

const names = ["Laura Gómez", "Mateo Cardona", "Juan Ríos", "Valentina Ruiz", "Camila Restrepo"];
function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error("Nothing to pick from");
  return item;
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A burst of registrations, as a bulk day produces.
const created: string[] = [];
const total = Number(creates);
let next = 0;
const createStart = performance.now();
await Promise.all(
  Array.from({ length: Number(createClients) }, async () => {
    while (next < total) {
      const index = next++;
      const merchant = pick(usable);
      const cod = index % 5 < 3;
      const body = (await timed("POST shipment", `${base}/api/shipments`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          kind: "delivery",
          merchantId: merchant.id,
          pickupPointId: points.get(merchant.id),
          recipientName: `${pick(names)} ${String(index)}`,
          recipientPhone: `300${String(1_000_000 + index).slice(-7)}`,
          recipientAddress: `Calle ${String(10 + (index % 80))} # ${String(20 + (index % 50))}-10`,
          recipientNeighborhoodId: pick(places).id,
          paymentMode: cod ? "cash_on_delivery" : "merchant_account",
          codAmount: cod ? 50_000 + (index % 20) * 5_000 : 0,
          fee: 13_000,
          feeOverrideReason: "Prueba de carga",
        }),
      })) as { trackingNumber?: string } | null;
      if (body?.trackingNumber) created.push(body.trackingNumber);
    }
  }),
);
const createSeconds = (performance.now() - createStart) / 1000;
report(
  `${String(total)} registrations by ${createClients} clients in ${createSeconds.toFixed(1)} s`,
);

// The public codes recipients receive in their link.
const codes: string[] = [];
for (const trackingNumber of created.slice(0, 300)) {
  const detail = await get<{ trackingCode?: string }>(
    `/api/shipments?trackingNumber=${trackingNumber}`,
  );
  if (detail.trackingCode) codes.push(detail.trackingCode);
}

// The office polling and searching while recipients open their tracking pages.
const until = performance.now() + Number(seconds) * 1000;
const today = new Date().toISOString().slice(0, 10);
async function office(): Promise<void> {
  while (performance.now() < until) {
    const roll = Math.random();
    if (roll < 0.5) await timed("GET board", `${base}/api/shipments/board`, { headers });
    else if (roll < 0.7)
      await timed("GET routes board", `${base}/api/routes/board?date=${today}`, { headers });
    else if (roll < 0.9)
      await timed(
        "GET search",
        `${base}/api/shipments/search?q=${encodeURIComponent(pick(names).split(" ")[0] ?? "")}`,
        {
          headers,
        },
      );
    else await timed("GET merchants", `${base}/api/merchants?q=`, { headers });
    await pause(200 + Math.random() * 300);
  }
}
async function recipient(n: number): Promise<void> {
  const address = `10.${String((n >> 8) & 255)}.${String(n & 255)}.${String(1 + (n % 250))}`;
  // Recipients arrive over a few seconds, not in one instant (a burst of hundreds of new TCP
  // connections only measures the test machine's listen backlog).
  await pause(n * 20);
  while (performance.now() < until) {
    await timed("GET tracking", `${base}/api/public/tracking/${pick(codes)}`, {
      headers: { "X-Domy-Client-IP": address },
    });
    await pause(500 + Math.random() * 1000);
  }
}
await Promise.all([
  ...Array.from({ length: Number(officeUsers) }, () => office()),
  ...Array.from({ length: Number(recipients) }, (_, n) => recipient(n)),
]);
report(`${officeUsers} office users and ${recipients} recipients for ${seconds} s`);
