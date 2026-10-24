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
// A synthetic pair in web-push's format (release review DEPLOY-7 validates it in production).
const vapidPublicKey =
  "BJE65yRBCb2khVrYJ1CyS9KlN1NmxiZLVda2LH0TLxEmHSnxrlKyUYtU3xtq9ZybkO90qN8zaQkSySw7U1rqpOY";
const vapidPrivateKey = "blsND5hnYa_6ZmGTX6oki9XN5PYe1KeU4ig03LMDaq0";
const push = {
  VAPID_PUBLIC_KEY: vapidPublicKey,
  VAPID_PRIVATE_KEY: vapidPrivateKey,
  VAPID_SUBJECT: "mailto:soporte@example.com",
};
const production = {
  ...base,
  ...storage,
  ...push,
  APP_URL: "https://domy.example",
  PUBLIC_BASE_URL: "https://domy.example",
  RESEND_API_KEY: "re_synthetic_key",
  NODE_ENV: "production",
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
    const complete = parseEnv({ ...production, PUBLIC_BASE_URL: "https://DOMY.example:443/" });
    expect(complete.success && complete.data.storage).toMatchObject({
      bucket: "cohex-fotos",
      forcePathStyle: false,
    });
    expect(complete.success && complete.data.push).toEqual({
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
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

  // Release review SEC-3: the .env.example placeholder never signs production sessions.
  it("refuses the .env.example placeholder secret in production only", () => {
    const placeholder = "replace-with-at-least-32-random-characters";
    const result = parseEnv({ ...production, BETTER_AUTH_SECRET: placeholder });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error).toMatch(/BETTER_AUTH_SECRET/);
    expect(result.success ? "" : result.error).not.toContain(placeholder);
    expect(parseEnv({ ...base, BETTER_AUTH_SECRET: placeholder }).success).toBe(true);
    expect(parseEnv(production).success).toBe(true);
  });

  // Release review DEPLOY-8: recovery email is required in production, reported by readEnv.
  it("requires the Resend key in production", () => {
    const { RESEND_API_KEY: _omitted, ...withoutKey } = production;
    const result = parseEnv(withoutKey);
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error).toMatch(/RESEND_API_KEY/);
    expect(parseEnv({ ...production, RESEND_API_KEY: "" }).success).toBe(false);
    expect(parseEnv(base).success).toBe(true);
  });

  // Release review DEPLOY-7: web-push's key format, checked before the first notification.
  it.each([
    ["VAPID_PUBLIC_KEY", "publica"],
    ["VAPID_PUBLIC_KEY", vapidPublicKey.slice(1)],
    ["VAPID_PUBLIC_KEY", `${vapidPublicKey.slice(0, -1)}=`],
    ["VAPID_PUBLIC_KEY", `A${vapidPublicKey.slice(1)}`],
    ["VAPID_PRIVATE_KEY", "privada"],
    ["VAPID_PRIVATE_KEY", `${vapidPrivateKey}A`],
    ["VAPID_PRIVATE_KEY", vapidPrivateKey.replace("_", "/")],
    ["VAPID_SUBJECT", "soporte@example.com"],
    ["VAPID_SUBJECT", "http://example.com"],
    ["VAPID_SUBJECT", "mailto:soporte"],
  ])("refuses a malformed %s in production: %s", (key, value) => {
    const result = parseEnv({ ...production, [key]: value });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error).toContain(key);
    expect(result.success ? "" : result.error).not.toContain(value);
  });

  it("accepts an https VAPID subject in production", () => {
    expect(parseEnv({ ...production, VAPID_SUBJECT: "https://cohex.example" }).success).toBe(true);
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
