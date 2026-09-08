import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listProjects, type ProjectListFilter } from "@/lib/content/projects";
import { siteTerminology, termPlural } from "@/lib/site/context";
import { ButtonLink, EmptyState, PageHeader, cn, formatDate } from "@/components/ui";
import { ProjectsTable } from "@/components/admin/content/projects/projects-table";
import { deleteProjectAction, reorderProjectsAction, restoreProjectAction, setProjectFeaturedAction, setProjectStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: ProjectListFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "PUBLISHED", label: "Published" },
  { key: "DRAFT", label: "Drafts" },
  { key: "featured", label: "Featured" },
  { key: "ARCHIVED", label: "Archived" },
  { key: "deleted", label: "Deleted" },
];

export default async function ProjectsPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ filter?: string; q?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "projects.manage");
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.key === sp.filter) ? sp.filter : "all") as ProjectListFilter;
  const q = (sp.q ?? "").trim();
  const rows = await listProjects(ctx.db, businessId, { filter, q: q || undefined });
  const terms = siteTerminology({ business: ctx.business } as Parameters<typeof siteTerminology>[0]);
  const plural = termPlural(terms, "project");
  const base = `/admin/${businessId}/projects`;
  return (
    <div>
      <PageHeader title={plural} description={`Completed work shown in your portfolio. Each ${terms.project.toLowerCase()} can have before, progress and after photos, a video, materials and a testimonial.`} actions={<ButtonLink href={`${base}/new`}>New {terms.project.toLowerCase()}</ButtonLink>} />
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key === "all" && !q ? base : `${base}?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cn("rounded-full px-3 py-1 text-sm", f.key === filter ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>{f.label}</Link>
        ))}
        <form className="ml-auto flex gap-2" action={base}>
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input name="q" defaultValue={q} placeholder="Search title or location" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm" aria-label="Search projects" />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={q ? "No matches" : `No ${plural.toLowerCase()} yet`} description={q ? "Try a different search." : `Add your first ${terms.project.toLowerCase()} to start building the portfolio.`} action={!q && <ButtonLink href={`${base}/new`}>New {terms.project.toLowerCase()}</ButtonLink>} />
      ) : (
        <ProjectsTable
          businessId={businessId}
          siteSlug={ctx.business.slug}
          sortable={filter === "all" && !q}
          rows={rows.map((r) => ({ id: r.id, title: r.title, slug: r.slug, location: r.locationText ?? r.areaName ?? "", completed: r.completionDate ? formatDate(r.completionDate) : "", status: r.status, isFeatured: r.isFeatured, deleted: !!r.deletedAt, updatedAt: formatDate(r.updatedAt), thumb: r.thumb, services: r.services.map((s) => s.name), mediaCount: r.mediaCount }))}
          actions={{ setStatus: setProjectStatusAction, setFeatured: setProjectFeaturedAction, remove: deleteProjectAction, restore: restoreProjectAction, reorder: reorderProjectsAction }}
        />
      )}
    </div>
  );
}
