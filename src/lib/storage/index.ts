import { env } from "@/lib/env";
import type { StorageDriver } from "./types";

export * from "./types";

const holder = globalThis as unknown as { __tradeoneStorage?: Record<string, StorageDriver> };
holder.__tradeoneStorage ??= {};

/** Driver by name (objects remember the driver they were written with). */
export async function getStorage(name?: string): Promise<StorageDriver> {
  const driver = name ?? env().MEDIA_STORAGE_DRIVER;
  if (holder.__tradeoneStorage![driver]) return holder.__tradeoneStorage![driver];
  let instance: StorageDriver;
  if (driver === "s3") instance = (await import("./s3")).createS3Storage();
  else instance = (await import("./local")).createLocalStorage();
  holder.__tradeoneStorage![driver] = instance;
  return instance;
}

/** Object keys are always namespaced by business so cross-tenant access is structurally impossible. */
export function buildObjectKey(businessId: string, filename: string, folder = "uploads"): string {
  const now = new Date();
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
  const id = crypto.randomUUID();
  return `${businessId}/${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}${ext}`;
}

/** Resolve a URL for a stored object. PUBLIC → direct/public URL; PRIVATE → short signed URL. */
export async function resolveMediaUrl(media: { storageDriver: string; storageKey: string; visibility: "PUBLIC" | "PRIVATE" }, ttlSeconds = 300): Promise<string> {
  const storage = await getStorage(media.storageDriver);
  if (media.visibility === "PUBLIC") {
    return storage.publicUrl(media.storageKey) ?? (await storage.signedUrl(media.storageKey, 86_400));
  }
  return storage.signedUrl(media.storageKey, ttlSeconds);
}
