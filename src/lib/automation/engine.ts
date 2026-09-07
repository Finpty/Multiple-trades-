import type { AutomationRule, AutomationRunStatus } from "@prisma/client";
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
    where: { businessId: event.businessId, triggerEvent: event.type, isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  for (const rule of rules) await executeRule(rule, event, { manual: false });
}

export interface RuleRunOutcome {
  runId: string;
  status: AutomationRunStatus;
  results: unknown[];
  error: string | null;
}

type RuleRow = Pick<AutomationRule, "id" | "businessId" | "conditions" | "actions">;

/** Evaluates one rule against one event, records the AutomationRun and returns the outcome. */
async function executeRule(rule: RuleRow, event: DomainEventEnvelope, opts: { manual: boolean }): Promise<RuleRunOutcome> {
  const businessId = rule.businessId;
  const db = tenantDb(businessId);
  const context = { event: event.payload as Record<string, unknown>, businessId };
  const conditions = asObject<ConditionGroup>(rule.conditions);
  const matched = evaluateConditions(conditions, context as unknown as Record<string, unknown>);
  if (!matched) {
    const run = await platformDb.automationRun.create({
      data: { businessId, ruleId: rule.id, eventId: event.id, status: "SKIPPED", result: toJson({ reason: "conditions_not_met", manual: opts.manual }) },
    });
    return { runId: run.id, status: "SKIPPED", results: [], error: null };
  }
  const results: unknown[] = [];
  let error: string | null = null;
  for (const action of asArray<AutomationAction>(rule.actions)) {
    try {
      results.push(await executeAutomationAction(action, { event, businessId, ruleId: rule.id }));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      break;
    }
  }
  const status: AutomationRunStatus = error ? "FAILED" : "SUCCESS";
  const run = await platformDb.automationRun.create({
    data: { businessId, ruleId: rule.id, eventId: event.id, status, result: toJson({ results, manual: opts.manual }), error },
  });
  await db.automationRule.update({ where: { id: rule.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } });
  return { runId: run.id, status, results, error };
}

/**
 * Runs a single rule against a given event regardless of the rule's trigger or
 * active flag — used by the "Test with last event" button in the admin.
 */
export async function runSingleRule(ruleId: string, event: DomainEventEnvelope): Promise<RuleRunOutcome> {
  const rule = await platformDb.automationRule.findFirst({ where: { id: ruleId, deletedAt: null } });
  if (!rule) throw new Error("Automation rule not found.");
  if (!event.businessId || event.businessId !== rule.businessId) throw new Error("The event does not belong to this business.");
  return executeRule(rule, event, { manual: true });
}
