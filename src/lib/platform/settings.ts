import { prisma } from "@/lib/db";
import { toJson } from "@/lib/json";

/**
 * Global platform settings (key → json). Separate from business settings.
 * Keys in use:
 *   platform.name, platform.supportEmail, ai.enabled, ai.allowBusinessKeys,
 *   registration.enabled, security.requireEmailVerification, media.maxUploadMb
 */
export const PLATFORM_SETTING_DEFAULTS: Record<string, unknown> = {
  "platform.name": "TRADE ONE",
  "platform.supportEmail": "support@tradeone.local",
  "platform.defaultCountry": "AU",
  "platform.defaultCurrency": "AUD",
  "platform.defaultTimezone": "Australia/Perth",
  "ai.enabled": false,
  "ai.allowBusinessKeys": true,
  "registration.enabled": false,
  "security.requireEmailVerification": false,
  "security.sessionDays": 30,
  "media.maxUploadMb": 50,
  "media.allowedImageTypes": ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/avif"],
  "media.allowedVideoTypes": ["video/mp4", "video/webm", "video/quicktime"],
  "media.allowedDocumentTypes": ["application/pdf"],
  "domains.platformSubdomainSuffix": "",
  "domains.dnsInstructions": "Create a CNAME record pointing your domain to the platform host, then add the TXT verification record shown.",
};

export async function getPlatformSetting<T>(key: string, fallback?: T): Promise<T> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  if (row) return row.value as T;
  return (fallback ?? PLATFORM_SETTING_DEFAULTS[key]) as T;
}

export async function getAllPlatformSettings(): Promise<Record<string, unknown>> {
  const rows = await prisma.platformSetting.findMany();
  const out: Record<string, unknown> = { ...PLATFORM_SETTING_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setPlatformSetting(key: string, value: unknown, updatedByUserId?: string | null): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: toJson(value), updatedByUserId: updatedByUserId ?? null },
    update: { value: toJson(value), updatedByUserId: updatedByUserId ?? null },
  });
}
