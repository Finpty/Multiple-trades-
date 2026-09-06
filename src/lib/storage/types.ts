import type { Readable } from "node:stream";

export type StorageVisibility = "PUBLIC" | "PRIVATE";

export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array | Readable;
  contentType: string;
  visibility: StorageVisibility;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface StoredObject {
  body: Readable;
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
}

/**
 * Object storage abstraction. The database stores only metadata and the
 * `(driver, key)` reference; bytes always live behind this interface so the
 * platform is never tied to one vendor. Implementations: local disk, S3-compatible.
 */
export interface StorageDriver {
  readonly name: string;
  put(input: PutObjectInput): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Stable public URL for PUBLIC objects, or null if the driver cannot serve directly. */
  publicUrl(key: string): string | null;
  /** Time-limited URL for PRIVATE objects. */
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
}
