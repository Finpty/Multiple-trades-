import { notFound } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { getProject } from "@/lib/content/projects";
import { Badge, PageHeader, statusTone } from "@/components/ui";
import { ProjectEditor } from "@/components/admin/content/projects/project-editor";
import { buildProjectEditorProps } from "../editor-data";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: Promise<{ businessId: string; projectId: string }> }) {
  const { businessId, projectId } = await params;
  if (!isUuid(businessId) || !isUuid(projectId)) notFound();
  const ctx = await requireBusinessAccess(businessId, "projects.manage");
  const project = await getProject(ctx.db, businessId, projectId);
  if (!project) notFound();
  const props = await buildProjectEditorProps(ctx, project);
  return (
    <div>
      <PageHeader
        title={project.title}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={project.deletedAt ? "neutral" : statusTone(project.status)}>{project.deletedAt ? "DELETED" : project.status}</Badge>{project.isFeatured && <Badge tone="purple">Featured</Badge>}<span className="text-xs text-neutral-500">{project.media.length} media · {project._count.jobs} job{project._count.jobs === 1 ? "" : "s"}</span></span>}
        breadcrumbs={[{ label: `${props.terminology.project}s`, href: `/admin/${businessId}/projects` }, { label: project.title }]}
      />
      <ProjectEditor {...props} />
    </div>
  );
}
