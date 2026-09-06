import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { getService } from "@/lib/content/services";
import { Badge, PageHeader, statusTone } from "@/components/ui";
import { ServiceEditor } from "@/components/admin/content/services/service-editor";
import { buildServiceEditorProps } from "../editor-data";

export const dynamic = "force-dynamic";

export default async function EditServicePage({ params }: { params: Promise<{ businessId: string; serviceId: string }> }) {
  const { businessId, serviceId } = await params;
  if (!isUuid(businessId) || !isUuid(serviceId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "services.manage");
  const service = await getService(ctx.db, businessId, serviceId);
  if (!service) notFound();
  const props = await buildServiceEditorProps(ctx, service);
  const previewHref = `/${ctx.business.slug}/services/${service.slug}?__preview=draft`;
  return (
    <div>
      <PageHeader
        title={service.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={service.deletedAt ? "neutral" : statusTone(service.status)}>{service.deletedAt ? "ARCHIVED" : service.status}</Badge>
            {!service.isEnabled && !service.deletedAt && <Badge tone="amber">Disabled</Badge>}
            {service.isFeatured && <Badge tone="purple">Featured</Badge>}
            <a href={previewHref} target="_blank" rel="noreferrer" className="text-sm text-neutral-600 underline-offset-2 hover:underline">Preview on site ↗</a>
          </span>
        }
        breadcrumbs={[{ label: "Services", href: `/admin/${businessId}/services` }, { label: service.name }]}
      />
      <ServiceEditor {...props} />
    </div>
  );
}
