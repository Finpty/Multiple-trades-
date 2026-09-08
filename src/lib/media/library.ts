import type { Media, MediaFolder, MediaKind, MediaVisibility, Prisma } from "@prisma/client";
import { z } from "zod";
import type { DbClient } from "@/lib/db";
import { asArray, toJson } from "@/lib/json";
import { slugify } from "@/lib/slug";
import { getStorage } from "@/lib/storage";
import { mediaUrls, purgeMediaByIds, type MediaUrlSet } from "./service";

/**
 * Media library helpers (folders, listing, bulk edits, usage lookup, storage
 * summary). Every function takes the RLS-scoped client plus the businessId and
 * only ever touches rows of that business. Soft-deleted media is excluded by
 * the db extension unless `deletedAt` is named explicitly in `where`.
 */

export const MEDIA_KINDS: MediaKind[] = ["IMAGE", "VIDEO", "DOCUMENT", "OTHER"];
export const MEDIA_SORTS = ["newest", "oldest", "name", "size"] as const;
export type MediaSort = (typeof MEDIA_SORTS)[number];

export class MediaLibraryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaLibraryError";
  }
}

// ── Listing ──────────────────────────────────────────────────────────────────

export interface MediaListQuery {
  /** undefined = every folder, null = unfiled (root), string = that folder */
  folderId?: string | null;
  kind?: MediaKind | null;
  q?: string;
  tag?: string | null;
  sort?: MediaSort;
  trashed?: boolean;
  page?: number;
  pageSize?: number;
}

export interface MediaListItem extends MediaUrlSet {
  title: string | null;
  originalName: string;
  filename: string;
  caption: string | null;
  tags: string[];
  folderId: string | null;
  visibility: MediaVisibility;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export function mediaTags(m: Pick<Media, "tags">): string[] {
  return [...new Set(asArray<unknown>(m.tags).filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim()))];
}

export async function toMediaListItem(m: Media): Promise<MediaListItem> {
  return {
    ...(await mediaUrls(m)),
    title: m.title,
    originalName: m.originalName,
    filename: m.filename,
    caption: m.caption,
    tags: mediaTags(m),
    folderId: m.folderId,
    visibility: m.visibility,
    sizeBytes: Number(m.sizeBytes),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
  };
}

export function mediaWhere(businessId: string, q: MediaListQuery): Prisma.MediaWhereInput {
  const where: Prisma.MediaWhereInput = { businessId, deletedAt: q.trashed ? { not: null } : null };
  if (q.folderId !== undefined) where.folderId = q.folderId;
  if (q.kind && MEDIA_KINDS.includes(q.kind)) where.kind = q.kind;
  const term = q.q?.trim();
  if (term) where.OR = [{ title: { contains: term, mode: "insensitive" } }, { originalName: { contains: term, mode: "insensitive" } }, { altText: { contains: term, mode: "insensitive" } }, { caption: { contains: term, mode: "insensitive" } }];
  if (q.tag) where.tags = { array_contains: [q.tag] };
  return where;
}

export function mediaOrderBy(sort: MediaSort | undefined): Prisma.MediaOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }];
    case "name":
      return [{ title: "asc" }, { originalName: "asc" }];
    case "size":
      return [{ sizeBytes: "desc" }];
    default:
      return [{ createdAt: "desc" }];
  }
}

export async function listLibraryMedia(db: DbClient, businessId: string, q: MediaListQuery): Promise<{ items: MediaListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, q.pageSize ?? 60));
  const where = mediaWhere(businessId, q);
  const [rows, total] = await Promise.all([db.media.findMany({ where, orderBy: mediaOrderBy(q.sort), skip: (page - 1) * pageSize, take: pageSize }), db.media.count({ where })]);
  return { items: await Promise.all(rows.map(toMediaListItem)), total, page, pageSize };
}

/** Distinct tags across the (non-trashed) library with counts. */
export async function listMediaTags(db: DbClient, businessId: string): Promise<Array<{ tag: string; count: number }>> {
  const rows = await db.media.findMany({ where: { businessId, deletedAt: null, NOT: { tags: { equals: [] } } }, select: { tags: true } });
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of mediaTags(r)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}

export interface StorageSummary {
  files: number;
  bytes: number;
  byKind: Array<{ kind: MediaKind; files: number; bytes: number }>;
  trashed: { files: number; bytes: number };
}

