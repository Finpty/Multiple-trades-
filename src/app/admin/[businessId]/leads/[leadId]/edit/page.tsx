import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listFieldDefinitions, loadFieldValues } from "@/lib/custom-fields";
import { listBusinessMembers } from "@/lib/crm/members";
import { PageHeader } from "@/components/ui";
import { LeadForm } from "@/components/admin/operations/crm/lead-form";
import { updateLead } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditLeadPage({ params }: { params: Promise<{ businessId: string; leadId: string }> }) {
  const { businessId, leadId } = await params;
  if (!isUuid(businessId) || !isUuid(leadId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "crm.manage");
  const lead = await ctx.db.lead.findFirst({ where: { id: leadId, businessId, deletedAt: null } });
  if (!lead) notFound();
  const [services, members, definitions, customValues] = await Promise.all([
    ctx.db.service.findMany({ where: { businessId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    listBusinessMembers(businessId),
    listFieldDefinitions(ctx.db, businessId, "LEAD"),
    loadFieldValues(ctx.db, leadId),
  ]);
  const base = `/admin/${businessId}/leads`;
  return (
    <div>
      <PageHeader title={`Edit ${lead.name}`} breadcrumbs={[{ label: "Leads", href: base }, { label: lead.name, href: `${base}/${leadId}` }, { label: "Edit" }]} />
      <LeadForm
        businessId={businessId}
        action={updateLead.bind(null, businessId, leadId)}
        values={{ name: lead.name, email: lead.email ?? "", phone: lead.phone ?? "", message: lead.message ?? "", serviceId: lead.serviceId ?? "", source: lead.source ?? "manual", locationText: lead.locationText ?? "", valueDollars: lead.valueCents !== null ? String(lead.valueCents / 100) : "", assignedToUserId: lead.assignedToUserId ?? "", status: lead.status }}
        services={services}
        members={members}
        definitions={definitions}
        customValues={customValues}
        cancelHref={`${base}/${leadId}`}
        submitLabel="Save changes"
      />
    </div>
  );
}
