import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { platformDb } from "@/lib/db";
import { asArray, asObject } from "@/lib/json";
import type { ConditionGroup } from "@/lib/rules/conditions";
import type { AutomationAction } from "@/lib/automation/actions";
import { Badge, Card, CardBody, CardHeader, PageHeader, formatDateTime, statusTone } from "@/components/ui";
import { AutomationEditor } from "@/components/admin/operations/automations/automation-editor";
import { loadAutomationFormData } from "../form-data";
import { saveAutomationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditAutomationPage({ params }: { params: Promise<{ businessId: string; ruleId: string }> }) {
  const { businessId, ruleId } = await params;
  if (!isUuid(businessId) || !isUuid(ruleId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "automation.manage");
  const [rule, data, runs] = await Promise.all([
    ctx.db.automationRule.findFirst({ where: { id: ruleId, businessId } }),
    loadAutomationFormData(ctx),
    platformDb.automationRun.findMany({ where: { businessId, ruleId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  if (!rule) notFound();
  const base = `/admin/${businessId}/automations`;
  return (
    <div>
      <PageHeader title={rule.name} description={<Badge tone={rule.isActive ? "green" : "neutral"}>{rule.isActive ? "active" : "paused"}</Badge>} breadcrumbs={[{ label: "Automations", href: base }, { label: rule.name }]} />
      <AutomationEditor businessId={businessId} values={{ ruleId: rule.id, name: rule.name, description: rule.description ?? "", triggerEvent: rule.triggerEvent, conditions: asObject<ConditionGroup>(rule.conditions), actions: asArray<AutomationAction>(rule.actions), isActive: rule.isActive }} {...data} cancelHref={base} save={saveAutomationAction} />
      <Card className="mt-6"><CardHeader title="Run history" description={`${rule.runCount} run${rule.runCount === 1 ? "" : "s"} in total.`} /><CardBody>
        {runs.length === 0 ? <p className="text-sm text-neutral-500">This automation has not run yet. Use “Test” on the list page to try it against the latest matching event.</p> : (
          <ul className="divide-y text-sm">{runs.map((r) => { const res = asObject<{ results?: unknown[]; manual?: boolean; reason?: string }>(r.result); return <li key={r.id} className="flex items-center justify-between gap-3 py-1.5"><span className="min-w-0 truncate text-neutral-700">{res.manual ? "Manual test" : "Triggered"}{res.reason === "conditions_not_met" ? " · conditions not met" : ""}{r.error ? <span className="ml-2 text-xs text-red-600">{r.error}</span> : res.results?.length ? <span className="ml-2 text-xs text-neutral-500">{res.results.length} action{res.results.length === 1 ? "" : "s"}</span> : null}</span><span className="flex items-center gap-2 text-xs text-neutral-500"><Badge tone={statusTone(r.status)}>{r.status}</Badge>{formatDateTime(r.createdAt)}</span></li>; })}</ul>
        )}
      </CardBody></Card>
    </div>
  );
}
