import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { JOB_PRIORITIES } from "@/lib/operations/jobs";
import { PageHeader } from "@/components/ui";
import { JobForm } from "@/components/admin/operations/jobs/job-form";
import { loadJobFormData } from "@/components/admin/operations/jobs/job-form-data";
import { saveJobAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewJobPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ workflow?: string; customerId?: string; quoteId?: string; projectId?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "jobs.manage");
  const sp = await searchParams;
  const data = await loadJobFormData(ctx, { keepQuoteId: isUuid(sp.quoteId) ? sp.quoteId : null, keepProjectId: isUuid(sp.projectId) ? sp.projectId : null });
  const quote = isUuid(sp.quoteId) ? await ctx.db.quote.findFirst({ where: { id: sp.quoteId, businessId, deletedAt: null }, select: { id: true, title: true, customerId: true, totalCents: true } }) : null;
  const base = `/admin/${businessId}/jobs`;
  return (
    <div>
      <PageHeader title="New job" breadcrumbs={[{ label: "Jobs", href: base }, { label: "New" }]} description="The job starts in the first stage of the chosen workflow." />
      <JobForm
        businessId={businessId}
        action={saveJobAction}
        values={{
          title: quote?.title ?? "",
          description: "",
          workflowId: isUuid(sp.workflow) && data.workflows.some((w) => w.id === sp.workflow) ? sp.workflow : data.defaultWorkflowId,
          customerId: quote?.customerId ?? (isUuid(sp.customerId) ? sp.customerId : null),
          quoteId: quote?.id ?? null,
          projectId: isUuid(sp.projectId) ? sp.projectId : null,
          priority: 0,
          scheduledStart: "",
          scheduledEnd: "",
          address: {},
          assignedToUserId: null,
          value: quote?.totalCents ? (quote.totalCents / 100).toFixed(2) : "",
        }}
        workflows={data.workflows}
        customers={data.customers}
        quotes={data.quotes}
        projects={data.projects}
        members={data.members}
        priorities={JOB_PRIORITIES}
        fieldDefs={data.fieldDefs}
        fieldValues={data.fieldValues}
        cancelHref={base}
        submitLabel="Create job"
      />
    </div>
  );
}
