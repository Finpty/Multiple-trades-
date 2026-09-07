"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { bool, fail, formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { PricingItemSchema, PricingRuleSchema, runTestCalculation, savePricingItem, savePricingRule, type TestCalcResult } from "@/lib/pricing/admin";
import { recordAudit } from "@/lib/audit";
import { isUuid } from "@/lib/ids";

export async function saveItemAction(businessId: string, itemId: string | null, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "pricing.manage", { throwOnly: true });
    const o = formToObject(formData);
    const input = PricingItemSchema.parse({ ...o, isActive: o.isActive === undefined ? true : bool(o.isActive), serviceId: str(o.serviceId) || null });
    const dupe = await ctx.db.pricingItem.findFirst({ where: { businessId, key: input.key, ...(itemId ? { id: { not: itemId } } : {}) }, select: { id: true } });
    if (dupe) return fail("Please correct the highlighted fields.", { key: "This key is already used." });
    await savePricingItem(ctx.db, businessId, input, ctx.user.id, itemId && isUuid(itemId) ? itemId : undefined);
    revalidatePath(`/admin/${businessId}/pricing`);
    return ok(undefined, "Saved");
  });
}

export async function quickUpdateItemAction(businessId: string, itemId: string, patch: { amount?: number; unit?: string; isActive?: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "pricing.manage", { throwOnly: true });
    const before = await ctx.db.pricingItem.findFirstOrThrow({ where: { id: itemId, businessId } });
    const row = await ctx.db.pricingItem.update({ where: { id: itemId }, data: { ...(patch.amount !== undefined && Number.isFinite(patch.amount) ? { amount: patch.amount } : {}), ...(patch.unit !== undefined ? { unit: patch.unit || null } : {}), ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}) } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "pricing.item.updated", entityType: "pricing_item", entityId: itemId, before: { amount: Number(before.amount), unit: before.unit, isActive: before.isActive }, after: { amount: Number(row.amount), unit: row.unit, isActive: row.isActive } });
    revalidatePath(`/admin/${businessId}/pricing`);
    return ok(undefined);
  });
}

export async function archiveItemAction(businessId: string, itemId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "pricing.manage", { throwOnly: true });
    await ctx.db.pricingItem.update({ where: { id: itemId }, data: { deletedAt: new Date(), isActive: false } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "pricing.item.archived", entityType: "pricing_item", entityId: itemId });
    revalidatePath(`/admin/${businessId}/pricing`);
    return ok(undefined, "Item archived");
  });
}

export async function saveRuleAction(businessId: string, ruleId: string | null, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let saved = false;
  const result = await runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "pricing.manage", { throwOnly: true });
    const o = formToObject(formData);
    const input = PricingRuleSchema.parse({ ...o, isActive: o.isActive === undefined ? true : bool(o.isActive), serviceId: str(o.serviceId) || null, conditions: o.conditions ?? {}, actions: o.actions ?? [] });
    await savePricingRule(ctx.db, businessId, input, ctx.user.id, ruleId && isUuid(ruleId) ? ruleId : undefined);
    saved = true;
    revalidatePath(`/admin/${businessId}/pricing`);
    return ok(undefined, "Rule saved");
  });
  if (saved && !ruleId) redirect(`/admin/${businessId}/pricing?tab=rules`);
  return result;
}

export async function toggleRuleAction(businessId: string, ruleId: string, isActive: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "pricing.manage", { throwOnly: true });
    await ctx.db.pricingRule.update({ where: { id: ruleId }, data: { isActive } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: isActive ? "pricing.rule.activated" : "pricing.rule.deactivated", entityType: "pricing_rule", entityId: ruleId });
    revalidatePath(`/admin/${businessId}/pricing`);
    return ok(undefined);
  });
}

export async function archiveRuleAction(businessId: string, ruleId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "pricing.manage", { throwOnly: true });
    await ctx.db.pricingRule.update({ where: { id: ruleId }, data: { deletedAt: new Date(), isActive: false } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "pricing.rule.archived", entityType: "pricing_rule", entityId: ruleId });
    revalidatePath(`/admin/${businessId}/pricing`);
    return ok(undefined, "Rule archived");
  });
}

export async function duplicateRuleAction(businessId: string, ruleId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "pricing.manage", { throwOnly: true });
    const src = await ctx.db.pricingRule.findFirstOrThrow({ where: { id: ruleId, businessId } });
    const row = await ctx.db.pricingRule.create({ data: { businessId, name: `${src.name} (copy)`, description: src.description, priority: src.priority + 1, serviceId: src.serviceId, conditions: src.conditions as object, actions: src.actions as object, isActive: false } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "pricing.rule.duplicated", entityType: "pricing_rule", entityId: row.id, metadata: { sourceId: ruleId } });
    revalidatePath(`/admin/${businessId}/pricing`);
    return ok(undefined, "Rule duplicated (inactive)");
  });
}

export async function testCalcAction(businessId: string, serviceId: string | null, inputs: Record<string, unknown>): Promise<ActionResult<TestCalcResult>> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "pricing.manage", { throwOnly: true });
    const result = await runTestCalculation(ctx.db, { id: businessId, taxRate: ctx.business.taxRate, taxInclusive: ctx.business.taxInclusive }, serviceId && isUuid(serviceId) ? serviceId : null, inputs);
    return ok(result);
  });
}
