import type { BusinessContext } from "@/lib/authz";
import { getAIAvailability } from "@/lib/ai/service";
import { listFieldDefinitions, loadFieldValues } from "@/lib/custom-fields";
import { mediaUrls } from "@/lib/media/service";
import { listMaterialOptions } from "@/lib/content/materials";
import { listParentOptions, listServiceAreaOptions, serviceFaqs, serviceGallery, serviceSeo, type ServiceDetail } from "@/lib/content/services";
import type { PickedMedia } from "@/components/admin/media-picker";
import type { ServiceEditorProps, ServiceFormValues } from "@/components/admin/content/services/service-editor";
import type { GalleryItem } from "@/components/admin/content/services/media-gallery-field";

const AREA_TYPE_LABEL: Record<string, string> = { COUNTRY: "Country", STATE: "State", REGION: "Region", CITY: "City", SUBURB: "Suburb", POSTCODE: "Postcode" };

function emptyValues(): ServiceFormValues {
  return { name: "", slug: "", parentId: null, shortDescription: "", description: "", icon: "", isEnabled: true, isFeatured: false, status: "PUBLISHED", pricingMethod: "QUOTE", priceMin: "", priceMax: "", priceUnit: "", ctaLabel: "", ctaHref: "/quote", featuredMediaId: null, videoMediaId: null, gallery: [], faqs: [], areaIds: [], materialIds: [], seo: {} };
}

function toValues(s: ServiceDetail): ServiceFormValues {
  return {
    name: s.name,
    slug: s.slug,
    parentId: s.parentId,
    shortDescription: s.shortDescription ?? "",
    description: s.description ?? "",
    icon: s.icon ?? "",
    isEnabled: s.isEnabled,
    isFeatured: s.isFeatured,
    status: s.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
    pricingMethod: s.pricingMethod,
    priceMin: s.priceMinCents != null ? (s.priceMinCents / 100).toFixed(2) : "",
    priceMax: s.priceMaxCents != null ? (s.priceMaxCents / 100).toFixed(2) : "",
    priceUnit: s.priceUnit ?? "",
    ctaLabel: s.ctaLabel ?? "",
    ctaHref: s.ctaHref ?? "/quote",
    featuredMediaId: s.featuredMediaId,
    videoMediaId: s.videoMediaId,
    gallery: serviceGallery(s),
    faqs: serviceFaqs(s),
    areaIds: s.areas.map((a) => a.serviceAreaId),
    materialIds: s.materials.map((m) => m.materialId),
    seo: serviceSeo(s),
  };
}

/** Everything the service editor needs, resolved server-side (media previews, options, custom fields). */
export async function buildServiceEditorProps(ctx: BusinessContext, service: ServiceDetail | null): Promise<ServiceEditorProps> {
  const businessId = ctx.businessId;
  const values = service ? toValues(service) : emptyValues();
  const [parents, areas, materials, fieldDefs, fieldValues, ai] = await Promise.all([
    listParentOptions(ctx.db, businessId, service?.id),
    listServiceAreaOptions(ctx.db, businessId),
    listMaterialOptions(ctx.db, businessId),
    listFieldDefinitions(ctx.db, businessId, "SERVICE"),
    service ? loadFieldValues(ctx.db, service.id) : Promise.resolve({}),
    getAIAvailability(businessId),
  ]);
  const wanted = [values.featuredMediaId, values.videoMediaId, values.seo.socialImageId ?? null, ...values.gallery].filter((x): x is string => !!x);
  const media = wanted.length ? await ctx.db.media.findMany({ where: { businessId, id: { in: wanted } } }) : [];
  const picked = new Map<string, PickedMedia>();
  for (const m of media) {
    const u = await mediaUrls(m);
    picked.set(m.id, { id: m.id, url: u.url, thumb: u.thumb, medium: u.medium, alt: u.alt, kind: m.kind, title: m.title, originalName: m.originalName });
  }
  const gallery: GalleryItem[] = values.gallery.map((id) => picked.get(id)).filter((x): x is PickedMedia => !!x).map((m) => ({ id: m.id, thumb: m.thumb, alt: m.alt, kind: m.kind, title: m.title }));

  // Areas indented by hierarchy.
  const areaIds = new Set(areas.map((a) => a.id));
  const byParent = new Map<string | null, typeof areas>();
  for (const a of areas) {
    const key = a.parentId && areaIds.has(a.parentId) ? a.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), a]);
  }
  const areaItems: ServiceEditorProps["areas"] = [];
  const walk = (parentId: string | null, depth: number, seen: Set<string>) => {
    for (const a of byParent.get(parentId) ?? []) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      areaItems.push({ id: a.id, label: a.name, hint: `${AREA_TYPE_LABEL[a.type] ?? a.type}${a.isEnabled ? "" : " · disabled"}`, depth });
      walk(a.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());

  return {
    businessId,
    serviceId: service?.id ?? null,
    values,
    archived: !!service?.deletedAt,
    parents,
    areas: areaItems,
    materials,
    relatedProjects: service ? service.projects.filter((p) => !p.project.deletedAt).map((p) => ({ id: p.project.id, title: p.project.title, slug: p.project.slug, status: p.project.status })) : [],
    fieldDefs,
    fieldValues,
    previews: {
      featured: values.featuredMediaId ? picked.get(values.featuredMediaId) ?? null : null,
      video: values.videoMediaId ? picked.get(values.videoMediaId) ?? null : null,
      social: values.seo.socialImageId ? picked.get(values.seo.socialImageId) ?? null : null,
      gallery,
    },
    aiAvailable: ai.available,
    currency: ctx.business.currency,
    siteSlug: ctx.business.slug,
    references: { projects: service?.projects.length ?? 0, children: service?._count.children ?? 0, leads: service?._count.leads ?? 0, bookings: service?._count.bookings ?? 0 },
  };
}
