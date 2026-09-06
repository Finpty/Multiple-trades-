import type { Material, Prisma } from "@prisma/client";
import { z } from "zod";
import type { DbClient } from "@/lib/db";
import { asObject, toJson } from "@/lib/json";
import { mediaUrls } from "@/lib/media/service";
import { uniqueSlug } from "@/lib/slug";

/**
 * Materials catalogue helpers (tiles, stone, fixtures, pipe… whatever the
 * business sells or installs). Every function takes an RLS-scoped client plus
 * the businessId and only links to rows that belong to the same business.
 */

export type MaterialAttribute = { key: string; value: string };

export type MaterialListFilter = "active" | "inactive" | "archived" | "all";

export interface MaterialListRow {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  isActive: boolean;
  sortOrder: number;
  deletedAt: Date | null;
  updatedAt: Date;
  mediaId: string | null;
  thumb: string | null;
  services: Array<{ id: string; name: string }>;
}

export async function listMaterials(db: DbClient, businessId: string, opts: { filter?: MaterialListFilter; q?: string; category?: string } = {}): Promise<MaterialListRow[]> {
  const filter = opts.filter ?? "all";
  const where: Prisma.MaterialWhereInput = { businessId };
  if (filter === "archived") where.deletedAt = { not: null };
  else if (filter === "active") where.isActive = true;
  else if (filter === "inactive") where.isActive = false;
  if (opts.q) where.OR = [{ name: { contains: opts.q, mode: "insensitive" } }, { category: { contains: opts.q, mode: "insensitive" } }, { description: { contains: opts.q, mode: "insensitive" } }];
  if (opts.category) where.category = opts.category;
  const rows = await db.material.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { services: { include: { service: { select: { id: true, name: true, deletedAt: true } } } } },
  });
  const mediaIds = rows.map((r) => r.mediaId).filter((x): x is string => !!x);
  const media = mediaIds.length ? await db.media.findMany({ where: { businessId, id: { in: mediaIds } } }) : [];
  const thumbs = new Map<string, string>();
  for (const m of media) thumbs.set(m.id, (await mediaUrls(m)).thumb);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    category: r.category,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    deletedAt: r.deletedAt,
    updatedAt: r.updatedAt,
    mediaId: r.mediaId,
    thumb: r.mediaId ? thumbs.get(r.mediaId) ?? null : null,
    services: r.services.filter((s) => !s.service.deletedAt).map((s) => ({ id: s.service.id, name: s.service.name })),
  }));
}

export async function listMaterialCategories(db: DbClient, businessId: string): Promise<string[]> {
  const rows = await db.material.findMany({ where: { businessId, category: { not: null } }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } });
  return rows.map((r) => r.category).filter((c): c is string => !!c && c.trim() !== "");
}

/** Active, non-archived materials for checkbox lists (service editor). */
export async function listMaterialOptions(db: DbClient, businessId: string): Promise<Array<{ id: string; name: string; category: string | null }>> {
  return db.material.findMany({ where: { businessId }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, category: true } });
}

export async function getMaterial(db: DbClient, businessId: string, id: string) {
  return db.material.findFirst({ where: { id, businessId, deletedAt: undefined }, include: { services: { select: { serviceId: true } } } });
}

export type MaterialDetail = NonNullable<Awaited<ReturnType<typeof getMaterial>>>;

// ── Validation ───────────────────────────────────────────────────────────────

const optionalTrimmed = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max).optional().or(z.literal("")));
const boolish = z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean());
const idList = z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : typeof v === "string" && v ? [v] : []), z.array(z.string().uuid()).max(500));

export const MaterialAttributeSchema = z.object({ key: z.string().trim().min(1).max(60), value: z.string().trim().max(400) });

export const MaterialInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  slug: optionalTrimmed(120),
  category: optionalTrimmed(80),
  description: optionalTrimmed(5000),
  mediaId: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().uuid().nullable()),
  attributes: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(MaterialAttributeSchema).max(60)),
  isActive: boolish,
  serviceIds: idList,
});

export type MaterialInput = z.infer<typeof MaterialInputSchema>;

export class MaterialNotFoundError extends Error {
  constructor() {
    super("Material not found.");
    this.name = "MaterialNotFoundError";
  }
}

