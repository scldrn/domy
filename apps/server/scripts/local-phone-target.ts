import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  randomInt,
  randomUUID,
  X509Certificate,
} from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants, readFileSync } from "node:fs";
import { chmod, lstat, mkdir, open, readFile, readdir, rename, rm } from "node:fs/promises";
import { once } from "node:events";
import https, { type RequestOptions } from "node:https";
import http, { type IncomingHttpHeaders } from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bogotaLocalTimeToInstant, bogotaToday, normalizeText } from "@domy/domain";
import { z } from "zod";

const repositoryRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const privateRoot = path.join(repositoryRoot, ".git", "local-phone-target");
const targetPortDefaults = { https: 8443, postgres: 15432, s3: 19100 } as const;
const postgresImage = "postgres:18";
const s3Image = "andrewgaul/s3proxy:4.1.1";
const maxHttpBodyBytes = 2 * 1024 * 1024;
const postgresImageDigest = z
  .string()
  .regex(/^(?:docker\.io\/)?(?:library\/)?postgres@sha256:[a-f0-9]{64}$/);
const s3ImageDigest = z
  .string()
  .regex(/^(?:docker\.io\/)?andrewgaul\/s3proxy@sha256:[a-f0-9]{64}$/);

const runIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{6,38}[a-z0-9]$/);
const privateIpv4Schema = z
  .string()
  .refine((value) => net.isIPv4(value), "Use a private LAN IPv4 address.")
  .refine(isPrivateIpv4, "Use a private RFC 1918 LAN address.");
const portSchema = z.number().int().min(1024).max(65535);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

const targetStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: runIdSchema,
    phase: z.enum(["preparing", "prepared", "running", "failed", "stopped"]),
    createdAt: z.iso.datetime({ offset: true }),
    hostIp: privateIpv4Schema,
    ports: z.object({ https: portSchema, postgres: portSchema, s3: portSchema }).strict(),
    projectName: z.string(),
    sourceDigest: digestSchema,
    schemaDigest: digestSchema,
    lockDigest: digestSchema,
    buildDigest: digestSchema.nullable(),
    images: z.object({ postgres: postgresImageDigest, s3proxy: s3ImageDigest }).strict(),
    databaseName: z.string().regex(/^[a-z0-9_]+$/),
    databaseUser: z.string().regex(/^phone_[A-Za-z0-9_-]{16,}$/),
    databasePassword: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
    authSecret: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
    s3Identity: z.string().regex(/^[A-Za-z0-9_-]{16,}$/),
    s3Credential: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
    localPush: z.boolean(),
    vapid: z
      .object({
        publicKey: z.string().regex(/^[A-Za-z0-9_-]+$/),
        privateKey: z.string().regex(/^[A-Za-z0-9_-]+$/),
        subject: z.url(),
      })
      .strict()
      .nullable(),
    accounts: z
      .object({
        owner: z
          .object({
            id: z.uuid(),
            email: z.email(),
            password: z.string().regex(/^[A-Za-z0-9_-]{16,}$/),
          })
          .strict(),
        dispatcher: z
          .object({
            id: z.uuid(),
            email: z.email(),
            password: z.string().regex(/^[A-Za-z0-9_-]{16,}$/),
          })
          .strict(),
        courier: z
          .object({
            id: z.uuid(),
            email: z.email(),
            password: z.string().regex(/^[A-Za-z0-9_-]{16,}$/),
          })
          .strict(),
        unlinkedCourier: z
          .object({
            id: z.uuid(),
            email: z.email(),
            password: z.string().regex(/^[A-Za-z0-9_-]{16,}$/),
          })
          .strict(),
      })
      .strict(),
    fixture: z
      .object({
        ownerId: z.uuid(),
        dispatcherId: z.uuid(),
        courierUserId: z.uuid(),
        unlinkedCourierUserId: z.uuid(),
        courierId: z.uuid(),
        routeId: z.uuid(),
        shipmentId: z.uuid(),
        photoId: z.uuid(),
        photoRecordId: z.uuid(),
        municipalityId: z.uuid(),
        rateZoneId: z.uuid(),
        neighborhoodId: z.uuid(),
        merchantId: z.uuid(),
        pickupPointId: z.uuid(),
        serviceDate: z.iso.date(),
        trackingNumber: z.string().regex(/^\d{8}$/),
      })
      .strict(),
    process: z
      .object({
        pid: z.number().int().positive(),
        startedAt: z.string().min(1),
        title: z.string().min(1),
        fingerprint: digestSchema,
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((state, context) => {
    if (state.projectName !== expectedProjectName(state.runId)) {
      context.addIssue({ code: "custom", path: ["projectName"], message: "Project mismatch." });
    }
    if (state.databaseName !== `domy_phone_${state.runId.replaceAll("-", "_")}`) {
      context.addIssue({ code: "custom", path: ["databaseName"], message: "Database mismatch." });
    }
    const expectedEmails = [
      ["owner", `owner-${state.runId}@local.invalid`],
      ["dispatcher", `dispatch-${state.runId}@local.invalid`],
      ["courier", `courier-${state.runId}@local.invalid`],
      ["unlinkedCourier", `unlinked-${state.runId}@local.invalid`],
    ] as const;
    for (const [account, email] of expectedEmails) {
      if (state.accounts[account].email !== email) {
        context.addIssue({
          code: "custom",
          path: ["accounts", account, "email"],
          message: "Synthetic account mismatch.",
        });
      }
    }
    if (new Set(Object.values(state.ports)).size !== 3) {
      context.addIssue({ code: "custom", path: ["ports"], message: "Ports must be distinct." });
    }
    if (
      ["prepared", "running"].includes(state.phase) &&
      state.localPush !== (state.vapid !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["vapid"],
        message: "Push configuration mismatch.",
      });
    }
    if ((state.phase === "running") !== (state.process !== null)) {
      context.addIssue({ code: "custom", path: ["process"], message: "Process state mismatch." });
    }
  });

export type TargetState = z.infer<typeof targetStateSchema>;

function databaseUrlFor(state: TargetState): string {
  return `postgres://${encodeURIComponent(state.databaseUser)}:${encodeURIComponent(state.databasePassword)}@127.0.0.1:${String(state.ports.postgres)}/${state.databaseName}`;
}

export type CommandOptions =
  | {
      command: "prepare";
      runId: string | undefined;
      hostIp: string;
      ports: { https: number; postgres: number; s3: number };
      localPush: boolean;
      dryRun: boolean;
    }
  | { command: "serve" | "stop"; runId: string }
  | { command: "verify"; runId: string; sealBuild: boolean };

export class TargetError extends Error {
  readonly safeMessage: string;

  constructor(safeMessage: string) {
    super(safeMessage);
    this.safeMessage = safeMessage;
    this.name = "TargetError";
  }
}

function isPrivateIpv4(value: string): boolean {
  if (!net.isIPv4(value)) return false;
  const octets = value.split(".").map(Number);
  const first = octets[0];
  const second = octets[1];
  if (first === undefined || second === undefined) return false;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function validateRunId(value: string): string {
  const parsed = runIdSchema.safeParse(value);
  if (!parsed.success) throw new TargetError("El identificador de ejecución no es válido.");
  return parsed.data;
}

function parsePort(value: string, flag: string): number {
  if (!/^[0-9]{1,5}$/.test(value)) throw new TargetError(`El puerto de ${flag} no es válido.`);
  const parsed = portSchema.safeParse(Number(value));
  if (!parsed.success) throw new TargetError(`El puerto de ${flag} no es válido.`);
  return parsed.data;
}

export function parseCommand(args: readonly string[]): CommandOptions {
  const [command, ...rest] = args;
  const values = new Map<string, string>();
  const switches = new Set<string>();
  const valueFlags = new Set(["--run-id", "--host-ip", "--https-port", "--pg-port", "--s3-port"]);
  const switchFlags = new Set(["--dry-run", "--enable-local-push", "--seal-build"]);

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (!flag?.startsWith("--"))
      throw new TargetError("La línea de comandos tiene argumentos sobrantes.");
    if (valueFlags.has(flag)) {
      const value = rest[index + 1];
      if (!value || value.startsWith("--") || values.has(flag)) {
        throw new TargetError(`Falta o se repite el valor de ${flag}.`);
      }
      values.set(flag, value);
      index += 1;
      continue;
    }
    if (!switchFlags.has(flag) || switches.has(flag)) {
      throw new TargetError(`La opción ${flag} no se reconoce o está repetida.`);
    }
    switches.add(flag);
  }

  const runId = values.get("--run-id");
  if (runId !== undefined) validateRunId(runId);
  if (command === "prepare") {
    if (switches.has("--seal-build")) {
      throw new TargetError("--seal-build solo se usa con verify.");
    }
    const hostIp = values.get("--host-ip");
    if (!hostIp || !privateIpv4Schema.safeParse(hostIp).success) {
      throw new TargetError("Indica una IPv4 privada vigente con --host-ip.");
    }
    const ports = {
      https: parsePort(values.get("--https-port") ?? String(targetPortDefaults.https), "HTTPS"),
      postgres: parsePort(
        values.get("--pg-port") ?? String(targetPortDefaults.postgres),
        "PostgreSQL",
      ),
      s3: parsePort(values.get("--s3-port") ?? String(targetPortDefaults.s3), "S3"),
    };
    if (new Set(Object.values(ports)).size !== 3) {
      throw new TargetError("Los puertos HTTPS, PostgreSQL y S3 deben ser distintos.");
    }
    return {
      command,
      runId,
      hostIp,
      ports,
      localPush: switches.has("--enable-local-push"),
      dryRun: switches.has("--dry-run"),
    };
  }
  if (command === "serve" || command === "stop") {
    if (!runId) throw new TargetError("Indica una ejecución con --run-id.");
    if (
      values.has("--host-ip") ||
      values.has("--https-port") ||
      values.has("--pg-port") ||
      values.has("--s3-port") ||
      switches.size > 0
    ) {
      throw new TargetError(`Las opciones indicadas no aplican a ${command}.`);
    }
    return { command, runId };
  }
  if (command === "verify") {
    if (!runId) throw new TargetError("Indica una ejecución con --run-id.");
    if (
      values.has("--host-ip") ||
      values.has("--https-port") ||
      values.has("--pg-port") ||
      values.has("--s3-port") ||
      switches.has("--dry-run") ||
      switches.has("--enable-local-push")
    ) {
      throw new TargetError("verify solo acepta --run-id y, opcionalmente, --seal-build.");
    }
    return { command, runId, sealBuild: switches.has("--seal-build") };
  }
  throw new TargetError("Usa prepare, serve, verify o stop.");
}

export function expectedProjectName(runId: string): string {
  return `domy-phone-${validateRunId(runId)}`;
}

export function parseTargetState(input: unknown, runId: string): TargetState {
  const expectedId = validateRunId(runId);
  const result = targetStateSchema.safeParse(input);
  if (!result.success || result.data.runId !== expectedId) {
    throw new TargetError("El estado privado no es válido o no corresponde a esta ejecución.");
  }
  return result.data;
}

type TargetPaths = {
  directory: string;
  state: string;
  compose: string;
  emptyEnv: string;
  postgresEnv: string;
  s3Env: string;
  credentials: string;
  tls: string;
  dist: string;
};

function pathsFor(runId: string): TargetPaths {
  const directory = path.join(privateRoot, validateRunId(runId));
  return {
    directory,
    state: path.join(directory, "state.json"),
    compose: path.join(directory, "compose.yaml"),
    emptyEnv: path.join(directory, "empty.env"),
    postgresEnv: path.join(directory, "postgres.env"),
    s3Env: path.join(directory, "s3proxy.env"),
    credentials: path.join(directory, "phone-access.txt"),
    tls: path.join(directory, "tls"),
    dist: path.join(directory, "dist"),
  };
}

function safeError(message: string): never {
  throw new TargetError(message);
}

async function assertPrivateDirectory(directory: string): Promise<void> {
  const info = await lstat(directory).catch(() => null);
  if (!info || !info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o700) {
    safeError("El directorio privado no existe o tiene permisos inseguros.");
  }
  if (typeof process.getuid === "function" && info.uid !== process.getuid()) {
    safeError("El directorio privado no pertenece al usuario actual.");
  }
}

async function assertPrivateFile(file: string, expectedMode = 0o600): Promise<void> {
  const info = await lstat(file).catch(() => null);
  if (!info || !info.isFile() || info.isSymbolicLink() || (info.mode & 0o777) !== expectedMode) {
    safeError("Un archivo privado falta o tiene permisos inseguros.");
  }
  if (typeof process.getuid === "function" && info.uid !== process.getuid()) {
    safeError("Un archivo privado no pertenece al usuario actual.");
  }
}

async function assertPrivateRoot(create: boolean): Promise<void> {
  const gitPath = path.join(repositoryRoot, ".git");
  const gitInfo = await lstat(gitPath).catch(() => null);
  if (!gitInfo || !gitInfo.isDirectory() || gitInfo.isSymbolicLink()) {
    safeError("No se puede validar el directorio privado de Git.");
  }
  const rootInfo = await lstat(privateRoot).catch(() => null);
  if (!rootInfo) {
    if (create) {
      await mkdir(privateRoot, { mode: 0o700 });
      await chmod(privateRoot, 0o700);
    } else {
      return;
    }
  } else if (
    !rootInfo.isDirectory() ||
    rootInfo.isSymbolicLink() ||
    (rootInfo.mode & 0o777) !== 0o700
  ) {
    safeError("El directorio privado de ejecuciones tiene permisos inseguros.");
  }
  await assertPrivateDirectory(privateRoot);
}

async function loadState(runId: string): Promise<TargetState> {
  const paths = pathsFor(runId);
  await assertPrivateRoot(false);
  await assertPrivateDirectory(paths.directory);
  await assertPrivateFile(paths.state);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(paths.state, "utf8"));
  } catch {
    safeError("No se pudo leer el estado privado de la ejecución.");
  }
  const state = parseTargetState(parsed, runId);
  if (state.projectName !== expectedProjectName(runId)) {
    safeError("El proyecto guardado no coincide con la ejecución.");
  }
  return state;
}

