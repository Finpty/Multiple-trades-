import type { DomainEventEnvelope } from "@/lib/events";
import { platformDb, tenantDb } from "@/lib/db";
import { asArray, asObject, toJson } from "@/lib/json";
import { evaluateConditions, type ConditionGroup } from "@/lib/rules/conditions";
import { executeAutomationAction, type AutomationAction } from "./actions";

/**
 * Automation rule engine: WHEN <event> [IF conditions] THEN <actions>.
 * Rules are rows in automation_rules, edited from the business admin UI.
 */
export async function runAutomationsForEvent(event: DomainEventEnvelope): Promise<void> {
  if (!event.businessId) return;
  const db = tenantDb(event.businessId);
  const rules = await db.automationRule.findMany({
    where: { businessId: event.businessId, triggerEvent: event.type, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  for (const rule of rules) {
    const context = { event: event.payload as Record<string, unknown>, businessId: event.businessId };
    const conditions = asObject<ConditionGroup>(rule.conditions);
    const matched = evaluateConditions(conditions, context as unknown as Record<string, unknown>);
    if (!matched) {
      await platformDb.automationRun.create({
        data: { businessId: event.businessId, ruleId: rule.id, eventId: event.id, status: "SKIPPED", result: { reason: "conditions_not_met" } },
      });
      continue;
    }
    const results: unknown[] = [];
    let error: string | null = null;
    for (const action of asArray<AutomationAction>(rule.actions)) {
      try {
        results.push(await executeAutomationAction(action, { event, businessId: event.businessId, ruleId: rule.id }));
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        break;
      }
    }
    await platformDb.automationRun.create({
      data: {
        businessId: event.businessId,
        ruleId: rule.id,
        eventId: event.id,
        status: error ? "FAILED" : "SUCCESS",
        result: toJson({ results }),
        error,
      },
    });
    await db.automationRule.update({ where: { id: rule.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
  }
}
