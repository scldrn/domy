import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { createECDH } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer } from "testcontainers";
import { z } from "zod";
import { apiPort, webPort } from "./ports";

/**
 * Starts the end-to-end environment: a fresh PostgreSQL 18, photo storage in memory, migrations
 * and seed, the API in test mode, and the web app; then signs in one user per role and saves
 * their sessions.
 */

const serverDir = new URL("../../../server/", import.meta.url).pathname;
const webDir = new URL("../../", import.meta.url).pathname;
const authDir = new URL(".auth/", import.meta.url).pathname;
const password = "contrasena-e2e-segura";

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env } });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("exit", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${args.join(" ")} failed:\n${output}`));
    });
  });
}

async function waitFor(url: string): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function signIn(email: string): Promise<string> {
  const response = await fetch(`http://localhost:${String(apiPort)}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Sign-in failed for ${email}`);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function saveStorageState(role: string, cookieHeader: string): Promise<void> {
  const cookies = cookieHeader.split("; ").map((pair) => {
    const [name = "", ...value] = pair.split("=");
    return {
      name,
      value: value.join("="),
      domain: "localhost",
      path: "/",
      expires: -1,
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    };
  });
  await writeFile(`${authDir}${role}.json`, JSON.stringify({ cookies, origins: [] }));
}

/** A Web Push key pair for the test run: P-256, base64url, as `web-push` expects (FR-040). */
function testVapidKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    VAPID_PUBLIC_KEY: ecdh.getPublicKey().toString("base64url"),
    // 32 bytes always: a key that starts with a zero byte comes back one byte short.
    VAPID_PRIVATE_KEY: Buffer.concat([Buffer.alloc(32), ecdh.getPrivateKey()])
      .subarray(-32)
      .toString("base64url"),
    VAPID_SUBJECT: "mailto:pruebas@example.com",
  };
}