async function writePrivateFile(
  file: string,
  value: string | Uint8Array,
  mode = 0o600,
): Promise<void> {
  const handle = await open(
    file,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
    mode,
  ).catch(() => null);
  if (!handle) safeError("No se pudo crear un archivo privado nuevo.");
  try {
    await handle.writeFile(value);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(file, mode);
}

async function replacePrivateState(file: string, state: TargetState): Promise<void> {
  const temp = `${file}.${randomUUID()}.tmp`;
  await writePrivateFile(temp, `${JSON.stringify(state, null, 2)}\n`);
  try {
    const existing = await lstat(file);
    if (!existing.isFile() || existing.isSymbolicLink())
      safeError("El archivo de estado no es regular.");
  } catch (error) {
    if (error instanceof TargetError) throw error;
    safeError("El archivo de estado privado desapareció.");
  }
  await rename(temp, file);
  await chmod(file, 0o600);
}

function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function safeRunFile(command: string, args: string[], label: string, cwd = repositoryRoot): string {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
      env: safeChildEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    safeError(`Falló la operación local: ${label}. No se imprimieron datos privados.`);
  }
}

function safeChildEnvironment(): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {
    PATH: process.env["PATH"] ?? "/usr/bin:/bin:/usr/sbin:/sbin",
    HOME: process.env["HOME"],
    LANG: process.env["LANG"] ?? "C",
    DOCKER_CONFIG: process.env["DOCKER_CONFIG"],
    DOCKER_CONTEXT: process.env["DOCKER_CONTEXT"],
    DOCKER_HOST: process.env["DOCKER_HOST"],
  };
  return result;
}

function assertLocalDocker(): void {
  const override = process.env["DOCKER_HOST"];
  if (override && !/^(unix|npipe):\/\//.test(override)) {
    safeError("Docker debe usar un endpoint local, no remoto.");
  }
  const context = safeRunFile("docker", ["context", "show"], "validar el contexto local de Docker");
  const endpoint = safeRunFile(
    "docker",
    ["context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}"],
    "validar el endpoint de Docker",
  );
  if (!/^(unix|npipe):\/\//.test(endpoint)) {
    safeError("El contexto activo de Docker no es local.");
  }
  safeRunFile("docker", ["info", "--format", "{{.OSType}}"], "comprobar Docker local");
}

function composeArgs(
  paths: TargetPaths,
  state: Pick<TargetState, "runId" | "projectName">,
): string[] {
  return [
    "compose",
    "--env-file",
    paths.emptyEnv,
    "--project-name",
    state.projectName,
    "--project-directory",
    paths.directory,
    "--file",
    paths.compose,
  ];
}

async function runCompose(
  paths: TargetPaths,
  state: TargetState,
  args: string[],
  label: string,
): Promise<string> {
  await verifyPrivateComposeFiles(paths, state);
  return safeRunFile("docker", [...composeArgs(paths, state), ...args], label, paths.directory);
}

type ResourceIdentity = {
  labels: Record<string, string> | null;
  name: string;
  image: string | null;
  portBindings: unknown;
  running: boolean | null;
  health: string | null;
};

function resourceNames(kind: "container" | "volume" | "network", state: TargetState): string[] {
  const expected = expectedResourceNames(state);
  const expectedNames = {
    container: [...expected.containers],
    volume: [...expected.volumes],
    network: [...expected.networks],
  }[kind];
  const byRunId = safeRunFile(
    "docker",
    kind === "container"
      ? [
          "ps",
          "-a",
          "--format",
          "{{.Names}}",
          "--filter",
          `label=com.domy.local.run-id=${state.runId}`,
        ]
      : [
          kind,
          "ls",
          "--format",
          "{{.Name}}",
          "--filter",
          `label=com.domy.local.run-id=${state.runId}`,
        ],
    `consultar recursos ${kind}`,
  );
  const byProject = safeRunFile(
    "docker",
    kind === "container"
      ? [
          "ps",
          "-a",
          "--format",
          "{{.Names}}",
          "--filter",
          `label=com.docker.compose.project=${state.projectName}`,
        ]
      : [
          kind,
          "ls",
          "--format",
          "{{.Name}}",
          "--filter",
          `label=com.docker.compose.project=${state.projectName}`,
        ],
    `consultar recursos ${kind}`,
  );
  const byExactName = expectedNames.map((name) =>
    safeRunFile(
      "docker",
      kind === "container"
        ? ["ps", "-a", "--format", "{{.Names}}", "--filter", `name=^${name}$`]
        : [kind, "ls", "--format", "{{.Name}}", "--filter", `name=^${name}$`],
      `consultar nombre exacto de ${kind}`,
    ),
  );
  return [
    ...new Set([byRunId, byProject, ...byExactName].join("\n").split(/\r?\n/).filter(Boolean)),
  ].sort();
}

function inspectResource(
  kind: "container" | "volume" | "network",
  identifier: string,
): ResourceIdentity {
  const format =
    kind === "container"
      ? "{{json .Config.Labels}}|{{.Name}}|{{.Config.Image}}|{{json .HostConfig.PortBindings}}|{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}"
      : "{{json .Labels}}|{{.Name}}";
  const output = safeRunFile(
    "docker",
    ["inspect", "--type", kind, "--format", format, identifier],
    `verificar etiquetas de ${kind}`,
  );
  const separator = output.indexOf("|");
  const secondSeparator = output.indexOf("|", separator + 1);
  const thirdSeparator = output.indexOf("|", secondSeparator + 1);
  const fourthSeparator = output.indexOf("|", thirdSeparator + 1);
  if (
    separator < 0 ||
    (kind === "container" && (secondSeparator < 0 || thirdSeparator < 0 || fourthSeparator < 0))
  ) {
    safeError(`No se pudieron verificar las etiquetas de ${kind}.`);
  }
  let labels: unknown;
  try {
    labels = JSON.parse(output.slice(0, separator));
  } catch {
    safeError(`Las etiquetas de ${kind} no son legibles.`);
  }
  const parsed = z.record(z.string(), z.string()).nullable().safeParse(labels);
  if (!parsed.success) safeError(`Las etiquetas de ${kind} no tienen formato válido.`);
  if (kind !== "container") {
    return {
      labels: parsed.data,
      name: output.slice(separator + 1),
      image: null,
      portBindings: null,
      running: null,
      health: null,
    };
  }
  let portBindings: unknown;
  try {
    portBindings = JSON.parse(output.slice(thirdSeparator + 1, fourthSeparator));
  } catch {
    safeError("Los puertos del contenedor no tienen formato válido.");
  }
  return {
    labels: parsed.data,
    name: output.slice(separator + 1, secondSeparator),
    image: output.slice(secondSeparator + 1, thirdSeparator),
    portBindings,
    running: output.slice(fourthSeparator + 1, output.indexOf("|", fourthSeparator + 1)) === "true",
    health: output.slice(output.indexOf("|", fourthSeparator + 1) + 1),
  };
}

