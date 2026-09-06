import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { hmacHex } from "@/lib/crypto";
import { env } from "@/lib/env";
import type { PutObjectInput, StorageDriver, StoredObject } from "./types";

function safeJoin(root: string, key: string): string {
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error("Invalid storage key");
  return resolved;
}

/**
 * Local disk driver. Objects are served through /media/<key>, which enforces
 * visibility and signed URLs. Suitable for single-node deployments and dev.
 */
export function createLocalStorage(): StorageDriver {
  const root = path.resolve(process.cwd(), env().MEDIA_STORAGE_PATH);
  const base = env().PLATFORM_URL.replace(/\/$/, "");
  return {
    name: "local",
    async put({ key, body }: PutObjectInput) {
      const file = safeJoin(root, key);
      await mkdir(path.dirname(file), { recursive: true });
      const data = body instanceof Readable ? Buffer.concat(await body.toArray()) : Buffer.from(body);
      await writeFile(file, data);
    },
    async get(key): Promise<StoredObject | null> {
      const file = safeJoin(root, key);
      try {
        const s = await stat(file);
        return { body: createReadStream(file), contentLength: s.size, lastModified: s.mtime };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(safeJoin(root, key), { force: true });
    },
    async exists(key) {
      try {
        await stat(safeJoin(root, key));
        return true;
      } catch {
        return false;
      }
    },
    publicUrl(key) {
      return `/media/${key}`;
    },
    async signedUrl(key, ttlSeconds) {
      const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
      const sig = hmacHex(`${key}:${expires}`, "media-signing");
      return `${base}/media/${key}?expires=${expires}&sig=${sig}`;
    },
  };
}

export function verifyLocalSignature(key: string, expires: string | null, sig: string | null): boolean {
  if (!expires || !sig) return false;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return false;
  return hmacHex(`${key}:${expires}`, "media-signing") === sig;
}
