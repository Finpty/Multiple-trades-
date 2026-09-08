import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { PageHeader } from "@/components/ui";
import { AutomationEditor } from "@/components/admin/operations/automations/automation-editor";
import { loadAutomationFormData } from "../form-data";
import { saveAutomationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewAutomationPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ trigger?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "automation.manage");
  const sp = await searchParams;
  const data = await loadAutomationFormData(ctx);
  const base = `/admin/${businessId}/automations`;
  return (
    <div>
      <PageHeader title="New automation" breadcrumbs={[{ label: "Automations", href: base }, { label: "New" }]} />
      <AutomationEditor businessId={businessId} values={{ ruleId: null, name: "", description: "", triggerEvent: sp.trigger ?? "lead.created", conditions: {}, actions: [{ type: "create_task", title: "Follow up {{name}}", dueInDays: 1 }], isActive: true }} {...data} cancelHref={base} save={saveAutomationAction} />
    </div>
  );
}
