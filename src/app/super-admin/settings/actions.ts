"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/authz";
import { formToObject, ok, runAction, type ActionResult } from "@/lib/actions";
import { recordAudit } from "@/lib/audit";
import { getAllPlatformSettings, setPlatformSetting } from "@/lib/platform/settings";
import { DOMAIN_PROVIDERS } from "@/lib/domains/service";

/**
 * Platform settings are saved one group at a time. Every group action
 * requires a platform ADMIN, validates with zod, writes only the keys that
 * changed and records a CRITICAL audit entry with before/after values
 * (secret-like keys are redacted by recordAudit).
 */

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const commaList = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) : v),
    z.array(z.string().regex(/^[a-z0-9.+-]+\/[a-z0-9.+*-]+$/i, `${label}: use MIME types such as image/png`)).min(1, `${label}: enter at least one type`),
  );

const GROUPS = {
  platform: z.object({
    "platform.name": z.string().trim().min(1, "Platform name is required").max(80),
    "platform.supportEmail": z.string().trim().email("Enter a valid email"),
    "platform.defaultCountry": z.string().trim().length(2, "Use a 2-letter country code").toUpperCase(),
    "platform.defaultCurrency": z.string().trim().length(3, "Use a 3-letter currency code").toUpperCase(),
    "platform.defaultTimezone": z.string().trim().min(1, "Timezone is required").max(80),
  }),
  security: z.object({
    "security.requireEmailVerification": checkbox,
    "security.sessionDays": z.coerce.number().int("Whole days only").min(1, "At least 1 day").max(365, "At most 365 days"),
  }),
  registration: z.object({
    "registration.enabled": checkbox,
  }),
  media: z.object({
    "media.maxUploadMb": z.coerce.number().int().min(1, "At least 1 MB").max(5000, "At most 5000 MB"),
    "media.allowedImageTypes": commaList("Image types"),
    "media.allowedVideoTypes": commaList("Video types"),
    "media.allowedDocumentTypes": commaList("Document types"),
  }),
  domains: z.object({
    "domains.provider": z.string().refine((v) => DOMAIN_PROVIDERS.some((p) => p.id === v), "Unknown provider"),
    "domains.dnsInstructions": z.string().trim().max(2000),
    "domains.platformSubdomainSuffix": z.string().trim().max(120).toLowerCase(),
    "domains.cnameTarget": z.string().trim().max(253).toLowerCase(),
    "domains.aRecord": z.string().trim().max(45),
    "vercel.token": z.string().trim().max(200).optional(),
    "vercel.projectId": z.string().trim().max(120).optional(),
    "vercel.teamId": z.string().trim().max(120).optional(),
  }),
} as const;

type GroupKey = keyof typeof GROUPS;

async function saveGroup(group: GroupKey, formData: FormData): Promise<ActionResult> {
  const { user } = await requirePlatformAdmin("ADMIN", { throwOnly: true });
  const raw = formToObject(formData);
  const parsed = GROUPS[group].parse(raw) as Record<string, unknown>;
  const current = await getAllPlatformSettings();

  let values: Record<string, unknown> = { ...parsed };
  if (group === "domains") {
    const existing = (current["domains.vercel"] as { token?: string; projectId?: string; teamId?: string } | undefined) ?? {};
    const token = typeof parsed["vercel.token"] === "string" && parsed["vercel.token"] !== "" ? (parsed["vercel.token"] as string) : existing.token ?? "";
    const { "vercel.token": _t, "vercel.projectId": projectId, "vercel.teamId": teamId, ...rest } = parsed;
    void _t;
    values = { ...rest, "domains.vercel": { token, projectId: (projectId as string | undefined) ?? "", teamId: (teamId as string | undefined) ?? "" } };
  }

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (JSON.stringify(current[key] ?? null) === JSON.stringify(value ?? null)) continue;
    before[key] = current[key] ?? null;
    after[key] = value;
    await setPlatformSetting(key, value, user.id);
  }
  const changed = Object.keys(after);
  if (changed.length) {
    await recordAudit({ actorUserId: user.id, action: "platform.settings.updated", entityType: "platform_setting", entityId: group, severity: "CRITICAL", before, after, metadata: { group, changed } });
  }
  revalidatePath("/super-admin/settings");
  revalidatePath("/super-admin");
  return ok(undefined, changed.length ? `Saved ${changed.length} setting${changed.length === 1 ? "" : "s"}.` : "No changes to save.");
}

export async function savePlatformGroupAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(() => saveGroup("platform", formData));
}
export async function saveSecurityGroupAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(() => saveGroup("security", formData));
}
export async function saveRegistrationGroupAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(() => saveGroup("registration", formData));
}
export async function saveMediaGroupAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(() => saveGroup("media", formData));
}
export async function saveDomainsGroupAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(() => saveGroup("domains", formData));
}