export async function storageSummary(db: DbClient, businessId: string): Promise<StorageSummary> {
  const [live, trash] = await Promise.all([
    db.media.groupBy({ by: ["kind"], where: { businessId, deletedAt: null }, _count: { _all: true }, _sum: { sizeBytes: true } }),
    db.media.aggregate({ where: { businessId, deletedAt: { not: null } }, _count: { _all: true }, _sum: { sizeBytes: true } }),
  ]);
  const byKind = MEDIA_KINDS.map((kind) => {
    const g = live.find((x) => x.kind === kind);
    return { kind, files: g?._count._all ?? 0, bytes: Number(g?._sum.sizeBytes ?? 0) };
  });
  return {
    files: byKind.reduce((s, k) => s + k.files, 0),
    bytes: byKind.reduce((s, k) => s + k.bytes, 0),
    byKind,
    trashed: { files: trash._count._all, bytes: Number(trash._sum.sizeBytes ?? 0) },
  };
}

// ── Folders ──────────────────────────────────────────────────────────────────

export interface FolderRow {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  mediaCount: number;
}

export interface FolderNode extends FolderRow {
  depth: number;
  children: FolderNode[];
}

export async function listFolders(db: DbClient, businessId: string): Promise<FolderRow[]> {
  const rows = await db.mediaFolder.findMany({ where: { businessId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { media: { where: { deletedAt: null } } } } } });
  return rows.map((r) => ({ id: r.id, parentId: r.parentId, name: r.name, slug: r.slug, sortOrder: r.sortOrder, mediaCount: r._count.media }));
}

export function buildFolderTree(rows: FolderRow[]): FolderNode[] {
  const ids = new Set(rows.map((r) => r.id));
  const byParent = new Map<string | null, FolderRow[]>();
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), r]);
  }
  const build = (parentId: string | null, depth: number, seen: Set<string>): FolderNode[] =>
    (byParent.get(parentId) ?? [])
      .filter((r) => !seen.has(r.id))
      .map((r) => {
        seen.add(r.id);
        return { ...r, depth, children: build(r.id, depth + 1, seen) };
      });
  return build(null, 0, new Set());
}

export const FolderNameSchema = z.string().trim().min(1, "Folder name is required").max(80);

