import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual as nodeTimingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";

/** URL-safe random token. 32 bytes = 256 bits of entropy by default. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacHex(input: string, purpose = "generic"): string {
  return createHmac("sha256", deriveKey(purpose)).update(input).digest("hex");
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return nodeTimingSafeEqual(ab, bb);
}

const keyCache = new Map<string, Buffer>();

function deriveKey(purpose: string): Buffer {
  const cached = keyCache.get(purpose);
  if (cached) return cached;
  const key = Buffer.from(hkdfSync("sha256", env().PLATFORM_SECRET, "tradeone", purpose, 32));
  keyCache.set(purpose, key);
  return key;
}

/**
 * AES-256-GCM encryption for secrets at rest (integration keys, AI keys,
 * OAuth tokens). Output format: v1.<iv>.<tag>.<ciphertext> (base64url).
 */
export function encryptSecret(plaintext: string, purpose = "secrets"): string {
  const key = deriveKey(purpose);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, purpose = "secrets"): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted secret");
  const key = deriveKey(purpose);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}

/** Mask a secret for display: keeps the last 4 characters. */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return "";
  return `••••••••${secret.slice(-4)}`;
}
