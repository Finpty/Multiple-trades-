"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { bool, formToObject, ok, optStr, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { platformDb } from "@/lib/db";
import { toJson } from "@/lib/json";
import { DOMAIN_EVENT_TYPES, type DomainEventEnvelope, type DomainEventType } from "@/lib/events/types";
import { runSingleRule, type RuleRunOutcome } from "@/lib/automation/engine";

const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create_task"), title: z.string().trim().min(1, "Task title is required").max(200), description: z.string().max(2000).optional(), dueInDays: z.coerce.number().int().min(0).max(365).optional(), assignToUserId: z.string().uuid().nullable().optional() }),
  z.object({ type: z.literal("notify_user"), userId: z.string().uuid().nullable().optional(), useAssignedUser: z.boolean().optional(), title: z.string().trim().min(1, "Notification title is required").max(200), body: z.string().max(2000).optional() }),
  z.object({ type: z.literal("send_email"), to: z.string().trim().min(1, "Recipient is required").max(200), subject: z.string().trim().min(1, "Subject is required").max(200), body: z.string().trim().min(1, "Email body is required").max(10_000) }),
  z.object({ type: z.literal("create_project_from_quote") }),
  z.object({ type: z.literal("update_lead_status"), status: z.string().trim().min(1).max(40) }),
  z.object({ type: z.literal("request_review"), delayDays: z.coerce.number().int().min(0).max(365).optional() }),
  z.object({ type: z.literal("log_message"), body: z.string().trim().min(1, "Note text is required").max(5000) }),
  z.object({ type: z.literal("assign_lead"), userId: z.string().uuid("Choose a team member") }),
  z.object({ type: z.literal("send_sms"), to: z.string().trim().min(1, "Recipient is required").max(200), body: z.string().trim().min(1, "Message is required").max(1000) }),
]);

const RuleSchema = z.object({
  name: z.string().trim().min(1, "Give the automation a name").max(160),
  description: z.string().trim().max(1000).optional(),
  triggerEvent: z.enum(DOMAIN_EVENT_TYPES as unknown as [string, ...string[]]),
  conditions: z.object({ match: z.enum(["all", "any"]).optional(), rules: z.array(z.unknown()).optional() }).default({}),
  actions: z.array(ActionSchema).min(1, "Add at least one action").max(20),
  isActive: z.boolean().default(true),
});

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}
function revalidate(businessId: string, ruleId?: string) {
  revalidatePath(`/admin/${businessId}/automations`);
  if (ruleId) revalidatePath(`/admin/${businessId}/automations/${ruleId}`);
}

export async function saveAutomationAction(_prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction<{ id: string }>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "automation.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const ruleId = optStr(obj.ruleId);
    const input = RuleSchema.parse({ name: str(obj.name), description: optStr(obj.description), triggerEvent: str(obj.triggerEvent), conditions: obj.conditions ?? {}, actions: Array.isArray(obj.actions) ? obj.actions : [], isActive: bool(obj.isActive) });
    const data = { name: input.name, description: input.description || null, triggerEvent: input.triggerEvent, conditions: toJson(input.conditions), actions: toJson(input.actions), isActive: input.isActive };
    if (ruleId) {
      const id = idFrom(ruleId, "automation");
      const before = await ctx.db.automationRule.findFirst({ where: { id, businessId } });
      if (!before) throw new Error("Automation not found.");
      const after = await ctx.db.automationRule.update({ where: { id }, data });
      await recordAudit({ actorUserId: ctx.user.id, businessId, action: "automation.updated", entityType: "automation_rule", entityId: id, before: { name: before.name, triggerEvent: before.triggerEvent, actions: before.actions }, after: { name: after.name, triggerEvent: after.triggerEvent, actions: after.actions } });
      revalidate(businessId, id);
      return ok({ id }, "Automation saved");
    }
    const rule = await ctx.db.automationRule.create({ data: { businessId, ...data } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "automation.created", entityType: "automation_rule", entityId: rule.id, after: { name: rule.name, triggerEvent: rule.triggerEvent, actions: rule.actions } });
    revalidate(businessId, rule.id);
    return ok({ id: rule.id }, "Automation created");
  });
}

export async function automationStateAction(businessId: string, ruleId: string, state: "enable" | "disable" | "delete" | "duplicate"): Promise<ActionResult<{ id?: string }>> {
  return runAction<{ id?: string }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "automation.manage", { throwOnly: true });
    const id = idFrom(ruleId, "automation");
    const rule = await ctx.db.automationRule.findFirst({ where: { id, businessId } });
    if (!rule) throw new Error("Automation not found.");
    if (state === "duplicate") {
      const copy = await ctx.db.automationRule.create({ data: { businessId, name: `${rule.name} (copy)`, description: rule.description, triggerEvent: rule.triggerEvent, conditions: toJson(rule.conditions), actions: toJson(rule.actions), isActive: false } });
      await recordAudit({ actorUserId: ctx.user.id, businessId, action: "automation.created", entityType: "automation_rule", entityId: copy.id, metadata: { duplicatedFrom: id } });
      revalidate(businessId);
      return ok({ id: copy.id }, "Duplicated (inactive until you enable it)");
    }
    if (state === "delete") {
      await ctx.db.automationRule.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await recordAudit({ actorUserId: ctx.user.id, businessId, action: "automation.deleted", entityType: "automation_rule", entityId: id, before: { name: rule.name } });
      revalidate(businessId);
      return ok({}, "Automation deleted");
    }
    await ctx.db.automationRule.update({ where: { id }, data: { isActive: state === "enable" } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: state === "enable" ? "automation.enabled" : "automation.disabled", entityType: "automation_rule", entityId: id });
    revalidate(businessId, id);
    return ok({}, state === "enable" ? "Automation enabled" : "Automation paused");
  });
}

/** Runs the rule against the most recent event of its trigger type (a dry run against real data). */
export async function testAutomationAction(businessId: string, ruleId: string): Promise<ActionResult<RuleRunOutcome & { eventAt: string }>> {
  return runAction<RuleRunOutcome & { eventAt: string }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "automation.manage", { throwOnly: true });
    const id = idFrom(ruleId, "automation");
    const rule = await ctx.db.automationRule.findFirst({ where: { id, businessId } });
    if (!rule) throw new Error("Automation not found.");
    const last = await platformDb.domainEvent.findFirst({ where: { businessId, type: rule.triggerEvent }, orderBy: { createdAt: "desc" } });
    if (!last) throw new Error(`No "${rule.triggerEvent}" event has happened yet for this business, so there is nothing to test against.`);
    const envelope: DomainEventEnvelope = { id: last.id, type: last.type as DomainEventType, payload: last.payload as never, businessId: last.businessId, organizationId: last.organizationId, actorUserId: last.actorUserId, createdAt: last.createdAt };
    const outcome = await runSingleRule(id, envelope);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "automation.tested", entityType: "automation_rule", entityId: id, metadata: { eventId: last.id, status: outcome.status } });
    revalidate(businessId, id);
    return ok({ ...outcome, eventAt: last.createdAt.toISOString() });
  });
}
