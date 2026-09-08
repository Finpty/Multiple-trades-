import type { BusinessContext } from "@/lib/authz";
import { listMaterialCategories, materialAttributes, type MaterialDetail } from "@/lib/content/materials";
import { listServiceOptions } from "@/lib/content/services";
import { mediaUrls } from "@/lib/media/service";
import type { PickedMedia } from "@/components/admin/media-picker";
import type { CheckboxTreeItem } from "@/components/admin/content/services/checkbox-tree";
import type { MaterialFormValues } from "@/components/admin/content/materials/material-form";

export async function buildMaterialFormProps(ctx: BusinessContext, material: MaterialDetail | null): Promise<{ values: MaterialFormValues; photo: PickedMedia | null; services: CheckboxTreeItem[]; categories: string[] }> {
  const businessId = ctx.business.id;
  const [services, categories, media] = await Promise.all([
    listServiceOptions(ctx.db, businessId),
    listMaterialCategories(ctx.db, businessId),
    material?.mediaId ? ctx.db.media.findFirst({ where: { id: material.mediaId, businessId } }) : null,
  ]);
  const photo = media ? await mediaUrls(media).then((u) => ({ id: u.id, url: u.url, thumb: u.thumb, alt: u.alt, kind: u.kind, title: media.title })) : null;
  const values: MaterialFormValues = material
    ? { name: material.name, slug: material.slug, category: material.category ?? "", description: material.description ?? "", mediaId: material.mediaId, attributes: materialAttributes(material), isActive: material.isActive, serviceIds: material.services.map((s) => s.serviceId) }
    : { name: "", slug: "", category: "", description: "", mediaId: null, attributes: [], isActive: true, serviceIds: [] };
  return { values, photo, services: services.map((s) => ({ id: s.id, label: s.name, depth: s.depth })), categories };
}