async function ensureUniqueMaterialSlug(db: DbClient, businessId: string, base: string, excludeId?: string): Promise<string> {
  return uniqueSlug(base, async (candidate) => {
    const hit = await db.material.findFirst({ where: { businessId, slug: candidate, deletedAt: undefined, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    return !!hit;
  });
}

async function ownedServiceIds(db: DbClient, businessId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db.service.findMany({ where: { businessId, id: { in: ids } }, select: { id: true } });
  return rows.map((r) => r.id);
}

async function ownedMediaId(db: DbClient, businessId: string, id: string | null): Promise<string | null> {
  if (!id) return null;
  const hit = await db.media.findFirst({ where: { businessId, id }, select: { id: true } });
  return hit ? hit.id : null;
}

function attributesToJson(attributes: MaterialAttribute[]): Prisma.InputJsonValue {
  const out: Record<string, string> = {};
  for (const a of attributes) if (a.key) out[a.key] = a.value;
  return toJson(out);
}

export function materialAttributes(material: Pick<Material, "attributes">): MaterialAttribute[] {
  return Object.entries(asObject<Record<string, unknown>>(material.attributes)).map(([key, value]) => ({ key, value: value == null ? "" : String(value) }));
}

export async function createMaterial(db: DbClient, businessId: string, input: MaterialInput): Promise<Material> {
  const slug = await ensureUniqueMaterialSlug(db, businessId, input.slug || input.name);
  const [mediaId, serviceIds, last] = await Promise.all([
    ownedMediaId(db, businessId, input.mediaId),
    ownedServiceIds(db, businessId, input.serviceIds),
    db.material.findFirst({ where: { businessId, deletedAt: undefined }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }),
  ]);
  const material = await db.material.create({
    data: {
      businessId,
      name: input.name,
      slug,
      category: input.category || null,
      description: input.description || null,
      mediaId,
      attributes: attributesToJson(input.attributes),
      isActive: input.isActive,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  await syncMaterialServices(db, material.id, serviceIds);
  return material;
}

export async function updateMaterial(db: DbClient, businessId: string, id: string, input: MaterialInput): Promise<{ before: Material; after: Material }> {
  const before = await db.material.findFirst({ where: { id, businessId } });
  if (!before) throw new MaterialNotFoundError();
  const slug = await ensureUniqueMaterialSlug(db, businessId, input.slug || input.name, id);
  const [mediaId, serviceIds] = await Promise.all([ownedMediaId(db, businessId, input.mediaId), ownedServiceIds(db, businessId, input.serviceIds)]);
  const after = await db.material.update({
    where: { id },
    data: {
      name: input.name,
      slug,
      category: input.category || null,
      description: input.description || null,
      mediaId,
      attributes: attributesToJson(input.attributes),
      isActive: input.isActive,
    },
  });
  await syncMaterialServices(db, id, serviceIds);
  return { before, after };
}

async function syncMaterialServices(db: DbClient, materialId: string, serviceIds: string[]): Promise<void> {
  await db.serviceMaterial.deleteMany({ where: { materialId, serviceId: { notIn: serviceIds } } });
  const existing = new Set((await db.serviceMaterial.findMany({ where: { materialId }, select: { serviceId: true } })).map((s) => s.serviceId));
  const fresh = serviceIds.filter((s) => !existing.has(s));
  if (fresh.length) await db.serviceMaterial.createMany({ data: fresh.map((serviceId) => ({ materialId, serviceId })), skipDuplicates: true });
}

export async function setMaterialActive(db: DbClient, businessId: string, id: string, value: boolean): Promise<{ before: Material; after: Material }> {
  const before = await db.material.findFirst({ where: { id, businessId } });
  if (!before) throw new MaterialNotFoundError();
  const after = await db.material.update({ where: { id }, data: { isActive: value } });
  return { before, after };
}

export async function archiveMaterial(db: DbClient, businessId: string, id: string): Promise<Material> {
  const row = await db.material.findFirst({ where: { id, businessId } });
  if (!row) throw new MaterialNotFoundError();
  return db.material.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
}

export async function restoreMaterial(db: DbClient, businessId: string, id: string): Promise<Material> {
  const row = await db.material.findFirst({ where: { id, businessId, deletedAt: { not: null } } });
  if (!row) throw new MaterialNotFoundError();
  return db.material.update({ where: { id }, data: { deletedAt: null } });
}

export const MaterialReorderSchema = z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0).max(100_000) })).max(2000);

export async function reorderMaterials(db: DbClient, businessId: string, items: z.infer<typeof MaterialReorderSchema>): Promise<number> {
  const owned = new Set((await db.material.findMany({ where: { businessId }, select: { id: true } })).map((r) => r.id));
  const valid = items.filter((it) => owned.has(it.id));
  for (const it of valid) await db.material.update({ where: { id: it.id }, data: { sortOrder: it.sortOrder } });
  return valid.length;
}
