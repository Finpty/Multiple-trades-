import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { listAreaParentOptions, listServiceChoices } from "@/lib/content/areas";
import { PageHeader, cn } from "@/components/ui";
import { AreaForm } from "@/components/admin/content/areas/area-form";
import { BulkAddForm } from "@/components/admin/content/areas/bulk-add-form";

export const dynamic = "force-dynamic";

export default async function NewAreaPage({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<{ tab?: string; parent?: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "areas.manage");
  const sp = await searchParams;
  const bulk = sp.tab === "bulk";
  const [parents, services] = await Promise.all([listAreaParentOptions(ctx.db, businessId), listServiceChoices(ctx.db, businessId)]);
  const base = `/admin/${businessId}/areas`;
  const parentId = sp.parent && isUuid(sp.parent) && parents.some((p) => p.id === sp.parent) ? sp.parent : null;
  return (
    <div>
      <PageHeader title={bulk ? "Bulk add areas" : "New service area"} breadcrumbs={[{ label: "Service Areas", href: base }, { label: bulk ? "Bulk add" : "New" }]} />
      <nav className="mb-5 flex gap-1 border-b border-neutral-200">
        <Link href={`${base}/new`} className={cn("border-b-2 px-3 py-2 text-sm", !bulk ? "border-neutral-900 font-medium text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900")}>Single area</Link>
        <Link href={`${base}/new?tab=bulk`} className={cn("border-b-2 px-3 py-2 text-sm", bulk ? "border-neutral-900 font-medium text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-900")}>Bulk add (paste a list)</Link>
      </nav>
      {bulk ? (
        <BulkAddForm businessId={businessId} parents={parents} services={services} />
      ) : (
        <AreaForm
          businessId={businessId}
          parents={parents}
          services={services}
          projects={[]}
          previewUrl={null}
          values={{ name: "", slug: "", type: "SUBURB", parentId, postcode: "", state: "", country: "AU", lat: "", lng: "", radiusKm: "", isPrimary: false, isEnabled: true, generatePage: true, content: { intro: "", body: "", highlights: [], faqs: [] }, seo: {}, serviceIds: [] }}
        />
      )}
    </div>
  );
}