function expectedResourceNames(state: TargetState) {
  return {
    containers: new Set([`${state.projectName}-postgres-1`, `${state.projectName}-s3proxy-1`]),
    volumes: new Set([`${state.projectName}-pgdata`, `${state.projectName}-s3data`]),
    networks: new Set([`${state.projectName}-network`]),
  };
}

function assertResourceLabels(
  resource: ResourceIdentity,
  kind: "container" | "volume" | "network",
  state: TargetState,
): void {
  const labels = resource.labels;
  if (
    labels?.["com.domy.local.managed"] !== "true" ||
    labels["com.domy.local.run-id"] !== state.runId ||
    labels["com.domy.local.project-name"] !== state.projectName ||
    labels["com.docker.compose.project"] !== state.projectName
  ) {
    safeError(`Un recurso ${kind} no pertenece de forma verificable a esta ejecución.`);
  }
  if (kind === "container") assertContainerConfiguration(resource, state);
}

function assertContainerConfiguration(resource: ResourceIdentity, state: TargetState): void {
  const postgres = resource.name === `/${state.projectName}-postgres-1`;
  const expectedImage = postgres ? state.images.postgres : state.images.s3proxy;
  const containerPort = postgres ? "5432/tcp" : "80/tcp";
  const hostPort = String(postgres ? state.ports.postgres : state.ports.s3);
  const bindingsSchema = z.record(
    z.string(),
    z.array(z.object({ HostIp: z.string(), HostPort: z.string() }).strict()),
  );
  const bindings = bindingsSchema.safeParse(resource.portBindings);
  if (!bindings.success) {
    safeError(
      "La imagen o publicación de puertos del contenedor no coincide con el destino aislado.",
    );
  }
  const containerBindings = bindings.data[containerPort];
  const portBinding = containerBindings?.[0];
  if (
    resource.image !== expectedImage ||
    Object.keys(bindings.data).length !== 1 ||
    containerBindings?.length !== 1 ||
    !portBinding ||
    portBinding.HostIp !== "127.0.0.1" ||
    portBinding.HostPort !== hostPort
  ) {
    safeError(
      "La imagen o publicación de puertos del contenedor no coincide con el destino aislado.",
    );
  }
}

type ResourceExpectation = "absent" | "complete" | "owned" | "partial" | "stopped";

function verifyComposeResources(state: TargetState, expectation: ResourceExpectation): void {
  const resources = {
    container: resourceNames("container", state),
    volume: resourceNames("volume", state),
    network: resourceNames("network", state),
  };
  const expected = expectedResourceNames(state);
  const expectedByKind = {
    container: expected.containers,
    volume: expected.volumes,
    network: expected.networks,
  };
  for (const kind of ["container", "volume", "network"] as const) {
    const names = resources[kind];
    const expectedNames = expectedByKind[kind];
    if (expectation === "absent" && names.length > 0) {
      safeError("Ya existen recursos con la identidad solicitada; no se sobrescriben.");
    }
    if (names.some((name) => !expectedNames.has(name)) || names.length > expectedNames.size) {
      safeError(`La operación se detuvo: hay recursos ${kind} ajenos o inesperados.`);
    }
    if (expectation === "complete" && names.length !== expectedNames.size) {
      safeError(`La operación se detuvo: falta un recurso ${kind} esperado.`);
    }
    if (expectation === "stopped" && kind !== "volume" && names.length !== 0) {
      safeError(`Un recurso ${kind} sigue activo después de detener el proyecto.`);
    }
    if (expectation === "owned" && names.length !== expectedNames.size) {
      safeError(`La operación se detuvo: falta un recurso ${kind} esperado.`);
    }
    for (const name of names) {
      const inspected = inspectResource(kind, name);
      if (inspected.name !== (kind === "container" ? `/${name}` : name)) {
        safeError(`La identidad de un recurso ${kind} cambió.`);
      }
      if (
        kind === "container" &&
        expectation === "complete" &&
        (!inspected.running || (name.endsWith("-postgres-1") && inspected.health !== "healthy"))
      ) {
        safeError("Un servicio aislado no está ejecutándose en estado saludable.");
      }
      assertResourceLabels(inspected, kind, state);
    }
  }
}

function cachedImageDigest(image: string, schema: z.ZodString): string {
  const output = safeRunFile(
    "docker",
    ["image", "inspect", "--format", "{{json .RepoDigests}}", image],
    `validar imagen local ${image}`,
  );
  let digests: unknown;
  try {
    digests = JSON.parse(output);
  } catch {
    safeError(`La identidad de imagen ${image} no es válida.`);
  }
  const parsed = z.array(z.string()).safeParse(digests);
  if (!parsed.success) safeError(`La imagen ${image} no tiene digest de repositorio.`);
  const digest = parsed.data.find((entry) => schema.safeParse(entry).success);
  if (typeof digest !== "string") safeError(`La imagen ${image} no tiene digest esperado.`);
  return digest;
}

function verifyImagesCached(state: TargetState): void {
  for (const image of [state.images.postgres, state.images.s3proxy]) {
    safeRunFile(
      "docker",
      ["image", "inspect", "--format", "{{.Id}}", image],
      "validar digest de imagen guardado",
    );
  }
}

function assertHostInterface(hostIp: string): void {
  const present = Object.values(os.networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .some((entry) => entry.family === "IPv4" && !entry.internal && entry.address === hostIp);
  if (!present) safeError("La IPv4 indicada ya no pertenece a una interfaz LAN local.");
}

async function assertPortAvailable(host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => {
      reject(new TargetError(`El puerto ${String(port)} no está disponible.`));
    });
    server.listen({ host, port, exclusive: true }, () => {
      server.close((error) => {
        if (error) reject(new TargetError("No se pudo liberar la comprobación de puerto."));
        else resolve();
      });
    });
  });
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function composeDocument(state: TargetState): string {
  const labelLines = [
    `      com.domy.local.managed: "true"`,
    `      com.domy.local.run-id: ${yamlScalar(state.runId)}`,
    `      com.domy.local.project-name: ${yamlScalar(state.projectName)}`,
  ].join("\n");
  return [
    `name: ${yamlScalar(state.projectName)}`,
    "services:",
    "  postgres:",
    `    image: ${state.images.postgres}`,
    '    restart: "no"',
    "    env_file: ./postgres.env",
    "    ports:",
    `      - ${yamlScalar(`127.0.0.1:${String(state.ports.postgres)}:5432`)}`,
    "    volumes:",
    "      - pgdata:/var/lib/postgresql",
    "    healthcheck:",
    '      test: ["CMD-SHELL", "pg_isready -U \\"$$POSTGRES_USER\\" -d \\"$$POSTGRES_DB\\""]',
    "      interval: 2s",
    "      timeout: 3s",
    "      retries: 30",
    "    networks: [phone-target]",
    "    labels:",
    labelLines,
    "  s3proxy:",
    `    image: ${state.images.s3proxy}`,
    '    restart: "no"',
    "    env_file: ./s3proxy.env",
    "    ports:",
    `      - ${yamlScalar(`127.0.0.1:${String(state.ports.s3)}:80`)}`,
    "    volumes:",
    "      - s3data:/data",
    "    networks: [phone-target]",
    "    labels:",
    labelLines,
    "volumes:",
    "  pgdata:",
    `    name: ${yamlScalar(`${state.projectName}-pgdata`)}`,
    "    labels:",
    labelLines,
    "  s3data:",
    `    name: ${yamlScalar(`${state.projectName}-s3data`)}`,
    "    labels:",
    labelLines,
    "networks:",
    "  phone-target:",
    `    name: ${yamlScalar(`${state.projectName}-network`)}`,
    "    labels:",
    labelLines,
    "",
  ].join("\n");
}

function postgresEnvironment(state: TargetState): string {
  return [
    `POSTGRES_DB=${state.databaseName}`,
    `POSTGRES_USER=${state.databaseUser}`,
    `POSTGRES_PASSWORD=${state.databasePassword}`,
    "",
  ].join("\n");
}

function s3Environment(state: TargetState): string {
  return [
    "S3PROXY_AUTHORIZATION=aws-v2-or-v4",
    `S3PROXY_IDENTITY=${state.s3Identity}`,
    `S3PROXY_CREDENTIAL=${state.s3Credential}`,
    "JCLOUDS_PROVIDER=filesystem",
    "JCLOUDS_FILESYSTEM_BASEDIR=/data",
    "",
  ].join("\n");
}

async function verifyPrivateComposeFiles(paths: TargetPaths, state: TargetState): Promise<void> {
  await assertPrivateDirectory(paths.directory);
  await Promise.all(
    [paths.compose, paths.emptyEnv, paths.postgresEnv, paths.s3Env].map((file) =>
      assertPrivateFile(file),
    ),
  );
  const [compose, emptyEnv, postgresEnv, s3Env] = await Promise.all([
    readFile(paths.compose, "utf8"),
    readFile(paths.emptyEnv, "utf8"),
    readFile(paths.postgresEnv, "utf8"),
    readFile(paths.s3Env, "utf8"),
  ]);
  if (
    compose !== composeDocument(state) ||
    emptyEnv !== "" ||
    postgresEnv !== postgresEnvironment(state) ||
    s3Env !== s3Environment(state)
  ) {
    safeError("La configuración privada de Compose no coincide con el estado validado.");
  }
}

function digestFiles(files: readonly { path: string; bytes: Uint8Array }[]): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function walkFiles(
  directory: string,
  relative: string,
): Promise<{ path: string; bytes: Uint8Array }[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: { path: string; bytes: Uint8Array }[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    const relativePath = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink()) safeError("La identidad de fuentes no admite enlaces simbólicos.");
    if (entry.isDirectory()) files.push(...(await walkFiles(absolute, relativePath)));
    else if (entry.isFile()) files.push({ path: relativePath, bytes: await readFile(absolute) });
    else safeError("La identidad de fuentes contiene un archivo especial.");
  }
  return files;
}

