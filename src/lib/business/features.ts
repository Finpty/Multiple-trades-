import type { TenantDb } from "@/lib/db";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { toJson } from "@/lib/json";

export interface FeatureRow { key: string; name: string; description: string | null; category: string; requiresAi: boolean; isPlatformOnly: boolean; isEnabled: boolean; config: Record<string, unknown>; hasConfigSchema: boolean }

export async function listBusinessFeatures(db: TenantDb, businessId: string): Promise<FeatureRow[]> {
  const [defs, rows] = await Promise.all([prisma.featureDefinition.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }), db.businessFeature.findMany({ where: { businessId } })]);
  const map = new Map(rows.map((r) => [r.featureKey, r]));
  return defs.map((d) => ({ key: d.key, name: d.name, description: d.description, category: d.category, requiresAi: d.requiresAi, isPlatformOnly: d.isPlatformOnly, isEnabled: map.get(d.key)?.isEnabled ?? false, config: (map.get(d.key)?.config as Record<string, unknown>) ?? {}, hasConfigSchema: Object.keys((d.configSchema as object) ?? {}).length > 0 }));
}

export async function setBusinessFeature(db: TenantDb, businessId: string, featureKey: string, isEnabled: boolean, actorUserId: string, config?: Record<string, unknown>): Promise<void> {
  const def = await prisma.featureDefinition.findUnique({ where: { key: featureKey } });
  if (!def || !def.isActive) throw new Error("Unknown feature.");
  if (def.isPlatformOnly) throw new Error("This feature is managed by the platform.");
  const before = await db.businessFeature.findUnique({ where: { businessId_featureKey: { businessId, featureKey } } });
  await db.businessFeature.upsert({ where: { businessId_featureKey: { businessId, featureKey } }, create: { businessId, featureKey, isEnabled, config: toJson(config ?? {}) }, update: { isEnabled, ...(config ? { config: toJson(config) } : {}) } });
  await recordAudit({ actorUserId, businessId, action: isEnabled ? "feature.enabled" : "feature.disabled", entityType: "business_feature", entityId: featureKey, before: { isEnabled: before?.isEnabled ?? false }, after: { isEnabled }, severity: "NOTICE" });
}
