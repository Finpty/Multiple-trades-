import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { PageHeader } from "@/components/ui";
import { ServiceEditor } from "@/components/admin/content/services/service-editor";
import { buildServiceEditorProps } from "../editor-data";

export const dynamic = "force-dynamic";

export default async function NewServicePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "services.manage");
  const props = await buildServiceEditorProps(ctx, null);
  return (
    <div>
      <PageHeader title="New service" description="Describe what you offer and how it is priced. You can add media, FAQs and areas now or later." breadcrumbs={[{ label: "Services", href: `/admin/${businessId}/services` }, { label: "New" }]} />
      <ServiceEditor {...props} />
    </div>
  );
}
