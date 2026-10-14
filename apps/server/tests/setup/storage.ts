import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { createStorage, type PhotoStorage, type StorageConfig } from "../../src/lib/storage.ts";

export type TestStorage = {
  storage: PhotoStorage;
  config: StorageConfig;
  stop: () => Promise<void>;
};

/** Photo storage with the S3 API, in memory, per test file (feature 003, research R6). */
export async function startStorage(): Promise<TestStorage> {
  const container: StartedTestContainer = await new GenericContainer("andrewgaul/s3proxy:4.1.1")
    .withEnvironment({
      S3PROXY_AUTHORIZATION: "aws-v2-or-v4",
      S3PROXY_IDENTITY: "domy",
      S3PROXY_CREDENTIAL: "domy-secreto",
      JCLOUDS_PROVIDER: "transient",
    })
    .withExposedPorts(80)
    .start();
  const config: StorageConfig = {
    endpoint: `http://${container.getHost()}:${String(container.getMappedPort(80))}`,
    region: "us-east-1",
    bucket: "domy-fotos",
    accessKeyId: "domy",
    secretAccessKey: "domy-secreto",
    forcePathStyle: true,
  };
  const storage = createStorage(config);
  await storage.ensureBucket();
  return { storage, config, stop: () => container.stop().then(() => undefined) };
}