async function uniqueFolderSlug(db: DbClient, businessId: string, parentId: string | null, name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || "folder";
  let candidate = base;
  let i = 2;
  while (await db.mediaFolder.findFirst({ where: { businessId, parentId, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })) candidate = `${base}-${i++}`;
  return candidate;
}

async function assertFolderParent(db: DbClient, businessId: string, parentId: string | null, selfId?: string): Promise<void> {
  if (!parentId) return;
  if (selfId && parentId === selfId) throw new MediaLibraryError("A folder cannot be moved into itself.");
  const rows = await db.mediaFolder.findMany({ where: { businessId }, select: { id: true, parentId: true } });
  if (!rows.some((r) => r.id === parentId)) throw new MediaLibraryError("Parent folder not found.");
  if (selfId) {
    // Walk up from the new parent; hitting self would create a cycle.
    const parentOf = new Map(rows.map((r) => [r.id, r.parentId] as const));
    let p: string | null | undefined = parentId;
    const seen = new Set<string>();
    while (p) {
      if (p === selfId) throw new MediaLibraryError("A folder cannot be moved inside one of its own sub-folders.");
      if (seen.has(p)) break;
      seen.add(p);
      p = parentOf.get(p) ?? null;
    }
  }
}

export async function createFolder(db: DbClient, businessId: string, name: string, parentId: string | null): Promise<MediaFolder> {
  const clean = FolderNameSchema.parse(name);
  await assertFolderParent(db, businessId, parentId);
  const last = await db.mediaFolder.findFirst({ where: { businessId, parentId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return db.mediaFolder.create({ data: { businessId, parentId, name: clean, slug: await uniqueFolderSlug(db, businessId, parentId, clean), sortOrder: (last?.sortOrder ?? -1) + 1 } });
}

export async function renameFolder(db: DbClient, businessId: string, id: string, name: string): Promise<{ before: MediaFolder; after: MediaFolder }> {
  const before = await db.mediaFolder.findFirst({ where: { id, businessId } });
  if (!before) throw new MediaLibraryError("Folder not found.");
  const clean = FolderNameSchema.parse(name);
  const after = await db.mediaFolder.update({ where: { id }, data: { name: clean, slug: await uniqueFolderSlug(db, businessId, before.parentId, clean, id) } });
  return { before, after };
}

export async function moveFolder(db: DbClient, businessId: string, id: string, parentId: string | null): Promise<{ before: MediaFolder; after: MediaFolder }> {
  const before = await db.mediaFolder.findFirst({ where: { id, businessId } });
  if (!before) throw new MediaLibraryError("Folder not found.");
  await assertFolderParent(db, businessId, parentId, id);
  const after = await db.mediaFolder.update({ where: { id }, data: { parentId, slug: await uniqueFolderSlug(db, businessId, parentId, before.name, id) } });
  return { before, after };
}

/**
 * Deletes a folder. With `moveContents`, its media and sub-folders move to the
 * parent; otherwise the folder must be empty.
 */
export async function deleteFolder(db: DbClient, businessId: string, id: string, moveContents: boolean): Promise<MediaFolder> {
  const folder = await db.mediaFolder.findFirst({ where: { id, businessId }, include: { _count: { select: { media: true, children: true } } } });
  if (!folder) throw new MediaLibraryError("Folder not found.");
  if (folder._count.media || folder._count.children) {
    if (!moveContents) throw new MediaLibraryError(`“${folder.name}” still contains ${folder._count.media} file(s) and ${folder._count.children} sub-folder(s). Move its contents to the parent folder or empty it first.`);
    await db.media.updateMany({ where: { businessId, folderId: id }, data: { folderId: folder.parentId } });
    const siblings = await db.mediaFolder.findMany({ where: { businessId, parentId: folder.parentId, id: { not: id } }, select: { slug: true } });
    const taken = new Set(siblings.map((s) => s.slug));
    for (const child of await db.mediaFolder.findMany({ where: { businessId, parentId: id } })) {
      let slug = child.slug;
      let i = 2;
      while (taken.has(slug)) slug = `${child.slug}-${i++}`;
      taken.add(slug);
      await db.mediaFolder.update({ where: { id: child.id }, data: { parentId: folder.parentId, slug } });
    }
  }
  return db.mediaFolder.delete({ where: { id } });
}

// ── Single-item metadata ─────────────────────────────────────────────────────

const tagList = z.preprocess(
  (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []),
  z.array(z.string().trim().min(1).max(40)).max(50).transform((tags) => [...new Set(tags.map((t) => t.trim()).filter(Boolean))]),
);

export const MediaPatchSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  altText: z.string().trim().max(500).nullable().optional(),
  caption: z.string().trim().max(1000).nullable().optional(),
  tags: tagList.optional(),
  folderId: z.string().uuid().nullable().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
});
export type MediaPatch = z.infer<typeof MediaPatchSchema>;

export async function getLibraryMedia(db: DbClient, businessId: string, id: string): Promise<Media | null> {
  return db.media.findFirst({ where: { id, businessId, deletedAt: undefined } });
}

/** Re-puts the objects with a new visibility for drivers that store ACLs on the object (no-op for local disk). */
async function applyObjectVisibility(media: Media, visibility: MediaVisibility): Promise<void> {
  const storage = await getStorage(media.storageDriver);
  if (storage.name === "local") return;
  const keys = [{ key: media.storageKey, contentType: media.mimeType }, ...Object.values((media.variants ?? {}) as Record<string, { key: string }>).map((v) => ({ key: v.key, contentType: "image/webp" }))];
  for (const k of keys) {
    const obj = await storage.get(k.key);
    if (!obj) continue;
    await storage.put({ key: k.key, body: obj.body, contentType: obj.contentType ?? k.contentType, visibility });
  }
}

export async function updateMediaMetadata(db: DbClient, businessId: string, id: string, patch: MediaPatch): Promise<{ before: Media; after: Media }> {
  const before = await db.media.findFirst({ where: { id, businessId, deletedAt: undefined } });
  if (!before) throw new MediaLibraryError("File not found.");
  if (patch.folderId) {
    const folder = await db.mediaFolder.findFirst({ where: { id: patch.folderId, businessId }, select: { id: true } });
    if (!folder) throw new MediaLibraryError("Folder not found.");
  }
  const data: Prisma.MediaUncheckedUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title || null;
  if (patch.altText !== undefined) data.altText = patch.altText || null;
  if (patch.caption !== undefined) data.caption = patch.caption || null;
  if (patch.tags !== undefined) data.tags = toJson(patch.tags);
  if (patch.folderId !== undefined) data.folderId = patch.folderId;
  if (patch.visibility !== undefined) data.visibility = patch.visibility;
  const after = await db.media.update({ where: { id }, data });
  if (patch.visibility && patch.visibility !== before.visibility) await applyObjectVisibility(after, patch.visibility);
  return { before, after };
}

// ── Bulk operations ──────────────────────────────────────────────────────────

export const BulkMediaOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("move"), folderId: z.string().uuid().nullable() }),
  z.object({ op: z.literal("addTag"), tag: z.string().trim().min(1).max(40) }),
  z.object({ op: z.literal("removeTag"), tag: z.string().trim().min(1).max(40) }),
  z.object({ op: z.literal("visibility"), visibility: z.enum(["PUBLIC", "PRIVATE"]) }),
  z.object({ op: z.literal("delete") }),
  z.object({ op: z.literal("restore") }),
  z.object({ op: z.literal("purge") }),
]);
export type BulkMediaOp = z.infer<typeof BulkMediaOpSchema>;

