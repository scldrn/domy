import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStorage, photoKey } from "../src/lib/storage.ts";
import { startStorage, type TestStorage } from "./setup/storage.ts";

let s3: TestStorage;

beforeAll(async () => {
  s3 = await startStorage();
}, 120_000);

afterAll(async () => {
  await s3.stop();
});

/** The private bucket of the courier's photos (feature 003, research R6, FR-009, FR-036). */
describe("photo storage", () => {
  it("stores a photo and reads it back unchanged", async () => {
    const key = photoKey({ recordId: crypto.randomUUID(), photoId: crypto.randomUUID() });
    const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    await s3.storage.putPhoto(key, image);
    expect(await s3.storage.getPhoto(key)).toEqual(image);
  });

  it("stores the same photo twice without harm (FR-023)", async () => {
    const key = photoKey({ recordId: crypto.randomUUID(), photoId: crypto.randomUUID() });
    await s3.storage.putPhoto(key, new Uint8Array([1]));
    await s3.storage.putPhoto(key, new Uint8Array([1]));
    expect(await s3.storage.getPhoto(key)).toEqual(new Uint8Array([1]));
  });

  it("answers null for an object that is gone, as after the 12-month retention", async () => {
    expect(await s3.storage.getPhoto("photos/missing/missing.jpg")).toBeNull();
  });

  it("is refused with the wrong keys: the bucket is private", async () => {
    const intruder = createStorage({ ...s3.config, secretAccessKey: "otra-clave" });
    await expect(intruder.getPhoto("photos/any/any.jpg")).rejects.toThrow();
  });

  it("creating the bucket again changes nothing", async () => {
    await expect(s3.storage.ensureBucket()).resolves.toBeUndefined();
  });
});
