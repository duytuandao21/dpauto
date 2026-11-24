import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Config } from "./config";

/** public: variants served to browsers; originals: private uploads kept for regeneration. */
export type Bucket = "public" | "originals";
export type MediaStore = {
  driver: "local" | "r2";
  put(bucket: Bucket, key: string, body: Buffer, type: string): Promise<void>;
  get(bucket: Bucket, key: string): Promise<Buffer>;
  removePrefix(bucket: Bucket, prefix: string): Promise<void>;
  url(key: string): string;
  /** Local driver only: absolute file path of a public key, or undefined when it escapes the folder. */
  localPath?(key: string): string | undefined;
};

const immutable = "public, max-age=31536000, immutable";
export const validKey = (key: string) =>
  /^[a-z0-9][a-z0-9/_.-]*$/.test(key) && !key.includes("..");

export function mediaStore(config: Config["media"]): MediaStore {
  const url = (key: string) => `${config.publicUrl}/${key}`;
  if (config.driver === "local") {
    const root = resolve(config.localDir);
    const path = (bucket: Bucket, key: string) => {
      const file = resolve(root, bucket, key);
      return validKey(key) && file.startsWith(resolve(root, bucket) + sep)
        ? file
        : undefined;
    };
    const must = (bucket: Bucket, key: string) => {
      const file = path(bucket, key);
      if (!file) throw new Error("Invalid media key");
      return file;
    };
    return {
      driver: "local",
      url,
      localPath: (key) => path("public", key),
      async put(bucket, key, body) {
        const file = must(bucket, key);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, body);
      },
      get: (bucket, key) => readFile(must(bucket, key)),
      async removePrefix(bucket, prefix) {
        await rm(must(bucket, prefix.replace(/\/$/, "")), {
          recursive: true,
          force: true,
        });
      },
    };
  }
  const r2 = config.r2,
    client = new S3Client({
      region: "auto",
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
      },
    }),
    name = (bucket: Bucket) =>
      bucket === "public" ? r2.publicBucket : r2.originalsBucket;
  return {
    driver: "r2",
    url,
    async put(bucket, key, body, type) {
      if (!validKey(key)) throw new Error("Invalid media key");
      await client.send(
        new PutObjectCommand({
          Bucket: name(bucket),
          Key: key,
          Body: body,
          ContentType: type,
          ...(bucket === "public" ? { CacheControl: immutable } : {}),
        }),
      );
    },
    async get(bucket, key) {
      const r = await client.send(
        new GetObjectCommand({ Bucket: name(bucket), Key: key }),
      );
      return Buffer.from(await r.Body!.transformToByteArray());
    },
    async removePrefix(bucket, prefix) {
      if (!validKey(prefix)) throw new Error("Invalid media key");
      let token: string | undefined;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: name(bucket),
            Prefix: prefix,
            ContinuationToken: token,
          }),
        );
        const keys = (page.Contents || []).map((o) => ({ Key: o.Key! }));
        if (keys.length)
          await client.send(
            new DeleteObjectsCommand({
              Bucket: name(bucket),
              Delete: { Objects: keys, Quiet: true },
            }),
          );
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
    },
  };
}
