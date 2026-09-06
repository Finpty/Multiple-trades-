import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import type { PutObjectInput, StorageDriver, StoredObject } from "./types";

/** S3-compatible driver: AWS S3, Cloudflare R2, MinIO, Backblaze B2, DigitalOcean Spaces… */
export function createS3Storage(): StorageDriver {
  const e = env();
  if (!e.S3_BUCKET) throw new Error("S3_BUCKET is required when MEDIA_STORAGE_DRIVER=s3");
  const client = new S3Client({
    region: e.S3_REGION ?? "auto",
    endpoint: e.S3_ENDPOINT || undefined,
    forcePathStyle: e.S3_FORCE_PATH_STYLE === "true",
    credentials:
      e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY }
        : undefined,
  });
  const bucket = e.S3_BUCKET;
  const publicBase = e.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  return {
    name: "s3",
    async put({ key, body, contentType, visibility, cacheControl, metadata }: PutObjectInput) {
      const data = body instanceof Readable ? Buffer.concat(await body.toArray()) : Buffer.from(body);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
          CacheControl: cacheControl ?? (visibility === "PUBLIC" ? "public, max-age=31536000, immutable" : "private, no-store"),
          Metadata: metadata,
        }),
      );
    },
    async get(key): Promise<StoredObject | null> {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!res.Body) return null;
        return {
          body: res.Body as Readable,
          contentType: res.ContentType,
          contentLength: res.ContentLength,
          lastModified: res.LastModified,
        };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch {
        return false;
      }
    },
    publicUrl(key) {
      return publicBase ? `${publicBase}/${key}` : null;
    },
    async signedUrl(key, ttlSeconds) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: ttlSeconds });
    },
  };
}
