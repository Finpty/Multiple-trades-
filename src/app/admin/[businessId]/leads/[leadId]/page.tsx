import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { asObject } from "@/lib/json";
import { listFieldDefinitions, loadFieldValues } from "@/lib/custom-fields";
import { formatMoney, leadStatusLabel } from "@/lib/crm/leads";
import { customerName } from "@/lib/crm/customers";
import { listBusinessMembers } from "@/lib/crm/members";
import { buildTimeline } from "@/lib/crm/timeline";
import { displayValue, formFields, fieldLabelFor } from "@/lib/forms/builder";
import { Badge, Card, CardBody, CardHeader, Description, PageHeader, formatDate, formatDateTime, statusTone } from "@/components/ui";
import { CustomFieldsCard } from "@/components/admin/operations/crm/custom-fields-card";
import { LeadSideActions } from "@/components/admin/operations/crm/lead-side-actions";
import { TimelineComposer } from "@/components/admin/operations/crm/timeline-composer";
import { TimelineView } from "@/components/admin/operations/crm/timeline-view";
import { saveLeadCustomFields } from "../actions";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ businessId: string; leadId: string }> }) {
  const { businessId, leadId } = await params;
  if (!isUuid(businessId) || !isUuid(leadId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "crm.view");
  const lead = await ctx.db.lead.findFirst({
    where: { id: leadId, businessId },
    include: { service: { select: { name: true } }, customer: { select: { id: true, firstName: true, lastName: true } }, formSubmission: { include: { form: { select: { id: true, name: true, fields: true } } } }, quotes: { where: { deletedAt: null }, select: { id: true, number: true, status: true, totalCents: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!lead) notFound();
  const canManage = ctx.can("crm.manage");
  const [members, definitions, customValues, timeline, customers] = await Promise.all([
    listBusinessMembers(businessId),
    listFieldDefinitions(ctx.db, businessId, "LEAD"),
    loadFieldValues(ctx.db, leadId),
    buildTimeline(ctx.db, businessId, { leadId }),
    lead.customerId ? Promise.resolve([]) : ctx.db.customer.findMany({ where: { businessId, deletedAt: null, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { firstName: "asc" }, take: 200 }),
  ]);
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const base = `/admin/${businessId}`;
  const { currency, locale } = ctx.business;
  const submissionFields = lead.formSubmission ? formFields(lead.formSubmission.form) : [];
  const submissionData = lead.formSubmission ? asObject<Record<string, unknown>>(lead.formSubmission.data) : {};

  return (
    <div>
      <PageHeader
        title={lead.name}
        description={`${lead.source ?? "Manual"} · created ${formatDateTime(lead.createdAt)}`}
        breadcrumbs={[{ label: "Leads", href: `${base}/leads` }, { label: lead.name }]}
        actions={<Badge tone={statusTone(lead.status)}>{leadStatusLabel(lead.status)}</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Summary" />
            <CardBody>
              <Description
                items={[
                  { label: "Email", value: lead.email ? <a href={`mailto:${lead.email}`} className="underline">{lead.email}</a> : null },
                  { label: "Phone", value: lead.phone ? <a href={`tel:${lead.phone}`} className="underline">{lead.phone}</a> : null },
                  { label: "Service", value: lead.service?.name ?? null },
                  { label: "Location", value: lead.locationText },
                  { label: "Estimated value", value: lead.valueCents !== null ? formatMoney(lead.valueCents, currency, locale) : null },
                  { label: "Assigned to", value: lead.assignedToUserId ? (memberName.get(lead.assignedToUserId) ?? "Member") : null },
                  { label: "Customer", value: lead.customer ? <Link href={`${base}/customers/${lead.customer.id}`} className="underline">{customerName(lead.customer)}</Link> : null },
                  { label: "Quotes", value: lead.quotes.length ? <span className="space-x-2">{lead.quotes.map((q) => <Link key={q.id} href={`${base}/quotes/${q.id}`} className="underline">{q.number} ({q.status.toLowerCase()}, {formatMoney(q.totalCents, currency, locale)})</Link>)}</span> : null },
                ]}
              />
              {lead.message && (
                <div className="mt-4 rounded-md bg-neutral-50 p-3 text-sm text-neutral-800">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Message</div>
                  <p className="whitespace-pre-wrap">{lead.message}</p>
                </div>
              )}
            </CardBody>
          </Card>
          {definitions.length > 0 && (
            <Card>
              <CardHeader title="Lead details" description="Custom fields for this business." />
              <CardBody>
                {canManage ? (
                  <CustomFieldsCard businessId={businessId} action={saveLeadCustomFields.bind(null, businessId, leadId)} definitions={definitions} values={customValues} />
                ) : (
                  <Description items={definitions.map((d) => ({ label: d.label, value: displayValue(customValues[d.key]) || null }))} />
                )}
              </CardBody>
            </Card>
          )}
          {lead.formSubmission && (
            <Card>
              <CardHeader title="Website submission" description={<span>From <Link href={`${base}/forms/${lead.formSubmission.form.id}/submissions/${lead.formSubmission.id}`} className="underline">{lead.formSubmission.form.name}</Link> on {formatDateTime(lead.formSubmission.createdAt)}</span>} />
              <CardBody>
                <Description items={Object.keys(submissionData).filter((k) => !(typeof submissionData[k] === "string" && (submissionData[k] as string).startsWith("data:image/"))).map((k) => ({ label: fieldLabelFor(submissionFields, k), value: displayValue(submissionData[k]) || null }))} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Timeline" description="Notes, emails, tasks and changes for this lead." />
            <CardBody className="space-y-6">
              {canManage && <TimelineComposer businessId={businessId} leadId={lead.id} customerId={lead.customerId} defaultEmail={lead.email} members={members} />}
              <TimelineView businessId={businessId} canManage={canManage} entries={timeline.map((e) => ({ ...e, at: e.at.toISOString(), task: e.task ? { ...e.task, dueAt: e.task.dueAt?.toISOString() ?? null } : undefined }))} />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Actions" />
            <CardBody>
              {canManage ? (
                <LeadSideActions
                  businessId={businessId}
                  lead={{ id: lead.id, status: lead.status, assignedToUserId: lead.assignedToUserId, customerId: lead.customerId, customerName: lead.customer ? customerName(lead.customer) : null, archived: !!lead.deletedAt }}
                  members={members}
                  customers={customers.map((c) => ({ id: c.id, name: `${customerName(c)}${c.email ? ` · ${c.email}` : ""}` }))}
                  canQuote={ctx.can("quotes.manage")}
                />
              ) : (
                <p className="text-sm text-neutral-500">You can view this lead but not change it.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Record" />
            <CardBody>
              <Description items={[{ label: "Created", value: formatDate(lead.createdAt) }, { label: "Updated", value: formatDate(lead.updatedAt) }, { label: "Source", value: lead.source }]} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
