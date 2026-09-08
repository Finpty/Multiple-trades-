import type { BusinessContext } from "@/lib/authz";
import { listFieldDefinitions, loadFieldValues } from "@/lib/custom-fields";
import { mediaUrls } from "@/lib/media/service";
import { listProjectLinkOptions, materialTypeSuggestions, projectMaterials, projectMediaViews, projectSeo, toDateInput, type ProjectDetail } from "@/lib/content/projects";
import { asObject } from "@/lib/json";
import type { PickedMedia } from "@/components/admin/media-picker";
import type { ProjectEditorProps, ProjectFormValues } from "@/components/admin/content/projects/project-editor";

const AREA_TYPE_LABEL: Record<string, string> = { COUNTRY: "Country", STATE: "State", REGION: "Region", CITY: "City", SUBURB: "Suburb", POSTCODE: "Postcode" };

function emptyValues(): ProjectFormValues {
  return { title: "", slug: "", summary: "", description: "", status: "PUBLISHED", isFeatured: false, locationText: "", serviceAreaId: null, serviceIds: [], featuredMediaId: null, videoMediaId: null, media: [], materials: [], projectSize: "", completionDate: "", challenges: "", solutions: "", testimonial: "", testimonialAuthor: "", seo: {} };
}

async function picked(media: { id: string; storageDriver: string; storageKey: string; visibility: "PUBLIC" | "PRIVATE"; variants: unknown; altText: string | null; title: string | null; width: number | null; height: number | null; kind: string; mimeType: string } | null): Promise<PickedMedia | null> {
  if (!media) return null;
  const u = await mediaUrls(media as Parameters<typeof mediaUrls>[0]);
  return { id: u.id, url: u.url, thumb: u.thumb, medium: u.medium, alt: u.alt, kind: u.kind, title: media.title };
}

export async function buildProjectEditorProps(ctx: BusinessContext, project: ProjectDetail | null): Promise<ProjectEditorProps> {
  const businessId = ctx.business.id;
  const [links, defs, values, mediaViews] = await Promise.all([
    listProjectLinkOptions(ctx.db, businessId),
    listFieldDefinitions(ctx.db, businessId, "PROJECT"),
    project ? loadFieldValues(ctx.db, project.id) : Promise.resolve({}),
    project ? projectMediaViews(project) : Promise.resolve([]),
  ]);
  const [featured, video] = await Promise.all([
    project?.featuredMediaId ? ctx.db.media.findFirst({ where: { id: project.featuredMediaId, businessId } }) : null,
    project?.videoMediaId ? ctx.db.media.findFirst({ where: { id: project.videoMediaId, businessId } }) : null,
  ]);
  const terminology = asObject<{ terminology?: Record<string, unknown> }>(ctx.business.settings).terminology;
  const form: ProjectFormValues = project
    ? {
        title: project.title,
        slug: project.slug,
        summary: project.summary ?? "",
        description: project.description ?? "",
        status: project.status,
        isFeatured: project.isFeatured,
        locationText: project.locationText ?? "",
        serviceAreaId: project.serviceAreaId,
        serviceIds: project.services.map((s) => s.serviceId),
        featuredMediaId: project.featuredMediaId,
        videoMediaId: project.videoMediaId,
        media: mediaViews.map((m) => ({ id: m.mediaId, stage: m.stage, caption: m.caption, thumb: m.thumb, alt: m.alt, kind: m.kind, title: m.title })),
        materials: projectMaterials(project),
        projectSize: project.projectSize ?? "",
        completionDate: toDateInput(project.completionDate),
        challenges: project.challenges ?? "",
        solutions: project.solutions ?? "",
        testimonial: project.testimonial ?? "",
        testimonialAuthor: project.testimonialAuthor ?? "",
        seo: projectSeo(project),
      }
    : emptyValues();
  const depthOf = (id: string | null, all: Array<{ id: string; parentId: string | null }>, d = 0): number => (id ? depthOf(all.find((x) => x.id === id)?.parentId ?? null, all, d + 1) : d);
  return {
    businessId,
    projectId: project?.id ?? null,
    values: form,
    previews: { featured: await picked(featured as Parameters<typeof picked>[0]), video: await picked(video as Parameters<typeof picked>[0]) },
    services: links.services.map((s) => ({ id: s.id, label: s.name, depth: depthOf(s.parentId, links.services) })),
    areas: links.areas.map((a) => ({ id: a.id, name: a.name, hint: AREA_TYPE_LABEL[a.type] ?? a.type })),
    materialTypes: materialTypeSuggestions(terminology),
    customFields: { definitions: defs, values },
    reviewCount: project?._count.reviews ?? 0,
    siteSlug: ctx.business.slug,
    terminology: { project: String(terminology?.project ?? "Project"), service: String(terminology?.service ?? "Service") },
  };
}