const sourcePaths = [
  "apps/server/src",
  "apps/server/scripts/local-phone-target.ts",
  "apps/server/package.json",
  "apps/server/tsconfig.json",
  "apps/web/src",
  "apps/web/public",
  "apps/web/vite.config.ts",
  "apps/web/index.html",
  "apps/web/tsconfig.json",
  "apps/web/package.json",
  "packages/domain/src",
  "packages/domain/package.json",
  "packages/domain/tsconfig.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
] as const;

const schemaPaths = [
  "apps/server/src/db/schema",
  "apps/server/src/db/migrations",
  "apps/server/src/db/migrate.ts",
  "apps/server/src/db/client.ts",
] as const;

const lockPaths = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "apps/server/package.json",
  "apps/web/package.json",
  "packages/domain/package.json",
] as const;

async function digestPaths(paths: readonly string[]): Promise<string> {
  const files: { path: string; bytes: Uint8Array }[] = [];
  for (const item of paths) {
    const absolute = path.join(repositoryRoot, item);
    const info = await lstat(absolute).catch(() => null);
    if (!info) safeError(`Falta un archivo de identidad del candidato (${path.basename(item)}).`);
    if (info.isSymbolicLink()) safeError("Un archivo de identidad es un enlace simbólico.");
    if (info.isDirectory()) files.push(...(await walkFiles(absolute, item)));
    else if (info.isFile()) files.push({ path: item, bytes: await readFile(absolute) });
    else safeError("Un archivo de identidad no es regular.");
  }
  return digestFiles(files);
}

async function digestDirectory(directory: string): Promise<string> {
  const info = await lstat(directory).catch(() => null);
  if (!info || !info.isDirectory() || info.isSymbolicLink())
    safeError("Falta el build privado del panel.");
  return digestFiles(await walkFiles(directory, "dist"));
}

async function securePrivateTree(directory: string): Promise<void> {
  const info = await lstat(directory).catch(() => null);
  if (!info || !info.isDirectory() || info.isSymbolicLink()) {
    safeError("El build privado contiene una ruta insegura.");
  }
  await chmod(directory, 0o700);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) safeError("El build privado no admite enlaces simbólicos.");
    if (entry.isDirectory()) await securePrivateTree(absolute);
    else if (entry.isFile()) await chmod(absolute, 0o600);
    else safeError("El build privado contiene un archivo especial.");
  }
}

async function assertPrivateTree(directory: string): Promise<void> {
  const info = await lstat(directory).catch(() => null);
  if (!info || !info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o700) {
    safeError("El build privado tiene directorios con permisos inseguros.");
  }
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) safeError("El build privado no admite enlaces simbólicos.");
    if (entry.isDirectory()) await assertPrivateTree(absolute);
    else if (entry.isFile()) await assertPrivateFile(absolute);
    else safeError("El build privado contiene un archivo especial.");
  }
}

async function updateState(paths: TargetPaths, state: TargetState): Promise<TargetState> {
  const parsed = parseTargetState(state, state.runId);
  await replacePrivateState(paths.state, parsed);
  return parsed;
}

async function generateCertificates(paths: TargetPaths, state: TargetState): Promise<void> {
  await mkdir(paths.tls, { mode: 0o700 });
  await chmod(paths.tls, 0o700);
  const caConfig = [
    "[req]",
    "distinguished_name=dn",
    "x509_extensions=v3_ca",
    "prompt=no",
    "default_md=sha256",
    "[dn]",
    `CN=Domy Local Phone Test CA ${state.runId}`,
    "[v3_ca]",
    "basicConstraints=critical,CA:true,pathlen:0",
    "keyUsage=critical,keyCertSign,cRLSign",
    "subjectKeyIdentifier=hash",
    "authorityKeyIdentifier=keyid:always,issuer",
    "",
  ].join("\n");
  const leafConfig = [
    "[req]",
    "distinguished_name=dn",
    "req_extensions=v3_req",
    "prompt=no",
    "default_md=sha256",
    "[dn]",
    `CN=${state.hostIp}`,
    "[v3_req]",
    "basicConstraints=critical,CA:false",
    "keyUsage=critical,digitalSignature,keyEncipherment",
    "extendedKeyUsage=serverAuth",
    "subjectAltName=@alt_names",
    "[v3_server]",
    "basicConstraints=critical,CA:false",
    "keyUsage=critical,digitalSignature,keyEncipherment",
    "extendedKeyUsage=serverAuth",
    "subjectAltName=@alt_names",
    "[alt_names]",
    `IP.1=${state.hostIp}`,
    "IP.2=127.0.0.1",
    "DNS.1=localhost",
    "",
  ].join("\n");
  const caConfigPath = path.join(paths.tls, "ca.cnf");
  const leafConfigPath = path.join(paths.tls, "server.cnf");
  await writePrivateFile(caConfigPath, caConfig);
  await writePrivateFile(leafConfigPath, leafConfig);
  const previousUmask = process.umask(0o077);
  try {
    safeRunFile(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:3072",
        "-nodes",
        "-sha256",
        "-days",
        "14",
        "-keyout",
        "ca-key.pem",
        "-out",
        "ca.crt",
        "-config",
        caConfigPath,
        "-extensions",
        "v3_ca",
      ],
      "generar la autoridad certificadora local",
      paths.tls,
    );
    safeRunFile(
      "openssl",
      [
        "req",
        "-new",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-sha256",
        "-keyout",
        "server-key.pem",
        "-out",
        "server.csr",
        "-config",
        leafConfigPath,
      ],
      "generar la identidad HTTPS local",
      paths.tls,
    );
    safeRunFile(
      "openssl",
      [
        "x509",
        "-req",
        "-in",
        "server.csr",
        "-CA",
        "ca.crt",
        "-CAkey",
        "ca-key.pem",
        "-CAcreateserial",
        "-out",
        "server.crt",
        "-days",
        "7",
        "-sha256",
        "-extfile",
        leafConfigPath,
        "-extensions",
        "v3_server",
      ],
      "firmar el certificado HTTPS local",
      paths.tls,
    );
    safeRunFile(
      "openssl",
      ["x509", "-in", "ca.crt", "-outform", "DER", "-out", "domy-phone-ca.cer"],
      "exportar solo el certificado público de CA",
      paths.tls,
    );
    await chmod(path.join(paths.tls, "server-key.pem"), 0o600);
    await chmod(path.join(paths.tls, "ca.crt"), 0o600);
    await chmod(path.join(paths.tls, "server.crt"), 0o600);
    await chmod(path.join(paths.tls, "domy-phone-ca.cer"), 0o600);
    await rm(path.join(paths.tls, "ca-key.pem"), { force: true });
    await rm(path.join(paths.tls, "server.csr"), { force: true });
  } finally {
    process.umask(previousUmask);
  }
  await verifyCertificate(state, paths);
}

async function verifyCertificate(state: TargetState, paths: TargetPaths): Promise<void> {
  await assertPrivateDirectory(paths.tls);
  for (const file of ["ca.crt", "server.crt", "server-key.pem", "domy-phone-ca.cer"]) {
    await assertPrivateFile(path.join(paths.tls, file));
  }
  const ca = new X509Certificate(await readFile(path.join(paths.tls, "ca.crt")));
  const leaf = new X509Certificate(await readFile(path.join(paths.tls, "server.crt")));
  const publicCa = new X509Certificate(await readFile(path.join(paths.tls, "domy-phone-ca.cer")));
  const privateKey = createPrivateKey(await readFile(path.join(paths.tls, "server-key.pem")));
  const certificateKey = leaf.publicKey.export({ type: "spki", format: "der" });
  const privateCertificateKey = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  const now = Date.now();
  if (
    !ca.ca ||
    leaf.ca ||
    !ca.verify(ca.publicKey) ||
    !leaf.verify(ca.publicKey) ||
    publicCa.fingerprint256 !== ca.fingerprint256 ||
    !certificateKey.equals(privateCertificateKey) ||
    Date.parse(leaf.validFrom) > now ||
    Date.parse(leaf.validTo) <= now ||
    Date.parse(ca.validFrom) > now ||
    Date.parse(ca.validTo) <= now ||
    !leaf.checkIP(state.hostIp) ||
    !leaf.checkIP("127.0.0.1") ||
    !leaf.checkHost("localhost")
  ) {
    safeError("La cadena o identidad TLS no coincide con el destino local.");
  }
  const sans = leaf.subjectAltName
    ?.split(", ")
    .map((value) => value.trim())
    .sort();
  const expectedSans = [
    `DNS:localhost`,
    `IP Address:${state.hostIp}`,
    "IP Address:127.0.0.1",
  ].sort();
  if (JSON.stringify(sans) !== JSON.stringify(expectedSans)) {
    safeError("El certificado TLS no contiene exactamente los SAN autorizados.");
  }
  if (leaf.issuer !== ca.subject) safeError("La CA del certificado no coincide exactamente.");
}

