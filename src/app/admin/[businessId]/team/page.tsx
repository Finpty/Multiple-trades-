import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listTeamMembers, type TeamFilter } from "@/lib/content/team";
import { ButtonLink, EmptyState, PageHeader, cn } from "@/components/ui";
import { TeamList } from "@/components/admin/content/team/team-list";
import { reorderTeamAction, teamMemberStateAction } from "./actions";

export const dynamic = "force-dynamic";
const FILTERS: Array<{ key: TeamFilter; label: string }> = [{ key: "all", label: "All" }, { key: "active", label: "Visible" }, { key: "inactive", label: "Hidden" }, { key: "archived", label: "Archived" }];

export default async function TeamPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ filter?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "business.settings");
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.key === sp.filter) ? sp.filter : "all") as TeamFilter;
  const rows = await listTeamMembers(ctx.db, businessId, filter);
  const base = `/admin/${businessId}/team`;
  return (
    <div>
      <PageHeader title="Team" description="People shown in the Team block and on your about page." actions={<ButtonLink href={`${base}/new`}>Add team member</ButtonLink>} />
      <div className="mb-4 flex flex-wrap gap-1">{FILTERS.map((f) => <Link key={f.key} href={f.key === "all" ? base : `${base}?filter=${f.key}`} className={cn("rounded-full px-3 py-1 text-sm", f.key === filter ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>{f.label}</Link>)}</div>
      {rows.length === 0 ? <EmptyState title="No team members yet" description="Add the people customers will meet on site." action={<ButtonLink href={`${base}/new`}>Add team member</ButtonLink>} /> : (
        <TeamList businessId={businessId} sortable={filter === "all"} rows={rows.map((r) => ({ id: r.id, name: r.name, role: r.role ?? "", contact: [r.email, r.phone].filter(Boolean).join(" · "), thumb: r.thumb, isActive: r.isActive, archived: !!r.deletedAt }))} setState={teamMemberStateAction} reorder={reorderTeamAction} />
      )}
    </div>
  );
}
