import { z } from "zod";
import type { TenantDb } from "@/lib/db";
import { platformDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { toJson } from "@/lib/json";
import { AI_ADAPTERS } from "@/lib/ai/adapters";
import { getPlatformSetting } from "@/lib/platform/settings";

export const AiProviderSchema = z.object({
  provider: z.enum(Object.keys(AI_ADAPTERS) as [string, ...string[]]),
  name: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().max(300).optional(),
  apiKey: z.string().trim().max(500).optional(),
  isEnabled: z.boolean().default(true),
  monthlyTokenLimit: z.coerce.number().int().min(0).optional().or(z.literal("")),
});

export async function listBusinessAiProviders(businessId: string) {
  const rows = await platformDb.aiProvider.findMany({ where: { scope: "BUSINESS", businessId }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ id: r.id, provider: r.provider, providerLabel: AI_ADAPTERS[r.provider]?.label ?? r.provider, name: r.name, model: r.model, baseUrl: r.baseUrl, keyMasked: r.apiKeyEncrypted ? maskSecret(safeDecrypt(r.apiKeyEncrypted)) : "", isEnabled: r.isEnabled, monthlyTokenLimit: r.monthlyTokenLimit }));
}

function safeDecrypt(v: string): string {
  try {
    return decryptSecret(v);
  } catch {
    return "";
  }
}

export async function saveBusinessAiProvider(businessId: string, input: z.infer<typeof AiProviderSchema>, actorUserId: string, id?: string) {
  if (!(await getPlatformSetting<boolean>("ai.allowBusinessKeys", true))) throw new Error("The platform does not allow business-provided AI keys.");
  const data = { scope: "BUSINESS" as const, businessId, provider: input.provider, name: input.name, model: input.model, baseUrl: input.baseUrl || null, isEnabled: input.isEnabled, monthlyTokenLimit: typeof input.monthlyTokenLimit === "number" ? input.monthlyTokenLimit : null, ...(input.apiKey ? { apiKeyEncrypted: encryptSecret(input.apiKey) } : {}) };
  const row = id ? await platformDb.aiProvider.update({ where: { id, businessId }, data }) : await platformDb.aiProvider.create({ data });
  await recordAudit({ actorUserId, businessId, action: id ? "ai.provider.updated" : "ai.provider.created", entityType: "ai_provider", entityId: row.id, severity: "NOTICE", after: { provider: row.provider, model: row.model, keySet: !!row.apiKeyEncrypted } });
  return row;
}

export async function deleteBusinessAiProvider(businessId: string, id: string, actorUserId: string) {
  await platformDb.aiProvider.deleteMany({ where: { id, businessId, scope: "BUSINESS" } });
  await recordAudit({ actorUserId, businessId, action: "ai.provider.deleted", entityType: "ai_provider", entityId: id, severity: "CRITICAL" });
}

export async function aiUsageThisMonth(businessId: string) {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const agg = await platformDb.aiUsage.aggregate({ where: { businessId, createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true } });
  return { requests: agg._count._all, tokens: (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0) };
}

export const WebhookSchema = z.object({ url: z.string().trim().url().refine((u) => u.startsWith("https://") || u.startsWith("http://localhost"), "Webhook URLs must use https"), events: z.array(z.string().max(60)).default(["*"]), secret: z.string().trim().max(200).optional(), isActive: z.boolean().default(true) });

export async function saveWebhook(db: TenantDb, businessId: string, input: z.infer<typeof WebhookSchema>, actorUserId: string, id?: string) {
  const data = { businessId, url: input.url, events: toJson(input.events.length ? input.events : ["*"]), isActive: input.isActive, ...(input.secret ? { secretEncrypted: encryptSecret(input.secret) } : {}) };
  const row = id ? await db.webhook.update({ where: { id }, data }) : await db.webhook.create({ data });
  await recordAudit({ actorUserId, businessId, action: id ? "webhook.updated" : "webhook.created", entityType: "webhook", entityId: row.id, severity: "NOTICE", after: { url: row.url, events: input.events } });
  return row;
}

export const IntegrationSchema = z.object({ provider: z.string().trim().min(1).max(60).regex(/^[a-z0-9_-]+$/i), name: z.string().trim().min(1).max(80), config: z.string().max(10_000).optional(), secrets: z.array(z.object({ key: z.string().max(60), value: z.string().max(2000) })).default([]), isEnabled: z.boolean().default(false) });

export async function saveIntegration(db: TenantDb, businessId: string, input: z.infer<typeof IntegrationSchema>, actorUserId: string, id?: string) {
  let config: Record<string, unknown> = {};
  if (input.config?.trim()) {
    try {
      config = JSON.parse(input.config) as Record<string, unknown>;
    } catch {
      throw new Error("Config must be valid JSON.");
    }
  }
  const existing = id ? await db.integration.findFirst({ where: { id, businessId } }) : null;
  let secrets: Record<string, string> = {};
  if (existing?.secretsEncrypted) {
    try {
      secrets = JSON.parse(decryptSecret(existing.secretsEncrypted)) as Record<string, string>;
    } catch {
      secrets = {};
    }
  }
  for (const s of input.secrets) if (s.key) { if (s.value) secrets[s.key] = s.value; }
  const data = { businessId, provider: input.provider, name: input.name, config: toJson(config), secretsEncrypted: Object.keys(secrets).length ? encryptSecret(JSON.stringify(secrets)) : null, isEnabled: input.isEnabled, status: input.isEnabled ? "connected" : "disconnected" };
  const row = id ? await db.integration.update({ where: { id }, data }) : await db.integration.create({ data });
  await recordAudit({ actorUserId, businessId, action: id ? "integration.updated" : "integration.created", entityType: "integration", entityId: row.id, severity: "NOTICE", after: { provider: row.provider, isEnabled: row.isEnabled, secretKeys: Object.keys(secrets) } });
  return row;
}

export function integrationSecretKeys(secretsEncrypted: string | null): string[] {
  if (!secretsEncrypted) return [];
  try {
    return Object.keys(JSON.parse(decryptSecret(secretsEncrypted)) as Record<string, string>);
  } catch {
    return [];
  }
}