async function prepare(options: Extract<CommandOptions, { command: "prepare" }>): Promise<void> {
  const runId = options.runId ?? randomUUID().replaceAll("-", "").slice(0, 24);
  validateRunId(runId);
  const projectName = expectedProjectName(runId);
  const ports = options.ports;
  const origin = `https://${options.hostIp}:${String(ports.https)}`;
  const paths = pathsFor(runId);

  if (options.dryRun) {
    console.log(
      `Preparación validada: ${runId} · ${origin} · sin escribir archivos ni crear recursos.`,
    );
    return;
  }

  assertHostInterface(options.hostIp);
  assertLocalDocker();
  const images = {
    postgres: cachedImageDigest(postgresImage, postgresImageDigest),
    s3proxy: cachedImageDigest(s3Image, s3ImageDigest),
  };
  await Promise.all([
    assertPortAvailable(options.hostIp, ports.https),
    assertPortAvailable("127.0.0.1", ports.postgres),
    assertPortAvailable("127.0.0.1", ports.s3),
  ]);
  await assertPrivateRoot(false);

  const initialState = targetStateSchema.parse({
    schemaVersion: 1,
    runId,
    phase: "preparing",
    createdAt: new Date().toISOString(),
    hostIp: options.hostIp,
    ports,
    projectName,
    sourceDigest: await digestPaths(sourcePaths),
    schemaDigest: await digestPaths(schemaPaths),
    lockDigest: await digestPaths(lockPaths),
    buildDigest: null,
    images,
    databaseName: `domy_phone_${runId.replaceAll("-", "_")}`,
    databaseUser: `phone_${randomSecret(12)}`,
    databasePassword: randomSecret(32),
    authSecret: randomSecret(48),
    s3Identity: randomSecret(16),
    s3Credential: randomSecret(32),
    localPush: options.localPush,
    vapid: null,
    accounts: {
      owner: {
        id: randomUUID(),
        email: `owner-${runId}@local.invalid`,
        password: randomSecret(24),
      },
      dispatcher: {
        id: randomUUID(),
        email: `dispatch-${runId}@local.invalid`,
        password: randomSecret(24),
      },
      courier: {
        id: randomUUID(),
        email: `courier-${runId}@local.invalid`,
        password: randomSecret(24),
      },
      unlinkedCourier: {
        id: randomUUID(),
        email: `unlinked-${runId}@local.invalid`,
        password: randomSecret(24),
      },
    },
    fixture: {
      ownerId: randomUUID(),
      dispatcherId: randomUUID(),
      courierUserId: randomUUID(),
      unlinkedCourierUserId: randomUUID(),
      courierId: randomUUID(),
      routeId: randomUUID(),
      shipmentId: randomUUID(),
      photoId: randomUUID(),
      photoRecordId: randomUUID(),
      municipalityId: randomUUID(),
      rateZoneId: randomUUID(),
      neighborhoodId: randomUUID(),
      merchantId: randomUUID(),
      pickupPointId: randomUUID(),
      serviceDate: bogotaToday(new Date()),
      trackingNumber: String(randomInt(10_000_000, 100_000_000)),
    },
    process: null,
  });
  const preflightState = parseTargetState(initialState, runId);
  verifyComposeResources(preflightState, "absent");
  verifyImagesCached(preflightState);
  await assertPrivateRoot(true);
  const existing = await lstat(paths.directory).catch(() => null);
  if (existing) safeError("La ejecución ya existe; usa otro identificador y no se sobrescribe.");
  await mkdir(paths.directory, { mode: 0o700 });
  await chmod(paths.directory, 0o700);
  let state = preflightState;

  try {
    await writePrivateFile(paths.state, `${JSON.stringify(preflightState, null, 2)}\n`);
    await writePrivateFile(paths.emptyEnv, "");
    await writePrivateFile(paths.postgresEnv, postgresEnvironment(preflightState));
    await writePrivateFile(paths.s3Env, s3Environment(preflightState));
    await writePrivateFile(paths.compose, composeDocument(preflightState));
    await runCompose(paths, state, ["config", "--quiet"], "validar Compose aislado");
    await generateCertificates(paths, state);
    await runCompose(
      paths,
      state,
      ["up", "--detach", "--pull", "never", "--wait", "--wait-timeout", "90"],
      "iniciar servicios aislados",
    );
    verifyComposeResources(state, "owned");
    await waitForTcpPort("127.0.0.1", ports.postgres, 90_000);
    await waitForHttpReady(ports.s3, 90_000);
    verifyComposeResources(state, "complete");
    const persistState = async (nextState: TargetState) => {
      state = nextState;
      await updateState(paths, nextState);
    };
    state = await applyMigrationsAndSeed(state, persistState);
    const currentSource = await digestPaths(sourcePaths);
    if (currentSource !== state.sourceDigest)
      safeError("El código cambió durante la preparación; destino bloqueado.");
    state = { ...state, phase: "prepared" };
    await updateState(paths, state);
    await writePrivateFile(paths.credentials, credentialsText(state));
    console.log(`Destino sintético preparado: ${origin}`);
    console.log(
      `Certificado público para confianza manual: ${path.join(paths.tls, "domy-phone-ca.cer")}`,
    );
    console.log(`Credenciales sintéticas: ${paths.credentials}`);
    console.log("No se inició el panel; genera y sella su build en la ventana autorizada.");
  } catch (error) {
    state = { ...state, phase: "failed" };
    await updateState(paths, state).catch(() => undefined);
    if (error instanceof TargetError) throw error;
    safeError(
      "Falló la preparación del destino. El estado privado conserva la ejecución para revisión segura.",
    );
  }
}

function credentialsText(state: TargetState): string {
  const lines = [
    "Credenciales sintéticas del destino local Domy.",
    `Origen: https://${state.hostIp}:${String(state.ports.https)}`,
    "No reutilices estas cuentas ni contraseñas fuera de este destino.",
    "",
    `Owner: ${state.accounts.owner.email}`,
    `Owner password: ${state.accounts.owner.password}`,
    "",
    `Dispatcher: ${state.accounts.dispatcher.email}`,
    `Dispatcher password: ${state.accounts.dispatcher.password}`,
    "",
    `Courier: ${state.accounts.courier.email}`,
    `Courier password: ${state.accounts.courier.password}`,
    "",
    `Unlinked courier (expected to be denied courier data): ${state.accounts.unlinkedCourier.email}`,
    `Unlinked courier password: ${state.accounts.unlinkedCourier.password}`,
    "",
  ];
  return lines.join("\n");
}

function runtimeEnvironment(state: TargetState): void {
  process.env["NODE_ENV"] = "production";
  process.env["TEST"] = "";
  process.env["DATABASE_URL"] = databaseUrlFor(state);
  process.env["BETTER_AUTH_SECRET"] = state.authSecret;
  const publicOrigin = `https://${state.hostIp}:${String(state.ports.https)}`;
  process.env["APP_URL"] = publicOrigin;
  process.env["PUBLIC_BASE_URL"] = publicOrigin;
  process.env["API_PORT"] = String(state.ports.https);
  process.env["EMAIL_FROM"] = "local-test@invalid.example";
  process.env["RESEND_API_KEY"] = "";
  process.env["SENTRY_DSN"] = "";
  process.env["VITE_SENTRY_DSN"] = "";
  process.env["BETTER_AUTH_TELEMETRY"] = "false";
  process.env["BETTER_AUTH_TELEMETRY_DEBUG"] = "false";
  process.env["S3_ENDPOINT"] = `http://127.0.0.1:${String(state.ports.s3)}`;
  process.env["S3_REGION"] = "us-east-1";
  process.env["S3_BUCKET"] = "domy-fotos";
  process.env["S3_ACCESS_KEY_ID"] = state.s3Identity;
  process.env["S3_SECRET_ACCESS_KEY"] = state.s3Credential;
  process.env["S3_FORCE_PATH_STYLE"] = "true";
  delete process.env["VAPID_PUBLIC_KEY"];
  delete process.env["VAPID_PRIVATE_KEY"];
  delete process.env["VAPID_SUBJECT"];
  if (state.vapid) {
    process.env["VAPID_PUBLIC_KEY"] = state.vapid.publicKey;
    process.env["VAPID_PRIVATE_KEY"] = state.vapid.privateKey;
    process.env["VAPID_SUBJECT"] = state.vapid.subject;
  }
}

