import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { PageHeader } from "@/components/ui";
import { TeamMemberForm } from "@/components/admin/content/team/team-member-form";

export const dynamic = "force-dynamic";

export default async function NewTeamMemberPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  await requireBusinessAccess(businessId, "business.settings");
  return (
    <div>
      <PageHeader title="Add team member" breadcrumbs={[{ label: "Team", href: `/admin/${businessId}/team` }, { label: "New" }]} />
      <TeamMemberForm businessId={businessId} memberId={null} values={{ name: "", role: "", bio: "", email: "", phone: "", mediaId: null, isActive: true }} photo={null} />
    </div>
  );
}
