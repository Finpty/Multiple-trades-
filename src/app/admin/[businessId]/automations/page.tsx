import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { platformDb } from "@/lib/db";
import { eventLabel } from "@/lib/automation/catalog";
import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState, PageHeader, formatDateTime, statusTone } from "@/components/ui";
import { AutomationList } from "@/components/admin/operations/automations/automation-list";
import { automationStateAction, testAutomationAction } from "./actions";
import { summariseAutomationActions } from "./summary";

export const dynamic = "force-dynamic";

export default async function AutomationsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "automation.manage");
  const [rules, runs] = await Promise.all([
    ctx.db.automationRule.findMany({ where: { businessId }, orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] }),
    platformDb.automationRun.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 25, include: { rule: { select: { name: true } } } }),
  ]);
  const lastByRule = new Map<string, { at: Date; status: string }>();
  for (const r of runs) if (!lastByRule.has(r.ruleId)) lastByRule.set(r.ruleId, { at: r.createdAt, status: r.status });
  const base = `/admin/${businessId}/automations`;
  return (
    <div>
      <PageHeader title="Automations" description="When something happens, do something — follow-up tasks, emails, status changes, review requests. No code required." actions={<ButtonLink href={`${base}/new`}>New automation</ButtonLink>} />
      {rules.length === 0 ? <EmptyState title="No automations yet" description="Start with “Follow up new enquiries” or “Request a review when a job completes”." action={<ButtonLink href={`${base}/new`}>New automation</ButtonLink>} /> : (
        <AutomationList businessId={businessId} rows={rules.map((r) => ({ id: r.id, name: r.name, description: r.description ?? "", trigger: eventLabel(r.triggerEvent), summary: summariseAutomationActions(r.actions), isActive: r.isActive, runCount: r.runCount, lastRunAt: lastByRule.get(r.id) ? formatDateTime(lastByRule.get(r.id)!.at) : r.lastRunAt ? formatDateTime(r.lastRunAt) : null, lastStatus: lastByRule.get(r.id)?.status ?? null }))} state={automationStateAction} test={testAutomationAction} />
      )}
      <Card className="mt-6"><CardHeader title="Recent runs" description="Every time an automation fires, the outcome is recorded here." /><CardBody>
        {runs.length === 0 ? <p className="text-sm text-neutral-500">Nothing has run yet.</p> : (
          <ul className="divide-y text-sm">{runs.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 py-1.5"><span className="min-w-0 truncate"><Link href={`${base}/${r.ruleId}`} className="hover:underline">{r.rule.name}</Link>{r.error && <span className="ml-2 text-xs text-red-600">{r.error}</span>}</span><span className="flex items-center gap-2 text-xs text-neutral-500"><Badge tone={statusTone(r.status)}>{r.status}</Badge>{formatDateTime(r.createdAt)}</span></li>)}</ul>
        )}
      </CardBody></Card>
    </div>
  );
}
