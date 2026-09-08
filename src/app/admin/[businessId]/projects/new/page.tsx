import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { PageHeader } from "@/components/ui";
import { ProjectEditor } from "@/components/admin/content/projects/project-editor";
import { buildProjectEditorProps } from "../editor-data";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  if (!isUuid(businessId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "projects.manage");
  const props = await buildProjectEditorProps(ctx, null);
  return (
    <div>
      <PageHeader title={`New ${props.terminology.project.toLowerCase()}`} breadcrumbs={[{ label: `${props.terminology.project}s`, href: `/admin/${businessId}/projects` }, { label: "New" }]} />
      <ProjectEditor {...props} />
    </div>
  );
}
