import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.ts";

const base = {
  DATABASE_URL: "postgres://domy:domy@localhost:5432/domy",
  BETTER_AUTH_SECRET: "x".repeat(32),
  APP_URL: "http://localhost:5173",
  EMAIL_FROM: "Domy <no-reply@example.com>",
};
const storage = {
  S3_ENDPOINT: "https://nyc3.digitaloceanspaces.com",
  S3_REGION: "nyc3",
  S3_BUCKET: "cohex-fotos",
  S3_ACCESS_KEY_ID: "llave",
  S3_SECRET_ACCESS_KEY: "secreto",
};
const push = {
  VAPID_PUBLIC_KEY: "publica",
  VAPID_PRIVATE_KEY: "privada",
  VAPID_SUBJECT: "mailto:soporte@example.com",
};

/** Photo storage and phone notifications (feature 003, research R6 and R8). */
describe("parseEnv", () => {
  it("leaves trusted-proxy mode unset unless one valid peer IP is configured", () => {
    const direct = parseEnv(base);
    expect(direct.success && direct.data.DOMY_TRUSTED_PROXY_IP).toBeUndefined();

    const configured = parseEnv({ ...base, DOMY_TRUSTED_PROXY_IP: "172.31.254.2" });
    expect(configured.success && configured.data.DOMY_TRUSTED_PROXY_IP).toBe("172.31.254.2");

    const canonicalized = parseEnv({ ...base, DOMY_TRUSTED_PROXY_IP: "2001:0db8:0:0:0:0:0:1" });
    expect(canonicalized.success && canonicalized.data.DOMY_TRUSTED_PROXY_IP).toBe("2001:db8::1");
  });

  it.each([
    "",
    "172.31.254.2/32",
    "172.31.254.2:8443",
    "fe80::1%en0",
    "172.31.254.2,172.31.254.3",
    "proxy.internal",
    " 172.31.254.2",
  ])("rejects an invalid trusted-proxy IP value: %s", (DOMY_TRUSTED_PROXY_IP) => {
    expect(parseEnv({ ...base, DOMY_TRUSTED_PROXY_IP }).success).toBe(false);
  });

  it("derives only the HTTPS browser-reporting origin from a valid Sentry DSN", () => {
    const dsn = "https://public-key@sentry.example.test:8443/sentry/42";
    const result = parseEnv({ ...base, VITE_SENTRY_DSN: dsn });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.browserReportingOrigin).toBe("https://sentry.example.test:8443");
    expect(result.data).not.toHaveProperty("VITE_SENTRY_DSN");
    expect(JSON.stringify(result.data)).not.toContain("public-key");
  });

  it.each([
    "http://public-key@sentry.example.test/42",
    "ftp://public-key@sentry.example.test/42",
    "https://public-key@sentry.example.test/42?secret=marker",
    "https://public-key@sentry.example.test/42#fragment",
    "https://public-key@sentry.example.test/",
    "https://sentry.example.test/42",
    "https://public-key:private@sentry.example.test/42",
    "not-a-url",
  ])("rejects an invalid browser Sentry DSN without echoing it", (VITE_SENTRY_DSN) => {
    const result = parseEnv({ ...base, VITE_SENTRY_DSN });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toContain("public-key");
  });

  it("leaves browser reporting disabled when its DSN is blank or absent", () => {
    const withoutDsn = parseEnv(base);
    const blankDsn = parseEnv({ ...base, VITE_SENTRY_DSN: "" });
    expect(withoutDsn.success && withoutDsn.data.browserReportingOrigin).toBeUndefined();
    expect(blankDsn.success && blankDsn.data.browserReportingOrigin).toBeUndefined();
  });

  it("uses the development storage of compose.yaml when none is set", () => {
    const result = parseEnv(base);
    expect(result.success && result.data.PUBLIC_BASE_URL).toBe("http://localhost:5173");
    expect(result.success && result.data.storage).toEqual({
      endpoint: "http://localhost:9100",
      region: "us-east-1",
      bucket: "domy-fotos",
      accessKeyId: "domy",
      secretAccessKey: "domy-secreto",
      forcePathStyle: true,
    });
    expect(result.success && result.data.push).toBeNull();
  });

  it("normalizes the explicit public origin", () => {
    const result = parseEnv({
      ...base,
      APP_URL: "https://example.com",
      PUBLIC_BASE_URL: "https://EXAMPLE.com:443/",
    });
    expect(result.success && result.data.PUBLIC_BASE_URL).toBe("https://example.com");
  });

  it("uses APP_URL as the fallback, including a non-default local port", () => {
    const result = parseEnv({ ...base, APP_URL: "http://localhost:5174" });
    expect(result.success && result.data.PUBLIC_BASE_URL).toBe("http://localhost:5174");
  });

  it("allows a deliberate development public origin that differs from APP_URL", () => {
    const result = parseEnv({ ...base, PUBLIC_BASE_URL: "https://public.example" });
    expect(result.success && result.data.PUBLIC_BASE_URL).toBe("https://public.example");
  });

  it.each([
    "ftp://example.com",
    "https://user:password@example.com",
    "https://example.com/path",
    "https://example.com?query",
    "https://example.com#fragment",
    "https://example.com?",
    "https://example.com#",
  ])("rejects a public URL that is not a bare HTTP(S) origin: %s", (PUBLIC_BASE_URL) => {
    const result = parseEnv({ ...base, PUBLIC_BASE_URL });
    expect(result.success).toBe(false);
    if (!result.success && PUBLIC_BASE_URL.includes("password")) {
      expect(result.error).not.toContain("password");
    }
  });

  it("requires the storage and notification keys in production", () => {
    const result = parseEnv({ ...base, NODE_ENV: "production" });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error).toMatch(/S3_BUCKET/);
    expect(result.success ? "" : result.error).toMatch(/VAPID_PUBLIC_KEY/);
    expect(result.success ? "" : result.error).toMatch(/PUBLIC_BASE_URL/);
    const complete = parseEnv({
      ...base,
      ...storage,
      ...push,
      APP_URL: "https://domy.example",
      PUBLIC_BASE_URL: "https://DOMY.example:443/",
      NODE_ENV: "production",
    });
    expect(complete.success && complete.data.storage).toMatchObject({
      bucket: "cohex-fotos",
      forcePathStyle: false,
    });
    expect(complete.success && complete.data.push).toEqual({
      publicKey: "publica",
      privateKey: "privada",
      subject: "mailto:soporte@example.com",
    });
    expect(
      parseEnv({
        ...base,
        ...storage,
        ...push,
        APP_URL: "https://domy.example",
        PUBLIC_BASE_URL: "http://domy.example",
        NODE_ENV: "production",
      }).success,
    ).toBe(false);
    expect(
      parseEnv({
        ...base,
        ...storage,
        ...push,
        APP_URL: "http://domy.example",
        PUBLIC_BASE_URL: "http://domy.example",
        NODE_ENV: "production",
      }).success,
    ).toBe(false);
    expect(
      parseEnv({
        ...base,
        ...storage,
        ...push,
        APP_URL: "https://auth.example",
        PUBLIC_BASE_URL: "https://domy.example",
        NODE_ENV: "production",
      }).success,
    ).toBe(false);
  });

  it("refuses part of the notification keys", () => {
    const result = parseEnv({ ...base, VAPID_PUBLIC_KEY: "publica" });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error).toMatch(/VAPID_PRIVATE_KEY/);
  });

  it("reads path-style addressing as a yes or no", () => {
    const result = parseEnv({ ...base, ...storage, S3_FORCE_PATH_STYLE: "true" });
    expect(result.success && result.data.storage.forcePathStyle).toBe(true);
    expect(parseEnv({ ...base, ...storage, S3_FORCE_PATH_STYLE: "quizás" }).success).toBe(false);
  });
});
