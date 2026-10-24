import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import type { Env } from "../env.ts";

/**
 * The private bucket of the courier's photos (feature 003, research R6): photos go through the
 * server, never through public or presigned URLs.
 */

export type StorageConfig = Env["storage"];

export type PhotoStorage = {
  putPhoto: (key: string, image: Uint8Array) => Promise<void>;
  /** The image, or null when the object is gone (12-month retention, FR-036). */
  getPhoto: (key: string) => Promise<Uint8Array<ArrayBuffer> | null>;
  /** Cleans up an orphaned object if metadata write fails. */
  deletePhoto: (key: string) => Promise<void>;
  /** Creates the bucket if missing: development and tests; production provisions its own. */
  ensureBucket: () => Promise<void>;
};

/** Where a record's photo lives in the bucket. */
export function photoKey(photo: { recordId: string; photoId: string }): string {
  return `photos/${photo.recordId}/${photo.photoId}.jpg`;
}

/** Bounds on each bucket call, so a stalled bucket fails instead of hanging a request (ROB-1). */
export type StorageTimeouts = { requestTimeoutMs?: number; connectionTimeoutMs?: number };

export function createStorage(
  config: StorageConfig,
  { requestTimeoutMs = 10_000, connectionTimeoutMs = 3_000 }: StorageTimeouts = {},
): PhotoStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Without throwOnRequestTimeout the handler only logs a warning and keeps waiting.
    requestHandler: {
      requestTimeout: requestTimeoutMs,
      connectionTimeout: connectionTimeoutMs,
      throwOnRequestTimeout: true,
    },
  });
  const Bucket = config.bucket;
  return {
    putPhoto: async (key, image) => {
      await client.send(
        new PutObjectCommand({ Bucket, Key: key, Body: image, ContentType: "image/jpeg" }),
      );
    },
    getPhoto: async (key) => {
      try {
        const object = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return object.Body ? new Uint8Array(await object.Body.transformToByteArray()) : null;
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    deletePhoto: async (key) => {
      try {
        await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
      } catch (error) {
        if (error instanceof NoSuchKey) return;
        throw error;
      }
    },
    ensureBucket: async () => {
      try {
        await client.send(new HeadBucketCommand({ Bucket }));
      } catch (error) {
        if (!(error instanceof S3ServiceException) || error.$metadata.httpStatusCode !== 404) {
          throw error;
        }
        await client.send(new CreateBucketCommand({ Bucket }));
      }
    },
  };
}
