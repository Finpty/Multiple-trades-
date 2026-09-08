import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { PageHeader } from "@/components/ui";
import { MaterialForm } from "@/components/admin/content/materials/material-form";
import { buildMaterialFormProps } from "../editor-data";

export const dynamic = "force-dynamic";

export default async function NewMaterialPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "services.manage");
  const props = await buildMaterialFormProps(ctx, null);
  return (
    <div>
      <PageHeader title="Add material" breadcrumbs={[{ label: "Materials", href: `/admin/${businessId}/materials` }, { label: "New" }]} />
      <MaterialForm businessId={businessId} materialId={null} {...props} />
    </div>
  );
}