/** Applies one operation to many media rows of the business. Returns the number of rows affected. */
export async function bulkUpdateMedia(db: DbClient, businessId: string, ids: string[], op: BulkMediaOp): Promise<number> {
  if (!ids.length) return 0;
  const trashedOnly = op.op === "restore" || op.op === "purge";
  const rows = await db.media.findMany({ where: { businessId, id: { in: ids }, deletedAt: trashedOnly ? { not: null } : null } });
  if (!rows.length) return 0;
  const owned = rows.map((r) => r.id);
  switch (op.op) {
    case "move": {
      if (op.folderId) {
        const folder = await db.mediaFolder.findFirst({ where: { id: op.folderId, businessId }, select: { id: true } });
        if (!folder) throw new MediaLibraryError("Folder not found.");
      }
      await db.media.updateMany({ where: { businessId, id: { in: owned } }, data: { folderId: op.folderId } });
      return owned.length;
    }
    case "addTag":
    case "removeTag": {
      for (const r of rows) {
        const tags = mediaTags(r);
        const next = op.op === "addTag" ? [...new Set([...tags, op.tag])] : tags.filter((t) => t !== op.tag);
        if (next.length !== tags.length || op.op === "addTag") await db.media.update({ where: { id: r.id }, data: { tags: toJson(next) } });
      }
      return owned.length;
    }
    case "visibility": {
      await db.media.updateMany({ where: { businessId, id: { in: owned } }, data: { visibility: op.visibility } });
      for (const r of rows) if (r.visibility !== op.visibility) await applyObjectVisibility(r, op.visibility);
      return owned.length;
    }
    case "delete": {
      await db.media.updateMany({ where: { businessId, id: { in: owned } }, data: { deletedAt: new Date() } });
      return owned.length;
    }
    case "restore": {
      await db.media.updateMany({ where: { businessId, id: { in: owned } }, data: { deletedAt: null } });
      return owned.length;
    }
    case "purge": {
      return purgeMediaByIds(businessId, owned);
    }
  }
}

/** Permanently removes every trashed file of the business. */
export async function emptyTrash(db: DbClient, businessId: string): Promise<number> {
  const rows = await db.media.findMany({ where: { businessId, deletedAt: { not: null } }, select: { id: true } });
  return purgeMediaByIds(businessId, rows.map((r) => r.id));
}

// ── Usage lookup ─────────────────────────────────────────────────────────────

export interface MediaUsage {
  type: "service" | "project" | "team" | "material" | "theme" | "business" | "page";
  id: string;
  label: string;
  field: string;
  href: string | null;
}

function jsonMentions(value: unknown, id: string): boolean {
  if (value == null) return false;
  try {
    return JSON.stringify(value).includes(id);
  } catch {
    return false;
  }
}

/**
 * Finds every place a media id is referenced: direct foreign keys plus jsonb
 * columns (galleries, SEO social images, theme tokens, page section props).
 * JSON columns are scanned in-process because tenant queries cannot use raw SQL.
 */