async function applyMigrationsAndSeed(
  state: TargetState,
  persistState: (state: TargetState) => Promise<void>,
): Promise<TargetState> {
  runtimeEnvironment(state);
  const [{ runMigrations }, { createDb }, { createAuth }, { createLogger }, schema, webPush] =
    await Promise.all([
      import("../src/db/migrate.ts"),
      import("../src/db/client.ts"),
      import("../src/auth.ts"),
      import("../src/lib/logger.ts"),
      import("../src/db/schema/index.ts"),
      state.localPush ? import("web-push") : Promise.resolve(null),
    ]);

  let nextState = state;
  if (state.localPush && !state.vapid && webPush) {
    nextState = {
      ...state,
      vapid: {
        ...webPush.default.generateVAPIDKeys(),
        subject: "mailto:local-test@example.invalid",
      },
    };
    await persistState(nextState);
  }

  const databaseUrl = databaseUrlFor(state);
  await runMigrations(databaseUrl);
  const db = createDb(databaseUrl);
  const logger = createLogger("info");
  const auth = createAuth({
    db,
    logger,
    secret: state.authSecret,
    baseUrl: `https://${state.hostIp}:${String(state.ports.https)}`,
    sendResetPassword: () => {
      logger.info("Password recovery requested; local target does not deliver email.");
      return Promise.resolve();
    },
  });

  try {
    const makeUser = async (
      account: TargetState["accounts"][keyof TargetState["accounts"]],
      name: string,
      role: "owner" | "dispatcher" | "courier",
    ) => {
      const result = await auth.api.createUser({
        body: { email: account.email, password: account.password, name, role },
      });
      return result.user.id;
    };
    const [ownerId, dispatcherId, courierUserId, unlinkedCourierUserId] = await Promise.all([
      makeUser(nextState.accounts.owner, "Operador de prueba", "owner"),
      makeUser(nextState.accounts.dispatcher, "Despachador de prueba", "dispatcher"),
      makeUser(nextState.accounts.courier, "Mensajero de prueba", "courier"),
      makeUser(nextState.accounts.unlinkedCourier, "Mensajero sin vínculo", "courier"),
    ]);
    nextState = {
      ...nextState,
      accounts: {
        owner: { ...nextState.accounts.owner, id: ownerId },
        dispatcher: { ...nextState.accounts.dispatcher, id: dispatcherId },
        courier: { ...nextState.accounts.courier, id: courierUserId },
        unlinkedCourier: { ...nextState.accounts.unlinkedCourier, id: unlinkedCourierUserId },
      },
      fixture: {
        ...nextState.fixture,
        ownerId,
        dispatcherId,
        courierUserId,
        unlinkedCourierUserId,
      },
    };
    await persistState(nextState);
    const now = new Date();
    const serviceDate = bogotaToday(now);
    nextState = { ...nextState, fixture: { ...nextState.fixture, serviceDate } };
    await persistState(nextState);
    const ids = nextState.fixture;
    const effectiveFrom = bogotaLocalTimeToInstant(serviceDate, "00:00");
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.municipalities)
        .values({ id: ids.municipalityId, name: "Municipio de prueba" });
      await tx.insert(schema.rateZones).values({ id: ids.rateZoneId, name: "Zona de prueba" });
      await tx.insert(schema.neighborhoods).values({
        id: ids.neighborhoodId,
        name: "Barrio de prueba",
        nameNormalized: normalizeText("Barrio de prueba"),
        municipalityId: ids.municipalityId,
        rateZoneId: ids.rateZoneId,
        kind: "neighborhood",
        createdBy: ids.ownerId,
      });
      await tx.insert(schema.merchants).values({
        id: ids.merchantId,
        name: "Tienda de prueba",
        nameNormalized: normalizeText("Tienda de prueba"),
        whatsappPhone: "3000000000",
      });
      await tx.insert(schema.pickupPoints).values({
        id: ids.pickupPointId,
        merchantId: ids.merchantId,
        label: "Punto de prueba",
        address: "Dirección sintética 123",
        neighborhoodId: ids.neighborhoodId,
        isDefault: true,
      });
      await tx.insert(schema.rateCardEntries).values({
        id: randomUUID(),
        kind: "zone_rate",
        merchantId: null,
        rateZoneId: ids.rateZoneId,
        amount: 13000,
        effectiveFrom,
        createdBy: ids.ownerId,
      });
      await tx.insert(schema.companySettings).values({
        officeAddress: "Calle de prueba 123",
        officeNeighborhoodId: ids.neighborhoodId,
      });
      await tx.insert(schema.couriers).values({
        id: ids.courierId,
        name: "Mensajero de prueba",
        phone: "3000000000",
        userId: ids.courierUserId,
      });
      await tx.insert(schema.routes).values({
        id: ids.routeId,
        serviceDate,
        number: 1,
        courierId: ids.courierId,
        status: "in_progress",
        dispatchedAt: now,
        dispatchedBy: ids.dispatcherId,
        createdBy: ids.dispatcherId,
      });
      await tx.insert(schema.shipments).values({
        id: ids.shipmentId,
        trackingNumber: ids.trackingNumber,
        kind: "delivery",
        status: "dispatched",
        serviceDate,
        merchantId: ids.merchantId,
        pickupPointId: ids.pickupPointId,
        pickupAddress: "Dirección sintética 123",
        pickupNeighborhoodId: ids.neighborhoodId,
        recipientName: "Persona de prueba",
        recipientNameNormalized: normalizeText("Persona de prueba"),
        recipientPhone: "3000000001",
        recipientAddress: "Dirección de entrega 456",
        recipientNeighborhoodId: ids.neighborhoodId,
        rateZoneId: ids.rateZoneId,
        serviceLevel: "standard",
        calculatedFee: 13000,
        fee: 13000,
        paymentMode: "cash_on_delivery",
        codAmount: 50000,
        packageSize: "small",
        packageCount: 1,
        merchantReference: `LOCAL-${runIdShort(state.runId)}`,
        instructions: "Registro sintético para aceptación local.",
        routeId: ids.routeId,
        version: 1,
        registeredAt: now,
        registeredBy: ids.dispatcherId,
      });
      const pickupStopId = randomUUID();
      const deliveryStopId = randomUUID();
      await tx.insert(schema.routeStops).values([
        {
          id: pickupStopId,
          routeId: ids.routeId,
          position: 0,
          kind: "pickup",
          address: "Dirección sintética 123",
          neighborhoodId: ids.neighborhoodId,
        },
        {
          id: deliveryStopId,
          routeId: ids.routeId,
          position: 1,
          kind: "delivery",
          address: "Dirección de entrega 456",
          neighborhoodId: ids.neighborhoodId,
        },
      ]);
      await tx.insert(schema.routeTasks).values([
        { id: randomUUID(), stopId: pickupStopId, shipmentId: ids.shipmentId, kind: "pickup" },
        { id: randomUUID(), stopId: deliveryStopId, shipmentId: ids.shipmentId, kind: "delivery" },
      ]);
      await tx.insert(schema.courierRecords).values({
        id: ids.photoRecordId,
        shipmentId: ids.shipmentId,
        kind: "delivery",
        courierId: ids.courierId,
        authorUserId: ids.courierUserId,
        onBehalf: false,
        routeId: ids.routeId,
        occurredAt: now,
        recordedAt: now,
        outcome: "not_applied",
        notAppliedReason: "not_picked_up",
        receivedByName: "Persona de prueba",
      });
      await tx.insert(schema.recordPhotos).values({
        id: ids.photoId,
        recordId: ids.photoRecordId,
        kind: "proof",
        storageKey: `photos/${ids.photoRecordId}/${ids.photoId}.jpg`,
      });
    });
    const { createStorage } = await import("../src/lib/storage.ts");
    const storage = createStorage({
      endpoint: `http://127.0.0.1:${String(state.ports.s3)}`,
      region: "us-east-1",
      bucket: "domy-fotos",
      accessKeyId: state.s3Identity,
      secretAccessKey: state.s3Credential,
      forcePathStyle: true,
    });
    await storage.ensureBucket();
  } finally {
    await db.$client.end();
  }
  await persistState(nextState);
  return nextState;
}

function runIdShort(runId: string): string {
  return runId.replaceAll("-", "").slice(0, 8).toUpperCase();
}

async function waitForTcpPort(host: string, port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host, port });
      socket.setTimeout(1000);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        resolve(false);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (ready) return;
    await delay(500);
  }
  safeError("El servicio local no quedó disponible dentro del tiempo esperado.");
}

async function waitForHttpReady(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await new Promise<boolean>((resolve) => {
      const request = http.request(
        { hostname: "127.0.0.1", port, path: "/", method: "GET", timeout: 1000 },
        (response) => {
          response.resume();
          resolve((response.statusCode ?? 500) < 500);
        },
      );
      request.once("error", () => {
        resolve(false);
      });
      request.once("timeout", () => {
        request.destroy();
        resolve(false);
      });
      request.end();
    });
    if (ready) return;
    await delay(500);
  }
  safeError("El almacenamiento S3 local no quedó disponible dentro del tiempo esperado.");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sealOrVerifyBuild(
  state: TargetState,
  paths: TargetPaths,
  sealBuild: boolean,
): Promise<TargetState> {
  if (sealBuild) await securePrivateTree(paths.dist);
  else await assertPrivateTree(paths.dist);
  const [sourceDigest, schemaDigest, lockDigest, buildDigest] = await Promise.all([
    digestPaths(sourcePaths),
    digestPaths(schemaPaths),
    digestPaths(lockPaths),
    digestDirectory(paths.dist),
  ]);
  if (
    sourceDigest !== state.sourceDigest ||
    schemaDigest !== state.schemaDigest ||
    lockDigest !== state.lockDigest
  ) {
    safeError("La fuente, el esquema o el lockfile difieren del candidato preparado.");
  }
  await assertPrivateDirectory(paths.directory);
  const index = await lstat(path.join(paths.dist, "index.html")).catch(() => null);
  const manifest = await lstat(path.join(paths.dist, "manifest.webmanifest")).catch(() => null);
  const serviceWorker = await lstat(path.join(paths.dist, "sw.js")).catch(() => null);
  if (
    !index?.isFile() ||
    index.isSymbolicLink() ||
    !manifest?.isFile() ||
    manifest.isSymbolicLink() ||
    !serviceWorker?.isFile() ||
    serviceWorker.isSymbolicLink()
  ) {
    safeError("El bundle no contiene HTML, manifiesto y service worker requeridos.");
  }
  const manifestData: unknown = JSON.parse(
    await readFile(path.join(paths.dist, "manifest.webmanifest"), "utf8"),
  );
  const webManifest = z
    .object({ name: z.string(), start_url: z.string(), scope: z.string(), display: z.string() })
    .safeParse(manifestData);
  if (
    !webManifest.success ||
    webManifest.data.name !== "Domy" ||
    webManifest.data.start_url !== "/" ||
    webManifest.data.scope !== "/" ||
    webManifest.data.display !== "standalone"
  ) {
    safeError("El manifiesto PWA no coincide con el destino esperado.");
  }
  await verifyCertificate(state, paths);
  if (sealBuild) {
    if (state.phase !== "prepared" || state.process !== null)
      safeError("Solo se puede sellar un build preparado sin listener.");
    if (state.buildDigest !== null && state.buildDigest !== buildDigest)
      safeError("El build ya sellado no se puede reemplazar.");
    const sealed = { ...state, buildDigest };
    await updateState(paths, sealed);
    return sealed;
  }
  if (state.buildDigest === null || state.buildDigest !== buildDigest)
    safeError("El bundle no coincide con su identidad sellada.");
  return state;
}

async function verify(options: Extract<CommandOptions, { command: "verify" }>): Promise<void> {
  const state = await loadState(options.runId);
  const paths = pathsFor(state.runId);
  if (state.phase === "stopped" || state.phase === "failed" || state.phase === "preparing") {
    safeError("La ejecución no está lista para verificarse.");
  }
  assertHostInterface(state.hostIp);
  verifyImagesCached(state);
  verifyComposeResources(state, "complete");
  const verifiedState = await sealOrVerifyBuild(state, paths, options.sealBuild);
  if (options.sealBuild) {
    console.log("Build, fuentes, esquema, lockfile y TLS quedaron sellados en estado privado.");
    return;
  }
  if (verifiedState.phase !== "running" || !verifiedState.process) {
    safeError("El destino HTTPS todavía no está sirviendo.");
  }
  verifyComposeResources(verifiedState, "complete");
  verifyProcessIdentity(verifiedState);
  await verifyLiveTarget(verifiedState, paths);
  console.log(
    `Verificación local completada: https://${verifiedState.hostIp}:${String(verifiedState.ports.https)}`,
  );
}

