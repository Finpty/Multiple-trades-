import { z } from "zod";
import type { PricingItem, PricingRule } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { toJson } from "@/lib/json";
import { calculatePrice, implicitRulesFromItems, PRICING_ACTION_TYPES, type PricingResult } from "./engine";
import { coerceFieldValues, listFieldDefinitions } from "@/lib/custom-fields";

export const PricingItemSchema = z.object({
  key: z.string().trim().min(1).max(60).regex(/^[a-z0-9_]+$/, "snake_case"),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["RATE", "FEE", "MULTIPLIER", "PERCENT"]),
  amount: z.coerce.number().finite(),
  unit: z.string().trim().max(20).optional(),
  category: z.string().trim().max(40).optional(),
  description: z.string().trim().max(300).optional(),
  serviceId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
});
export type PricingItemInput = z.infer<typeof PricingItemSchema>;

export const PricingRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  priority: z.coerce.number().int().min(0).max(9999).default(100),
  serviceId: z.string().uuid().nullable().optional(),
  conditions: z.object({ match: z.enum(["all", "any"]).optional(), rules: z.array(z.object({ field: z.string().max(120), operator: z.string().max(20), value: z.unknown().optional() })).optional() }).default({}),
  actions: z.array(z.object({ type: z.enum(PRICING_ACTION_TYPES.map((a) => a.type) as [string, ...string[]]) }).passthrough()).min(1, "Add at least one action"),
  isActive: z.boolean().default(true),
});
export type PricingRuleInput = z.infer<typeof PricingRuleSchema>;

export async function savePricingItem(db: TenantDb, businessId: string, input: PricingItemInput, actorUserId: string, id?: string): Promise<PricingItem> {
  const data = { businessId, key: input.key, label: input.label, type: input.type, amount: input.amount, unit: input.unit || null, category: input.category || null, description: input.description || null, serviceId: input.serviceId ?? null, isActive: input.isActive };
  const row = id ? await db.pricingItem.update({ where: { id }, data }) : await db.pricingItem.create({ data: { ...data, sortOrder: await db.pricingItem.count({ where: { businessId } }) } });
  await recordAudit({ actorUserId, businessId, action: id ? "pricing.item.updated" : "pricing.item.created", entityType: "pricing_item", entityId: row.id, after: { key: row.key, amount: Number(row.amount), type: row.type } });
  return row;
}

export async function savePricingRule(db: TenantDb, businessId: string, input: PricingRuleInput, actorUserId: string, id?: string): Promise<PricingRule> {
  const data = { businessId, name: input.name, description: input.description || null, priority: input.priority, serviceId: input.serviceId ?? null, conditions: toJson(input.conditions), actions: toJson(input.actions), isActive: input.isActive };
  const row = id ? await db.pricingRule.update({ where: { id }, data }) : await db.pricingRule.create({ data });
  await recordAudit({ actorUserId, businessId, action: id ? "pricing.rule.updated" : "pricing.rule.created", entityType: "pricing_rule", entityId: row.id, after: { name: row.name, priority: row.priority, actions: input.actions.length } });
  return row;
}

export interface TestCalcResult extends PricingResult {
  usedImplicitRules: boolean;
}

export async function runTestCalculation(db: TenantDb, business: { id: string; taxRate: unknown; taxInclusive: boolean }, serviceId: string | null, rawInputs: Record<string, unknown>): Promise<TestCalcResult> {
  const [items, rules, defs, service] = await Promise.all([
    db.pricingItem.findMany({ where: { businessId: business.id, isActive: true } }),
    db.pricingRule.findMany({ where: { businessId: business.id, isActive: true } }),
    listFieldDefinitions(db, business.id, "ESTIMATE"),
    serviceId ? db.service.findFirst({ where: { businessId: business.id, id: serviceId }, select: { id: true, slug: true } }) : Promise.resolve(null),
  ]);
  const { values } = coerceFieldValues(defs, rawInputs);
  for (const [k, v] of Object.entries(rawInputs)) if (!(k in values)) values[k] = v;
  const usedImplicitRules = rules.length === 0;
  const effective = usedImplicitRules ? (implicitRulesFromItems(items) as unknown as PricingRule[]) : rules;
  return { ...calculatePrice(items, effective, { inputs: values, serviceId: service?.id ?? null, serviceSlug: service?.slug ?? null, taxRate: Number(business.taxRate), taxInclusive: business.taxInclusive }), usedImplicitRules };
}

export function summariseConditions(c: unknown): string {
  const g = (c ?? {}) as { match?: string; rules?: Array<{ field: string; operator: string; value?: unknown }> };
  if (!g.rules?.length) return "Always";
  return g.rules.map((r) => `${r.field.replace(/^inputs\./, "")} ${r.operator.replace(/_/g, " ")}${r.value !== undefined && r.value !== "" ? ` ${String(r.value)}` : ""}`).join(g.match === "any" ? " OR " : " AND ");
}

export function summariseActions(a: unknown): string {
  const list = Array.isArray(a) ? (a as Array<Record<string, unknown>>) : [];
  return list.map((x) => `${String(x.type).replace(/_/g, " ")}${x.pricingItemKey ? ` (${String(x.pricingItemKey)})` : x.description ? ` (${String(x.description)})` : ""}`).join("; ") || "—";
}