export async function findMediaUsage(db: DbClient, businessId: string, mediaId: string): Promise<MediaUsage[]> {
  const admin = `/admin/${businessId}`;
  const [services, jsonServices, projects, projectMedia, team, materials, business, theme, sections] = await Promise.all([
    db.service.findMany({ where: { businessId, deletedAt: undefined, OR: [{ featuredMediaId: mediaId }, { videoMediaId: mediaId }] }, select: { id: true, name: true, featuredMediaId: true, videoMediaId: true } }),
    db.service.findMany({ where: { businessId, deletedAt: undefined }, select: { id: true, name: true, gallery: true, seo: true } }),
    db.project.findMany({ where: { businessId, deletedAt: undefined, OR: [{ featuredMediaId: mediaId }, { videoMediaId: mediaId }] }, select: { id: true, title: true, featuredMediaId: true, videoMediaId: true } }),
    db.projectMedia.findMany({ where: { businessId, mediaId }, select: { projectId: true, stage: true, project: { select: { title: true } } } }),
    db.teamMember.findMany({ where: { businessId, deletedAt: undefined, mediaId }, select: { id: true, name: true } }),
    db.material.findMany({ where: { businessId, deletedAt: undefined, mediaId }, select: { id: true, name: true } }),
    db.business.findFirst({ where: { id: businessId }, select: { id: true, name: true, logoMediaId: true, settings: true, seoDefaults: true } }),
    db.businessTheme.findFirst({ where: { businessId }, select: { id: true, draft: true, published: true } }),
    db.pageSection.findMany({ where: { businessId }, select: { id: true, pageId: true, type: true, props: true, settings: true, page: { select: { title: true, slug: true } } } }),
  ]);
  const out: MediaUsage[] = [];
  for (const s of services) {
    if (s.featuredMediaId === mediaId) out.push({ type: "service", id: s.id, label: s.name, field: "Featured image", href: `${admin}/services/${s.id}` });
    if (s.videoMediaId === mediaId) out.push({ type: "service", id: s.id, label: s.name, field: "Video", href: `${admin}/services/${s.id}` });
  }
  for (const s of jsonServices) {
    if (asArray<unknown>(s.gallery).includes(mediaId)) out.push({ type: "service", id: s.id, label: s.name, field: "Gallery", href: `${admin}/services/${s.id}` });
    if (jsonMentions(s.seo, mediaId)) out.push({ type: "service", id: s.id, label: s.name, field: "SEO social image", href: `${admin}/services/${s.id}` });
  }
  for (const p of projects) {
    if (p.featuredMediaId === mediaId) out.push({ type: "project", id: p.id, label: p.title, field: "Featured image", href: `${admin}/projects/${p.id}` });
    if (p.videoMediaId === mediaId) out.push({ type: "project", id: p.id, label: p.title, field: "Video", href: `${admin}/projects/${p.id}` });
  }
  for (const pm of projectMedia) out.push({ type: "project", id: pm.projectId, label: pm.project.title, field: `${pm.stage.toLowerCase()} photo`, href: `${admin}/projects/${pm.projectId}` });
  for (const t of team) out.push({ type: "team", id: t.id, label: t.name, field: "Photo", href: `${admin}/team/${t.id}` });
  for (const m of materials) out.push({ type: "material", id: m.id, label: m.name, field: "Image", href: `${admin}/materials/${m.id}` });
  if (business) {
    if (business.logoMediaId === mediaId) out.push({ type: "business", id: business.id, label: business.name, field: "Logo", href: `${admin}/settings` });
    if (jsonMentions(business.settings, mediaId) || jsonMentions(business.seoDefaults, mediaId)) out.push({ type: "business", id: business.id, label: business.name, field: "Business settings", href: `${admin}/settings` });
  }
  if (theme) {
    if (jsonMentions(theme.draft, mediaId)) out.push({ type: "theme", id: theme.id, label: "Website theme", field: "Draft design", href: `${admin}/design` });
    if (jsonMentions(theme.published, mediaId)) out.push({ type: "theme", id: theme.id, label: "Website theme", field: "Published design", href: `${admin}/design` });
  }
  for (const s of sections) {
    if (jsonMentions(s.props, mediaId) || jsonMentions(s.settings, mediaId)) out.push({ type: "page", id: s.pageId, label: `${s.page.title} (${s.type} section)`, field: "Page section", href: `${admin}/pages/${s.pageId}` });
  }
  return out;
}

export { formatBytes } from "./format";