function requestHttps(
  state: TargetState,
  paths: TargetPaths,
  pathname: string,
  options: { method?: string; headers?: Record<string, string>; body?: Uint8Array | string } = {},
): Promise<{ status: number; headers: IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const requestOptions: RequestOptions = {
      hostname: state.hostIp,
      port: state.ports.https,
      path: pathname,
      method: options.method ?? "GET",
      headers: options.headers,
      ca: readFileSync(path.join(paths.tls, "ca.crt")),
      rejectUnauthorized: true,
      timeout: 10_000,
    };
    const request = https.request(requestOptions, (response) => {
      const chunks: Buffer[] = [];
      let length = 0;
      response.on("data", (chunk: Buffer) => {
        length += chunk.byteLength;
        if (length > maxHttpBodyBytes) {
          request.destroy(new Error("response too large"));
          return;
        }
        chunks.push(chunk);
      });
      response.once("end", () => {
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    request.once("error", () => {
      reject(new TargetError("La verificación HTTPS con CA e IP SAN falló."));
    });
    request.once("timeout", () =>
      request.destroy(new TargetError("La aplicación local no respondió a tiempo.")),
    );
    if (options.body !== undefined) request.write(options.body);
    request.end();
  });
}

async function verifyLiveTarget(state: TargetState, paths: TargetPaths): Promise<void> {
  const home = await requestHttps(state, paths, "/");
  const html = home.body.toString("utf8");
  if (
    home.status !== 200 ||
    !/text\/html/i.test(home.headers["content-type"] ?? "") ||
    !html.includes("<html")
  ) {
    safeError("El HTML del panel no responde correctamente por HTTPS.");
  }
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));
  if (assets.length === 0) safeError("El HTML no enlaza assets compilados.");
  for (const asset of assets) {
    const response = await requestHttps(state, paths, asset);
    if (response.status !== 200 || response.body.byteLength === 0)
      safeError("Un asset compilado no se pudo leer.");
  }
  for (const required of ["/manifest.webmanifest", "/sw.js"]) {
    const response = await requestHttps(state, paths, required);
    if (response.status !== 200 || response.body.byteLength === 0)
      safeError("El manifiesto o service worker no se pudo leer.");
  }

  const owner = await signIn(state, paths, state.accounts.owner);
  const wrongOrigin = await authMutationProbe(state, paths, owner, "https://invalid.example");
  if (wrongOrigin.status !== 403) safeError("Better Auth no rechazó el Origin ajeno con 403.");
  const missingOrigin = await authMutationProbe(state, paths, owner, undefined);
  if (missingOrigin.status !== 403)
    safeError("Better Auth no rechazó el Origin ausente según el contrato local.");

  const dispatcher = await signIn(state, paths, state.accounts.dispatcher);
  const courier = await signIn(state, paths, state.accounts.courier);
  const unlinked = await signIn(state, paths, state.accounts.unlinkedCourier);
  for (const account of [owner, dispatcher, courier, unlinked])
    verifySecureCookies(account.cookies);
  await assertSession(state, paths, owner, state.accounts.owner.id);
  await assertSession(state, paths, courier, state.accounts.courier.id);

  const ownerUsers = await requestHttps(state, paths, "/api/auth/admin/list-users", {
    headers: { cookie: owner.cookie, origin: originOf(state) },
  });
  const dispatcherUsers = await requestHttps(state, paths, "/api/auth/admin/list-users", {
    headers: { cookie: dispatcher.cookie, origin: originOf(state) },
  });
  if (ownerUsers.status !== 200 || dispatcherUsers.status !== 403) {
    safeError("La lectura administrativa no respeta la separación owner/dispatcher.");
  }
  const merchantCatalog = await requestHttps(state, paths, "/api/merchants?active=true", {
    headers: { cookie: owner.cookie, origin: originOf(state) },
  });
  const catalog = z
    .object({ items: z.array(z.object({ id: z.string(), name: z.string() })) })
    .safeParse(JSON.parse(merchantCatalog.body.toString("utf8")));
  if (
    merchantCatalog.status !== 200 ||
    !catalog.success ||
    !catalog.data.items.some((merchant) => merchant.id === state.fixture.merchantId)
  ) {
    safeError("El catálogo sintético de clientes no está disponible.");
  }
  const pickupCatalog = await requestHttps(
    state,
    paths,
    `/api/merchants/${state.fixture.merchantId}/pickup-points`,
    { headers: { cookie: owner.cookie, origin: originOf(state) } },
  );
  const pickupPoints = z
    .object({
      items: z.array(z.object({ id: z.string(), label: z.string(), isDefault: z.boolean() })),
    })
    .safeParse(JSON.parse(pickupCatalog.body.toString("utf8")));
  if (
    pickupCatalog.status !== 200 ||
    !pickupPoints.success ||
    !pickupPoints.data.items.some(
      (point) => point.id === state.fixture.pickupPointId && point.isDefault,
    )
  ) {
    safeError("El punto de recogida sintético no está disponible.");
  }
  const office = await requestHttps(state, paths, "/api/settings", {
    headers: { cookie: dispatcher.cookie, origin: originOf(state) },
  });
  const courierOffice = await requestHttps(state, paths, "/api/settings", {
    headers: { cookie: courier.cookie, origin: originOf(state) },
  });
  if (office.status !== 200 || courierOffice.status !== 403) {
    safeError("La lectura de configuración no respeta las reglas de rol.");
  }
  const settings = z
    .object({
      officeAddress: z.string().nullable(),
      officeNeighborhood: z.object({ id: z.string(), name: z.string() }).nullable(),
    })
    .safeParse(JSON.parse(office.body.toString("utf8")));
  if (
    !settings.success ||
    settings.data.officeAddress !== "Calle de prueba 123" ||
    settings.data.officeNeighborhood?.id !== state.fixture.neighborhoodId
  ) {
    safeError("La configuración sintética de oficina no está disponible.");
  }
  const dispatcherPatch = await requestHttps(state, paths, "/api/settings", {
    method: "PATCH",
    headers: {
      cookie: dispatcher.cookie,
      origin: originOf(state),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      actionId: randomUUID(),
      officeAddress: "Calle de prueba 123",
      officeNeighborhoodId: state.fixture.neighborhoodId,
    }),
  });
  const ownerPatch = await requestHttps(state, paths, "/api/settings", {
    method: "PATCH",
    headers: { cookie: owner.cookie, origin: originOf(state), "content-type": "application/json" },
    body: JSON.stringify({
      actionId: randomUUID(),
      officeAddress: "Calle de prueba 123",
      officeNeighborhoodId: state.fixture.neighborhoodId,
    }),
  });
  if (dispatcherPatch.status !== 403 || ownerPatch.status !== 200) {
    safeError("El cambio de configuración no respeta owner-only.");
  }

  const route = await requestHttps(state, paths, "/api/courier/route", {
    headers: { cookie: courier.cookie, origin: originOf(state) },
  });
  const deniedRoute = await requestHttps(state, paths, "/api/courier/route", {
    headers: { cookie: unlinked.cookie, origin: originOf(state) },
  });
  if (route.status !== 200 || deniedRoute.status !== 403)
    safeError("El acceso a ruta no respeta el vínculo courier.");
  const snapshot = z
    .object({
      route: z
        .object({
          id: z.string(),
          stops: z.array(z.object({ tasks: z.array(z.object({ shipmentId: z.string() })) })),
        })
        .nullable(),
    })
    .safeParse(JSON.parse(route.body.toString("utf8")));
  if (
    !snapshot.success ||
    snapshot.data.route?.id !== state.fixture.routeId ||
    !snapshot.data.route.stops.some((stop) =>
      stop.tasks.some((task) => task.shipmentId === state.fixture.shipmentId),
    )
  ) {
    safeError("La ruta sintética no está lista para la cuenta courier.");
  }

  const photoBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const upload = await requestHttps(state, paths, `/api/courier/photos/${state.fixture.photoId}`, {
    method: "PUT",
    headers: { cookie: courier.cookie, origin: originOf(state), "content-type": "image/jpeg" },
    body: photoBytes,
  });
  const privateRead = await requestHttps(state, paths, `/api/photos/${state.fixture.photoId}`, {
    headers: { cookie: courier.cookie, origin: originOf(state) },
  });
  const anonymousRead = await requestHttps(state, paths, `/api/photos/${state.fixture.photoId}`);
  if (
    upload.status !== 204 ||
    privateRead.status !== 200 ||
    !privateRead.body.equals(photoBytes) ||
    !(privateRead.headers["cache-control"] ?? "").includes("no-store") ||
    anonymousRead.status !== 401
  ) {
    safeError("La foto privada no pasó su prueba local de carga y lectura.");
  }
}

function originOf(state: TargetState): string {
  return `https://${state.hostIp}:${String(state.ports.https)}`;
}

async function authMutationProbe(
  state: TargetState,
  paths: TargetPaths,
  owner: Session,
  origin: string | undefined,
): Promise<{ status: number }> {
  const headers: Record<string, string> = {
    cookie: owner.cookie,
    "content-type": "application/json",
    "X-Domy-Actor-Id": state.accounts.owner.id,
  };
  if (origin !== undefined) headers.origin = origin;
  const result = await requestHttps(state, paths, "/api/auth/admin/ban-user", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: randomUUID(), userId: randomUUID() }),
  });
  return { status: result.status };
}

type Session = { cookie: string; cookies: string[] };

async function signIn(
  state: TargetState,
  paths: TargetPaths,
  account: TargetState["accounts"][keyof TargetState["accounts"]],
): Promise<Session> {
  const body = JSON.stringify({ email: account.email, password: account.password });
  const requestOptions = {
    method: "POST",
    headers: { origin: originOf(state), "content-type": "application/json" },
    body,
  } as const;
  let response = await requestHttps(state, paths, "/api/auth/sign-in/email", requestOptions);
  if (response.status === 429) {
    const retryHeader = response.headers["x-retry-after"];
    const parsedRetryAfter = z.coerce
      .number()
      .int()
      .min(1)
      .max(10)
      .safeParse(
        typeof retryHeader === "string" && /^(?:[1-9]|10)$/.test(retryHeader)
          ? retryHeader
          : undefined,
      );
    if (!parsedRetryAfter.success) {
      safeError("Better Auth limitó el inicio de sesión sin un X-Retry-After válido.");
    }
    console.info(
      `Better Auth limitó una sesión sintética; reintento único en ${String(parsedRetryAfter.data)} s.`,
    );
    await delay(parsedRetryAfter.data * 1000);
    response = await requestHttps(state, paths, "/api/auth/sign-in/email", requestOptions);
  }
  const cookies = response.headers["set-cookie"];
  const parsedCookies = z.array(z.string()).safeParse(cookies);
  if (response.status !== 200 || !parsedCookies.success || parsedCookies.data.length === 0) {
    safeError("Better Auth no creó una sesión sintética segura.");
  }
  const cookie = parsedCookies.data.map((value) => value.split(";", 1)[0]).join("; ");
  if (!cookie) safeError("Better Auth no entregó cookies de sesión.");
  return { cookie, cookies: parsedCookies.data };
}

