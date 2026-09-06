import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { platformDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { toJson } from "@/lib/json";

/**
 * Platform-level integrations: `integrations` rows with neither a business nor
 * an organisation. Secrets are stored AES-256-GCM encrypted as a JSON object
 * of key → value and only ever leave this module masked.
 */

export class IntegrationAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationAdminError";
  }
}

const PLATFORM_SCOPE = { businessId: null, organizationId: null } as const;

export const IntegrationInputSchema = z.object({
  provider: z
    .string()
    .trim()
    .min(2, "Provider key must be at least 2 characters")
    .max(60)
    .regex(/^[a-z0-9][a-z0-9_.-]*$/, "Use lowercase letters, numbers, dots, dashes or underscores"),
  name: z.string().trim().min(1, "Name is required").max(120),
  config: z.string().transform((raw, ctx) => {
    const text = raw.trim();
    if (!text) return {} as Record<string, unknown>;
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Config must be a JSON object" });
        return z.NEVER;
      }
      return parsed as Record<string, unknown>;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Config is not valid JSON" });
      return z.NEVER;
    }
  }),
  isEnabled: z.boolean().default(false),
  status: z.string().trim().max(40).optional(),
});
export type IntegrationInput = z.output<typeof IntegrationInputSchema>;

export type SecretPairs = Record<string, string>;

/** Parses `secretKey[]` / `secretValue[]` form arrays into a key → value map. */
export function parseSecretPairs(keys: unknown, values: unknown): SecretPairs {
  const ks = Array.isArray(keys) ? keys : keys === undefined ? [] : [keys];
  const vs = Array.isArray(values) ? values : values === undefined ? [] : [values];
  const out: SecretPairs = {};
  ks.forEach((k, i) => {
    const key = typeof k === "string" ? k.trim() : "";
    const value = typeof vs[i] === "string" ? (vs[i] as string) : "";
    if (!key) return;
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(key)) throw new IntegrationAdminError(`Secret key "${key}" may only contain letters, numbers, dots, dashes or underscores.`);
    out[key] = value;
  });
  return out;
}

function decryptPairs(blob: string | null): SecretPairs {
  if (!blob) return {};
  try {
    const parsed = JSON.parse(decryptSecret(blob)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: SecretPairs = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
    return out;
  } catch {
    return {};
  }
}

function encryptPairs(pairs: SecretPairs): string | null {
  const entries = Object.entries(pairs).filter(([, v]) => v !== "");
  if (!entries.length) return null;
  return encryptSecret(JSON.stringify(Object.fromEntries(entries)));
}

export interface MaskedSecret {
  key: string;
  masked: string;
}

export function maskedSecrets(blob: string | null): MaskedSecret[] {
  return Object.entries(decryptPairs(blob)).map(([key, value]) => ({ key, masked: maskSecret(value) }));
}

export async function listPlatformIntegrations() {
  const rows = await platformDb.integration.findMany({ where: PLATFORM_SCOPE, orderBy: { updatedAt: "desc" } });
  return rows.map((r) => ({ ...r, secrets: maskedSecrets(r.secretsEncrypted), secretsEncrypted: undefined }));
}

export async function getPlatformIntegration(id: string) {
  const row = await platformDb.integration.findFirst({ where: { id, ...PLATFORM_SCOPE } });
  if (!row) return null;
  return { ...row, secrets: maskedSecrets(row.secretsEncrypted), secretsEncrypted: undefined };
}

export async function createPlatformIntegration(input: IntegrationInput, secrets: SecretPairs, actorUserId: string) {
  const row = await platformDb.integration.create({
    data: {
      ...PLATFORM_SCOPE,
      provider: input.provider,
      name: input.name,
      config: toJson(input.config),
      secretsEncrypted: encryptPairs(secrets),
      isEnabled: input.isEnabled,
      status: input.status || (input.isEnabled ? "connected" : "disconnected"),
    },
  });
  await recordAudit({ actorUserId, action: "integration.created", entityType: "integration", entityId: row.id, severity: "NOTICE", after: { provider: row.provider, name: row.name, isEnabled: row.isEnabled, config: input.config, secretKeys: Object.keys(secrets) }, metadata: { scope: "platform" } });
  return row;
}

/**
 * Updates an integration. Secrets: existing keys keep their value when the
 * submitted value is blank, keys omitted from the form are removed, and any
 * non-blank value replaces the stored one.
 */
export async function updatePlatformIntegration(id: string, input: IntegrationInput, secrets: SecretPairs, actorUserId: string) {
  const before = await platformDb.integration.findFirst({ where: { id, ...PLATFORM_SCOPE } });
  if (!before) throw new IntegrationAdminError("Integration not found.");
  const existing = decryptPairs(before.secretsEncrypted);
  const merged: SecretPairs = {};
  for (const [k, v] of Object.entries(secrets)) merged[k] = v !== "" ? v : existing[k] ?? "";
  const data: Prisma.IntegrationUncheckedUpdateInput = {
    provider: input.provider,
    name: input.name,
    config: toJson(input.config),
    secretsEncrypted: encryptPairs(merged),
    isEnabled: input.isEnabled,
    status: input.status || (input.isEnabled ? "connected" : "disconnected"),
  };
  const after = await platformDb.integration.update({ where: { id }, data });
  await recordAudit({
    actorUserId,
    action: "integration.updated",
    entityType: "integration",
    entityId: id,
    severity: "NOTICE",
    before: { provider: before.provider, name: before.name, isEnabled: before.isEnabled, config: before.config, secretKeys: Object.keys(existing) },
    after: { provider: after.provider, name: after.name, isEnabled: after.isEnabled, config: input.config, secretKeys: Object.keys(merged).filter((k) => merged[k] !== "") },
    metadata: { scope: "platform" },
  });
  return after;
}

export async function setPlatformIntegrationEnabled(id: string, isEnabled: boolean, actorUserId: string) {
  const before = await platformDb.integration.findFirst({ where: { id, ...PLATFORM_SCOPE } });
  if (!before) throw new IntegrationAdminError("Integration not found.");
  const after = await platformDb.integration.update({ where: { id }, data: { isEnabled, status: isEnabled ? "connected" : "disconnected" } });
  await recordAudit({ actorUserId, action: isEnabled ? "integration.enabled" : "integration.disabled", entityType: "integration", entityId: id, severity: "NOTICE", before: { isEnabled: before.isEnabled }, after: { isEnabled }, metadata: { provider: before.provider, scope: "platform" } });
  return after;
}

/**
 * Integrations carry no `deletedAt`; disabling is the soft path and deletion
 * is explicit, confirmed and audited with the full (redacted) row.
 */
export async function deletePlatformIntegration(id: string, actorUserId: string) {
  const before = await platformDb.integration.findFirst({ where: { id, ...PLATFORM_SCOPE } });
  if (!before) throw new IntegrationAdminError("Integration not found.");
  await platformDb.integration.delete({ where: { id } });
  await recordAudit({ actorUserId, action: "integration.deleted", entityType: "integration", entityId: id, severity: "CRITICAL", before: { provider: before.provider, name: before.name, isEnabled: before.isEnabled, config: before.config }, metadata: { scope: "platform" } });
}
