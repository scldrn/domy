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
  it("uses the development storage of compose.yaml when none is set", () => {
    const result = parseEnv(base);
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

  it("requires the storage and notification keys in production", () => {
    const result = parseEnv({ ...base, NODE_ENV: "production" });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error).toMatch(/S3_BUCKET/);
    expect(result.success ? "" : result.error).toMatch(/VAPID_PUBLIC_KEY/);
    const complete = parseEnv({ ...base, ...storage, ...push, NODE_ENV: "production" });
    expect(complete.success && complete.data.storage).toMatchObject({
      bucket: "cohex-fotos",
      forcePathStyle: false,
    });
    expect(complete.success && complete.data.push).toEqual({
      publicKey: "publica",
      privateKey: "privada",
      subject: "mailto:soporte@example.com",
    });
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