function verifySecureCookies(sessionCookies: readonly string[]): void {
  const sessionCookie = sessionCookies.find((cookie) => /session_token=/i.test(cookie));
  if (
    !sessionCookie ||
    !/;\s*secure(?:;|$)/i.test(sessionCookie) ||
    !/;\s*httponly(?:;|$)/i.test(sessionCookie) ||
    !/;\s*samesite=lax(?:;|$)/i.test(sessionCookie)
  ) {
    safeError("Las cookies nativas no cumplen Secure, HttpOnly y SameSite=Lax.");
  }
}

async function assertSession(
  state: TargetState,
  paths: TargetPaths,
  session: Session,
  userId: string,
): Promise<void> {
  const response = await requestHttps(state, paths, "/api/auth/get-session", {
    headers: { cookie: session.cookie, origin: originOf(state) },
  });
  if (response.status !== 200) safeError("No se pudo recuperar una sesión local.");
  const parsed = z
    .object({ user: z.object({ id: z.string() }).nullable() })
    .safeParse(JSON.parse(response.body.toString("utf8")));
  if (!parsed.success || parsed.data.user?.id !== userId)
    safeError("La sesión no corresponde a la identidad esperada.");
}

function processSnapshot(
  pid: number,
): { startedAt: string; command: string; fingerprint: string } | null {
  let output: string;
  try {
    output = execFileSync("ps", ["-p", String(pid), "-o", "lstart=", "-o", "command="], {
      cwd: repositoryRoot,
      encoding: "utf8",
      timeout: 5_000,
      env: safeChildEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error: unknown) {
    const status =
      error instanceof Error && "status" in error ? z.number().safeParse(error.status) : null;
    if (status?.success && status.data === 1) return null;
    safeError("No se pudo verificar la identidad del proceso local.");
  }
  // macOS ps prints lstart in a fixed 24-character field before the full argv.
  const match = output.match(/^(.{24})\s+(.+)$/);
  if (!match?.[1] || !match[2])
    safeError("La huella del proceso local no tiene formato verificable.");
  const startedAt = match[1].trim();
  const command = match[2].trim();
  return {
    startedAt,
    command,
    fingerprint: createHash("sha256").update(`${startedAt}\0${command}`).digest("hex"),
  };
}

function verifyProcessIdentity(state: TargetState): void {
  const processState = state.process;
  if (!processState) safeError("El proceso HTTPS no está registrado.");
  const snapshot = processSnapshot(processState.pid);
  if (
    !snapshot ||
    snapshot.startedAt !== processState.startedAt ||
    snapshot.fingerprint !== processState.fingerprint ||
    processState.title !== `domy-local-phone-target:${state.runId}` ||
    !snapshot.command.includes(processState.title)
  ) {
    safeError("El PID no coincide con la huella guardada; no se enviará ninguna señal.");
  }
}

async function serve(state: TargetState, paths: TargetPaths): Promise<void> {
  if (state.phase !== "prepared" || state.process || state.buildDigest === null) {
    safeError("La ejecución necesita estado preparado y un build sellado, sin listener previo.");
  }
  assertHostInterface(state.hostIp);
  verifyComposeResources(state, "complete");
  verifyImagesCached(state);
  await sealOrVerifyBuild(state, paths, false);
  await verifyCertificate(state, paths);
  runtimeEnvironment(state);
  const [
    { createApp },
    { createDb },
    { createLogger },
    { createStorage },
    { createClock },
    nodeServer,
  ] = await Promise.all([
    import("../src/app.ts"),
    import("../src/db/client.ts"),
    import("../src/lib/logger.ts"),
    import("../src/lib/storage.ts"),
    import("../src/lib/clock.ts"),
    import("@hono/node-server"),
  ]);
  const db = createDb(databaseUrlFor(state));
  const logger = createLogger("info");
  const storage = createStorage({
    endpoint: `http://127.0.0.1:${String(state.ports.s3)}`,
    region: "us-east-1",
    bucket: "domy-fotos",
    accessKeyId: state.s3Identity,
    secretAccessKey: state.s3Credential,
    forcePathStyle: true,
  });
  const app = createApp({
    db,
    authConfig: {
      secret: state.authSecret,
      baseUrl: originOf(state),
      sendResetPassword: () => {
        logger.info("Password recovery requested; local target does not deliver email.");
        return Promise.resolve();
      },
    },
    clock: createClock({ nodeEnv: "production" }),
    logger,
    publicBaseUrl: originOf(state),
    storage,
    push: state.vapid,
    webDist: paths.dist,
  });
  const tls = {
    key: await readFile(path.join(paths.tls, "server-key.pem")),
    cert: await readFile(path.join(paths.tls, "server.crt")),
  };
  const honoListener = nodeServer.getRequestListener(app.fetch);
  const server = https.createServer(tls, (incoming, outgoing) => {
    void honoListener(incoming, outgoing).catch(() => {
      outgoing.destroy();
    });
  });
  const closeServer = async () => {
    if (!server.listening) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  };
  let currentState = state;
  try {
    server.listen({ host: state.hostIp, port: state.ports.https, exclusive: true });
    await once(server, "listening");
    process.title = `domy-local-phone-target:${state.runId}`;
    const snapshot = processSnapshot(process.pid);
    if (!snapshot || !snapshot.command.includes(process.title)) {
      safeError("No se pudo fijar una huella verificable del listener.");
    }
    currentState = await updateState(paths, {
      ...state,
      phase: "running",
      process: {
        pid: process.pid,
        startedAt: snapshot.startedAt,
        title: process.title,
        fingerprint: snapshot.fingerprint,
      },
    });
  } catch (error: unknown) {
    await closeServer().catch(() => undefined);
    await db.$client.end().catch(() => undefined);
    if (error instanceof TargetError) throw error;
    safeError("No se pudo iniciar y registrar el listener HTTPS local.");
  }
  console.log(`Panel HTTPS local disponible en ${originOf(currentState)}.`);
  console.log("La confianza del certificado en cada teléfono es manual; no se desactiva TLS.");

  await new Promise<void>((resolve, reject) => {
    let closing = false;
    const shutdown = async (cause?: Error) => {
      if (closing) return;
      closing = true;
      console.info("Cierre del listener HTTPS local iniciado.");
      try {
        await closeServer();
        await db.$client.end();
        currentState = await updateState(paths, {
          ...currentState,
          phase: "prepared",
          process: null,
        });
        console.info("Cierre del listener HTTPS local completado; estado preparado guardado.");
        if (cause) reject(new TargetError("El listener HTTPS local terminó con un error."));
        else resolve();
      } catch {
        console.error(
          "Falló el cierre seguro del listener HTTPS local; no se muestran datos privados.",
        );
        reject(new TargetError("No se pudo persistir el cierre seguro del listener."));
      } finally {
        process.off("SIGINT", onInterrupt);
        process.off("SIGTERM", onTerminate);
        server.off("error", onServerError);
      }
    };
    const onInterrupt = () => void shutdown();
    const onTerminate = () => void shutdown();
    const onServerError = (error: Error) => void shutdown(error);
    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onTerminate);
    server.once("error", onServerError);
  });
}

async function stop(state: TargetState, paths: TargetPaths): Promise<void> {
  if (state.phase === "stopped") {
    verifyComposeResources(state, "stopped");
    console.log("El listener y los contenedores ya están detenidos; volúmenes preservados.");
    return;
  }
  const initialExpectation =
    state.phase === "failed" || state.phase === "preparing" ? "partial" : "owned";
  verifyComposeResources(state, initialExpectation);
  if (state.process) {
    const snapshot = processSnapshot(state.process.pid);
    if (snapshot) {
      verifyProcessIdentity(state);
      try {
        process.kill(state.process.pid, "SIGTERM");
      } catch {
        safeError("No se pudo detener el PID verificado; no se tocaron los contenedores.");
      }
      await waitForProcessExit(state.process.pid, state.process.fingerprint, 10_000);
      const updated = await loadState(state.runId);
      if (updated.phase !== "prepared" || updated.process !== null) {
        safeError("El proceso no guardó un cierre verificable; se preservaron los recursos.");
      }
      state = updated;
    } else {
      state = await updateState(paths, { ...state, phase: "prepared", process: null });
    }
  }
  verifyComposeResources(state, state.phase === "failed" ? "partial" : "owned");
  const resources = {
    containers: resourceNames("container", state),
    networks: resourceNames("network", state),
  };
  if (resources.containers.length > 0 || resources.networks.length > 0) {
    await runCompose(
      paths,
      state,
      ["down", "--timeout", "10"],
      "detener únicamente el proyecto local verificado",
    );
  }
  verifyComposeResources(state, "stopped");
  const stopped = { ...state, phase: "stopped" as const, process: null };
  await updateState(paths, stopped);
  console.log("Listener, contenedores y red detenidos. Los volúmenes se conservaron sin cambios.");
}

async function waitForProcessExit(
  pid: number,
  fingerprint: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = processSnapshot(pid);
    if (!current) return;
    if (current.fingerprint !== fingerprint)
      safeError("El PID cambió durante el cierre; no se enviaron más señales.");
    await delay(100);
  }
  const current = processSnapshot(pid);
  if (!current) return;
  if (current.fingerprint !== fingerprint)
    safeError("El PID cambió durante el cierre; no se enviaron más señales.");
  safeError("El listener sigue activo; se preservaron los contenedores y volúmenes.");
}

async function run(args: readonly string[]): Promise<void> {
  const options = parseCommand(args);
  if (options.command === "prepare") return prepare(options);
  assertLocalDocker();
  const state = await loadState(options.runId);
  const paths = pathsFor(state.runId);
  if (options.command === "serve") return serve(state, paths);
  if (options.command === "verify") return verify(options);
  return stop(state, paths);
}

if (import.meta.main) {
  try {
    await run(process.argv.slice(2));
  } catch (error: unknown) {
    console.error(
      error instanceof TargetError
        ? error.safeMessage
        : "Falló el destino local. No se imprimieron datos privados.",
    );
    process.exitCode = 1;
  }
}
