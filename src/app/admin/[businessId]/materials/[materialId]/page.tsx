import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { getMaterial } from "@/lib/content/materials";
import { Badge, PageHeader } from "@/components/ui";
import { MaterialForm } from "@/components/admin/content/materials/material-form";
import { buildMaterialFormProps } from "../editor-data";

export const dynamic = "force-dynamic";

export default async function EditMaterialPage({ params }: { params: Promise<{ businessId: string; materialId: string }> }) {
  const { businessId, materialId } = await params;
  if (!isUuid(businessId) || !isUuid(materialId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "services.manage");
  const material = await getMaterial(ctx.db, businessId, materialId);
  if (!material) notFound();
  const props = await buildMaterialFormProps(ctx, material);
  return (
    <div>
      <PageHeader title={material.name} description={<Badge tone={material.deletedAt ? "neutral" : material.isActive ? "green" : "amber"}>{material.deletedAt ? "ARCHIVED" : material.isActive ? "ACTIVE" : "INACTIVE"}</Badge>} breadcrumbs={[{ label: "Materials", href: `/admin/${businessId}/materials` }, { label: material.name }]} />
      <MaterialForm businessId={businessId} materialId={material.id} {...props} />
    </div>
  );
}