export default async function globalSetup() {
  const [container, storage] = await Promise.all([
    new PostgreSqlContainer("postgres:18").start(),
    // Photo storage with the S3 API, in memory (feature 003, research R6).
    new GenericContainer("andrewgaul/s3proxy:4.1.1")
      .withEnvironment({
        S3PROXY_AUTHORIZATION: "aws-v2-or-v4",
        S3PROXY_IDENTITY: "domy",
        S3PROXY_CREDENTIAL: "domy-secreto",
        JCLOUDS_PROVIDER: "transient",
      })
      .withExposedPorts(80)
      .start(),
  ]);
  const env = {
    NODE_ENV: "test",
    DATABASE_URL: container.getConnectionUri(),
    BETTER_AUTH_SECRET: "e2e-secret-with-at-least-thirty-two-characters",
    APP_URL: `http://localhost:${String(webPort)}`,
    PUBLIC_BASE_URL: `http://localhost:${String(webPort)}`,
    API_PORT: String(apiPort),
    EMAIL_FROM: "Domy <no-reply@example.com>",
    DOMY_FAKE_NOW: "2026-10-01T15:00:00Z",
    S3_ENDPOINT: `http://${storage.getHost()}:${String(storage.getMappedPort(80))}`,
    S3_REGION: "us-east-1",
    S3_BUCKET: "domy-fotos",
    S3_ACCESS_KEY_ID: "domy",
    S3_SECRET_ACCESS_KEY: "domy-secreto",
    S3_FORCE_PATH_STYLE: "true",
    ...testVapidKeys(),
  };

  await run("node", ["src/db/migrate.ts"], serverDir, env);
  const seedOutput = await run("node", ["src/db/seed/index.ts"], serverDir, env);
  const ownerPassword = /Password \(shown once\): (\S+)/.exec(seedOutput)?.[1];
  if (!ownerPassword) throw new Error("The seed did not create the owner account");

  // Merchants and pickup points used by the tests (master data screens come later).
  const sql = `
    insert into merchants (id, name, name_normalized, whatsapp_phone)
      values (gen_random_uuid(), 'Bullish Hype', 'bullish hype', '3000000001');
    insert into pickup_points (id, merchant_id, label, address, neighborhood_id, is_default)
      select gen_random_uuid(), m.id, 'Bodega Estadio', 'Cra 70 # 45-10', n.id, true
      from merchants m, neighborhoods n where m.name = 'Bullish Hype' and n.name = 'El Estadio';
    insert into pickup_points (id, merchant_id, label, address, neighborhood_id, is_default)
      select gen_random_uuid(), m.id, 'Bodega Amy', 'Cl 30 # 65-15', n.id, true
      from merchants m, neighborhoods n where m.name = 'Amy Tecnology' and n.name = 'Laureles';`;
  const result = await container.exec([
    "psql",
    "-U",
    container.getUsername(),
    "-d",
    container.getDatabase(),
    "-c",
    sql,
  ]);
  if (result.exitCode !== 0) throw new Error(`Test data failed: ${result.output}`);

  // Request logs are discarded (an unread pipe fills up and stalls the servers mid-run). Each
  // server leads its own process group so teardown also stops what `pnpm exec` started.
  const options = { stdio: ["ignore", "ignore", "inherit"], detached: true } satisfies SpawnOptions;
  // US2 T043: all scenarios use the built shell and real service worker, as phones do.
  await run("pnpm", ["exec", "vite", "build"], webDir, {
    API_PORT: String(apiPort),
    APP_URL: env.APP_URL,
    PUBLIC_BASE_URL: env.PUBLIC_BASE_URL,
  });
  const processes: ChildProcess[] = [
    spawn("node", ["src/index.ts"], {
      ...options,
      cwd: serverDir,
      env: { ...process.env, ...env },
    }),
    spawn("pnpm", ["exec", "vite", "preview", "--port", String(webPort), "--strictPort"], {
      ...options,
      cwd: webDir,
      env: { ...process.env, API_PORT: String(apiPort) },
    }),
  ];
  await waitFor(`http://localhost:${String(apiPort)}/api/auth/get-session`);
  await waitFor(`http://localhost:${String(webPort)}/`);

  // The seeded owner sets a known password; then one account per role is created.
  const api = `http://localhost:${String(apiPort)}/api/auth`;
  const ownerSignIn = await fetch(`${api}/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "propietario@example.com", password: ownerPassword }),
  });
  const ownerCookie = ownerSignIn.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  const ownerSession = await fetch(`${api}/get-session`, { headers: { cookie: ownerCookie } });
  if (!ownerSession.ok) throw new Error("Owner session could not be read for the test fixture");
  const ownerActorId = z
    .object({ user: z.object({ id: z.uuid() }) })
    .parse((await ownerSession.json()) as unknown).user.id;
  await fetch(`${api}/change-password`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({ currentPassword: ownerPassword, newPassword: password }),
  });
  for (const role of ["dispatcher", "courier"] as const) {
    const created = await fetch(`${api}/admin/create-user`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: ownerCookie,
        origin: `http://localhost:${String(webPort)}`,
        "X-Domy-Actor-Id": ownerActorId,
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        email: `${role}@example.com`,
        password,
        name: role === "dispatcher" ? "John Coordinador" : "Mensajero Uno",
        role,
      }),
    });
    if (!created.ok) throw new Error(`Test ${role} account could not be created`);
  }

  // The courier account is linked to its courier, as the courier app needs (feature 003).
  const linked = await container.exec([
    "psql",
    "-U",
    container.getUsername(),
    "-d",
    container.getDatabase(),
    "-c",
    `insert into couriers (id, name, phone, user_id)
      select gen_random_uuid(), 'Mensajero Uno', '3004445566', id
      from users where email = 'courier@example.com';`,
  ]);
  if (linked.exitCode !== 0) throw new Error(`Courier link failed: ${linked.output}`);

  await mkdir(authDir, { recursive: true });
  await saveStorageState("owner", await signIn("propietario@example.com"));
  await saveStorageState("dispatcher", await signIn("dispatcher@example.com"));
  await saveStorageState("courier", await signIn("courier@example.com"));

  // Private, disposable test fixture access: public-link E2E can read generated codes
  // before the later panel-link feature exposes them. Never print or bundle this file.
  const databaseFixture = `${authDir}database.json`;
  await rm(databaseFixture, { force: true });
  await writeFile(databaseFixture, JSON.stringify({ databaseUrl: env.DATABASE_URL }), {
    flag: "wx",
    mode: 0o600,
  });

  return async () => {
    try {
      for (const child of processes) if (child.pid) process.kill(-child.pid);
      await Promise.all([container.stop(), storage.stop()]);
    } finally {
      await rm(databaseFixture, { force: true });
    }
  };
}
