import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { buildServiceTree, flattenServiceTree, listServices, pricingSummary, type ServiceListFilter } from "@/lib/content/services";
import { ButtonLink, EmptyState, PageHeader, cn, formatDate } from "@/components/ui";
import { ServicesTree, type ServiceTreeRowView } from "@/components/admin/content/services/services-tree";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: ServiceListFilter; label: string }> = [
  { key: "active", label: "All" },
  { key: "enabled", label: "Enabled" },
  { key: "disabled", label: "Disabled" },
  { key: "archived", label: "Archived" },
];

export default async function ServicesPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ filter?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "services.manage");
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.key === sp.filter) ? sp.filter : "active") as ServiceListFilter;
  const rows = await listServices(ctx.db, businessId, filter);
  const flat = flattenServiceTree(buildServiceTree(rows));
  const view: Array<ServiceTreeRowView & { depth: number }> = flat.map((r) => {
    const p = pricingSummary(r, ctx.business.currency, ctx.business.locale);
    return {
      id: r.id,
      parentId: r.parentId,
      depth: r.depth,
      name: r.name,
      slug: r.slug,
      pricingMethod: p.method,
      pricingRange: p.range,
      isEnabled: r.isEnabled,
      isFeatured: r.isFeatured,
      status: r.status,
      areasCount: r.areasCount,
      updatedAt: formatDate(r.updatedAt),
      archived: !!r.deletedAt,
    };
  });
  const base = `/admin/${businessId}/services`;

  return (
    <div>
      <PageHeader
        title="Services"
        description="What you offer, how it is priced on the website, and where you offer it. Drag to reorder; use the arrows to nest a service under another."
        actions={<ButtonLink href={`${base}/new`}>New service</ButtonLink>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key === "active" ? base : `${base}?filter=${f.key}`} className={cn("rounded-full px-3 py-1 text-sm", f.key === filter ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100")}>
            {f.label}
          </Link>
        ))}
        <span className="ml-auto text-xs text-neutral-500">{rows.length} service{rows.length === 1 ? "" : "s"}</span>
      </div>
      {rows.length === 0 ? (
        filter === "active" ? (
          <EmptyState title="No services yet" description="Add the services you offer. Each one becomes a page on your website with pricing, FAQs and the areas you cover." action={<ButtonLink href={`${base}/new`}>Add your first service</ButtonLink>} />
        ) : (
          <EmptyState title={`No ${filter} services`} description={filter === "archived" ? "Archived services are hidden from the website but keep their history. Archive one from its Danger zone." : "Try another filter."} action={<ButtonLink href={base} variant="secondary">Show all</ButtonLink>} />
        )
      ) : (
        <ServicesTree businessId={businessId} rows={view} sortable={filter === "active"} />
      )}
    </div>
  );
}
