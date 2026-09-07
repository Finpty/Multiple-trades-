import Link from "next/link";
import { notFound } from "next/navigation";
import type { ServiceAreaType } from "@prisma/client";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { AREA_TYPES, AREA_TYPE_VALUES, buildAreaTree, countAreasByType, listAreas, type AreaTreeNode } from "@/lib/content/areas";
import { Alert, Button, ButtonLink, EmptyState, Input, PageHeader, Select, cn } from "@/components/ui";
import { AreasTree, type AreaTreeRowView } from "@/components/admin/content/areas/areas-tree";

export const dynamic = "force-dynamic";

type SP = { filter?: string; type?: string; enabled?: string; q?: string };

export default async function AreasPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<SP> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "areas.manage");
  const sp = await searchParams;
  const archived = sp.filter === "archived";
  const type = AREA_TYPE_VALUES.includes(sp.type as ServiceAreaType) ? (sp.type as ServiceAreaType) : null;
  const enabled = sp.enabled === "enabled" || sp.enabled === "disabled" ? sp.enabled : "all";
  const q = (sp.q ?? "").trim();
  const [rows, allRows] = await Promise.all([listAreas(ctx.db, businessId, { archived, type, enabled, q }), listAreas(ctx.db, businessId)]);
  const counts = countAreasByType(allRows);
  const thinCount = allRows.filter((r) => r.thin && r.generatePage && r.isEnabled).length;
  const base = `/admin/${businessId}/areas`;
  const filtering = !!type || enabled !== "all" || !!q;

  const toView = (n: AreaTreeNode): AreaTreeRowView => ({
    id: n.id,
    parentId: n.parentId,
    name: n.name,
    slug: n.slug,
    type: n.type,
    postcode: n.postcode,
    state: n.state,
    isPrimary: n.isPrimary,
    isEnabled: n.isEnabled,
    generatePage: n.generatePage,
    servicesCount: n.servicesCount,
    projectsCount: n.projectsCount,
    completeness: n.completeness,
    thin: n.thin,
    archived: !!n.deletedAt,
    previewUrl: `/${ctx.business.slug}/areas/${n.slug}?__preview=draft`,
    children: n.children.map(toView),
  });
  const tree = buildAreaTree(rows).map(toView);

  return (
    <div>
      <PageHeader
        title="Service Areas"
        description="Where you work. Nest suburbs under cities and regions; each enabled area with a page becomes a local landing page on your website."
        actions={
          <>
            <ButtonLink href={`${base}/matrix`} variant="secondary">Service matrix</ButtonLink>
            <ButtonLink href={`${base}/new?tab=bulk`} variant="secondary">Bulk add</ButtonLink>
            <ButtonLink href={`${base}/new`}>New area</ButtonLink>
          </>
        }
      />

      {thinCount > 0 && !archived && (
        <Alert tone="warning" className="mb-4" title={`${thinCount} area page${thinCount === 1 ? " has" : "s have"} no unique content`}>
          Pages without local copy or linked projects are published as <em>noindex</em> so search engines do not treat them as duplicate “thin” pages. Open each area and add an intro, body text and local FAQs to have it indexed.
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        {AREA_TYPES.map((t) => (
          <Link key={t.value} href={`${base}?type=${t.value}`} className={cn("rounded-full border px-2.5 py-1", type === t.value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:bg-neutral-50")}>
            {counts[t.value]} {counts[t.value] === 1 ? t.label : t.plural}
          </Link>
        ))}
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        {archived && <input type="hidden" name="filter" value="archived" />}
        <Input name="q" defaultValue={q} placeholder="Search name, postcode, state…" className="w-full sm:w-64" />
        <Select name="type" defaultValue={type ?? ""} className="w-full sm:w-40">
          <option value="">All types</option>
          {AREA_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
        <Select name="enabled" defaultValue={enabled} className="w-full sm:w-36">
          <option value="all">Enabled + disabled</option>
          <option value="enabled">Enabled only</option>
          <option value="disabled">Disabled only</option>
        </Select>
        <Button type="submit" variant="secondary">Filter</Button>
        {filtering && <Link href={archived ? `${base}?filter=archived` : base} className="text-sm text-neutral-600 underline-offset-4 hover:underline">Clear</Link>}
        <span className="ml-auto flex items-center gap-1">
          <Link href={base} className={cn("rounded-full px-3 py-1 text-sm", !archived ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>Active</Link>
          <Link href={`${base}?filter=archived`} className={cn("rounded-full px-3 py-1 text-sm", archived ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>Archived</Link>
        </span>
      </form>

      {rows.length === 0 ? (
        archived ? (
          <EmptyState title="No archived areas" description="Archived areas are removed from the website but keep their content and links. Archive one from its Danger zone." action={<ButtonLink href={base} variant="secondary">Show active</ButtonLink>} />
        ) : filtering ? (
          <EmptyState title="No areas match" description="Try a different search or clear the filters." action={<ButtonLink href={base} variant="secondary">Clear filters</ButtonLink>} />
        ) : (
          <EmptyState title="No service areas yet" description="Add the suburbs, cities and regions you cover. Bulk add lets you paste a whole list at once; each area can then get its own local page." action={<span className="flex gap-2"><ButtonLink href={`${base}/new?tab=bulk`} variant="secondary">Bulk add</ButtonLink><ButtonLink href={`${base}/new`}>Add your first area</ButtonLink></span>} />
        )
      ) : (
        <AreasTree businessId={businessId} tree={tree} sortable={!archived && !filtering} />
      )}
      {rows.length > 0 && filtering && !archived && <p className="mt-2 text-xs text-neutral-500">Drag-to-reorder is available when no filters are applied.</p>}
    </div>
  );
}
