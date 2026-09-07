import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { loadAreaMatrix } from "@/lib/content/areas";
import { ButtonLink, PageHeader } from "@/components/ui";
import { ServiceMatrix } from "@/components/admin/content/areas/service-matrix";

export const dynamic = "force-dynamic";

export default async function AreaMatrixPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "areas.manage");
  const matrix = await loadAreaMatrix(ctx.db, businessId);
  const base = `/admin/${businessId}/areas`;
  return (
    <div>
      <PageHeader
        title="Service matrix"
        description="Which services you offer in which areas. Tick cells, use the all/none shortcuts on a row or column, then save."
        breadcrumbs={[{ label: "Service Areas", href: base }, { label: "Service matrix" }]}
        actions={<ButtonLink href={base} variant="secondary">Back to areas</ButtonLink>}
      />
      <ServiceMatrix businessId={businessId} areas={matrix.areas} services={matrix.services} links={matrix.links} />
    </div>
  );
}
