import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { AREA_TYPE_LABELS, areaContent, areaSeo, getArea, listAreaParentOptions, listServiceChoices } from "@/lib/content/areas";
import { Badge, PageHeader, formatDate } from "@/components/ui";
import { AreaForm } from "@/components/admin/content/areas/area-form";

export const dynamic = "force-dynamic";

export default async function EditAreaPage({ params }: { params: Promise<{ businessId: string; areaId: string }> }) {
  const { businessId, areaId } = await params;
  if (!isUuid(businessId) || !isUuid(areaId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "areas.manage");
  const area = await getArea(ctx.db, businessId, areaId);
  if (!area) notFound();
  const [parents, services] = await Promise.all([listAreaParentOptions(ctx.db, businessId, areaId), listServiceChoices(ctx.db, businessId)]);
  const previewUrl = `/${ctx.business.slug}/areas/${area.slug}?__preview=draft`;
  const base = `/admin/${businessId}/areas`;
  return (
    <div>
      <PageHeader
        title={area.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{AREA_TYPE_LABELS[area.type]}</Badge>
            {area.deletedAt ? <Badge tone="neutral">Archived</Badge> : area.isEnabled ? <Badge tone="green">Enabled</Badge> : <Badge tone="amber">Disabled</Badge>}
            {area.isPrimary && <Badge tone="blue">Primary</Badge>}
            {!area.generatePage && <Badge tone="neutral">No page</Badge>}
            {area.parent && <span className="text-sm text-neutral-500">in {area.parent.name}</span>}
            {area.generatePage && !area.deletedAt && <a href={previewUrl} target="_blank" rel="noreferrer" className="text-sm text-neutral-600 underline-offset-2 hover:underline">Preview page ↗</a>}
          </span>
        }
        breadcrumbs={[{ label: "Service Areas", href: base }, { label: area.name }]}
      />
      <AreaForm
        businessId={businessId}
        areaId={area.id}
        archived={!!area.deletedAt}
        parents={parents}
        services={services}
        projects={area.projects.map((p) => ({ id: p.id, title: p.title, status: p.status, completionDate: p.completionDate ? formatDate(p.completionDate) : null, archived: !!p.deletedAt || p.status === "ARCHIVED" }))}
        previewUrl={area.generatePage && !area.deletedAt ? previewUrl : null}
        values={{
          name: area.name,
          slug: area.slug,
          type: area.type,
          parentId: area.parentId,
          postcode: area.postcode ?? "",
          state: area.state ?? "",
          country: area.country,
          lat: area.lat != null ? String(area.lat) : "",
          lng: area.lng != null ? String(area.lng) : "",
          radiusKm: area.radiusKm != null ? String(area.radiusKm) : "",
          isPrimary: area.isPrimary,
          isEnabled: area.isEnabled,
          generatePage: area.generatePage,
          content: areaContent(area),
          seo: areaSeo(area),
          serviceIds: area.services.map((s) => s.serviceId),
        }}
      />
    </div>
  );
}
