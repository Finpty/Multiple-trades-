import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { mediaUrls } from "@/lib/media/service";
import { Badge, PageHeader } from "@/components/ui";
import { TeamMemberForm } from "@/components/admin/content/team/team-member-form";

export const dynamic = "force-dynamic";

export default async function EditTeamMemberPage({ params }: { params: Promise<{ businessId: string; memberId: string }> }) {
  const { businessId, memberId } = await params;
  if (!isUuid(businessId) || !isUuid(memberId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "business.settings");
  const m = await ctx.db.teamMember.findFirst({ where: { id: memberId, businessId, deletedAt: undefined } });
  if (!m) notFound();
  const media = m.mediaId ? await ctx.db.media.findFirst({ where: { id: m.mediaId, businessId } }) : null;
  const photo = media ? await mediaUrls(media).then((u) => ({ id: u.id, url: u.url, thumb: u.thumb, alt: u.alt, kind: u.kind, title: media.title })) : null;
  return (
    <div>
      <PageHeader title={m.name} description={<Badge tone={m.deletedAt ? "neutral" : m.isActive ? "green" : "amber"}>{m.deletedAt ? "ARCHIVED" : m.isActive ? "VISIBLE" : "HIDDEN"}</Badge>} breadcrumbs={[{ label: "Team", href: `/admin/${businessId}/team` }, { label: m.name }]} />
      <TeamMemberForm businessId={businessId} memberId={m.id} values={{ name: m.name, role: m.role ?? "", bio: m.bio ?? "", email: m.email ?? "", phone: m.phone ?? "", mediaId: m.mediaId, isActive: m.isActive }} photo={photo} />
    </div>
  );
}
