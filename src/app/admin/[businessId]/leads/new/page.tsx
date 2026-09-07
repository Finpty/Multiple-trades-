import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listFieldDefinitions } from "@/lib/custom-fields";
import { listBusinessMembers } from "@/lib/crm/members";
import { PageHeader } from "@/components/ui";
import { LeadForm } from "@/components/admin/operations/crm/lead-form";
import { createLead } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewLeadPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ serviceId?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "crm.manage");
  const sp = await searchParams;
  const [services, members, definitions] = await Promise.all([
    ctx.db.service.findMany({ where: { businessId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    listBusinessMembers(businessId),
    listFieldDefinitions(ctx.db, businessId, "LEAD"),
  ]);
  const base = `/admin/${businessId}/leads`;
  return (
    <div>
      <PageHeader title="New lead" description="Record an enquiry that came in by phone, email or referral." breadcrumbs={[{ label: "Leads", href: base }, { label: "New" }]} />
      <LeadForm
        businessId={businessId}
        action={createLead.bind(null, businessId)}
        values={{ name: "", email: "", phone: "", message: "", serviceId: isUuid(sp.serviceId) ? sp.serviceId : "", source: "manual", locationText: "", valueDollars: "", assignedToUserId: ctx.user.id, status: "NEW" }}
        services={services}
        members={members}
        definitions={definitions}
        customValues={{}}
        cancelHref={base}
        submitLabel="Create lead"
        showStatus
      />
    </div>
  );
}
