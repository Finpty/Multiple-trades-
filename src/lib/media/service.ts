import path from "node:path";
import sharp from "sharp";
import type { Media, MediaKind, MediaVisibility } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { recordAudit } from "@/lib/audit";
import { toJson } from "@/lib/json";
import { buildObjectKey, getStorage, resolveMediaUrl } from "@/lib/storage";
import { getPlatformSetting } from "@/lib/platform/settings";
import { env } from "@/lib/env";

export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaError";
  }
}

const VARIANTS: Array<{ name: string; width: number }> = [
  { name: "thumb", width: 320 },
  { name: "medium", width: 960 },
  { name: "large", width: 1920 },
];

export function kindFromMime(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime === "application/pdf" || mime.startsWith("application/")) return "DOCUMENT";
  return "OTHER";
}

export async function assertAllowedUpload(mime: string, sizeBytes: number): Promise<void> {
  const [maxMb, images, videos, docs] = await Promise.all([
    getPlatformSetting<number>("media.maxUploadMb", 50),
    getPlatformSetting<string[]>("media.allowedImageTypes", []),
    getPlatformSetting<string[]>("media.allowedVideoTypes", []),
    getPlatformSetting<string[]>("media.allowedDocumentTypes", []),
  ]);
  if (sizeBytes > maxMb * 1024 * 1024) throw new MediaError(`File exceeds the ${maxMb} MB limit.`);
  const allowed = new Set([...images, ...videos, ...docs]);
  if (!allowed.has(mime)) throw new MediaError(`File type ${mime} is not allowed.`);
}

export interface UploadMediaInput {
  businessId: string;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folderId?: string | null;
  visibility?: MediaVisibility;
  altText?: string | null;
  caption?: string | null;
  title?: string | null;
  tags?: string[];
  uploadedByUserId?: string | null;
  /** e.g. "projects", "logos", "documents" — only affects the object key prefix */
  folderKey?: string;
}

/**
 * Stores a file in object storage, generates image renditions and records
 * metadata. Bytes never touch the database.
 */
export async function uploadMedia(input: UploadMediaInput): Promise<Media> {
  await assertAllowedUpload(input.mimeType, input.buffer.length);
  const storage = await getStorage();
  const kind = kindFromMime(input.mimeType);
  const visibility = input.visibility ?? "PUBLIC";
  const key = buildObjectKey(input.businessId, input.originalName, input.folderKey ?? "uploads");
  let width: number | null = null;
  let height: number | null = null;
  const variants: Record<string, { key: string; width: number; height: number }> = {};

  let body = input.buffer;
  if (kind === "IMAGE" && input.mimeType !== "image/svg+xml" && input.mimeType !== "image/gif") {
    const image = sharp(input.buffer, { failOn: "none" }).rotate();
    const meta = await image.metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
    // Normalise + compress the original (strip metadata, cap at 4000px).
    body = await image.clone().resize({ width: 4000, height: 4000, fit: "inside", withoutEnlargement: true }).toBuffer();
    for (const v of VARIANTS) {
      if (width && width <= v.width && v.name !== "thumb") continue;
      const vkey = key.replace(/(\.[a-z0-9]+)?$/, `-${v.name}.webp`);
      const out = await image.clone().resize({ width: v.width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      await storage.put({ key: vkey, body: out.data, contentType: "image/webp", visibility });
      variants[v.name] = { key: vkey, width: out.info.width, height: out.info.height };
    }
  }
  await storage.put({ key, body, contentType: input.mimeType, visibility });

  const db = tenantDb(input.businessId);
  const media = await db.media.create({
    data: {
      businessId: input.businessId,
      folderId: input.folderId ?? null,
      kind,
      visibility,
      storageDriver: storage.name,
      storageKey: key,
      filename: path.basename(key),
      originalName: input.originalName.slice(0, 255),
      mimeType: input.mimeType,
      sizeBytes: BigInt(body.length),
      width,
      height,
      title: input.title ?? input.originalName.replace(/\.[^.]+$/, ""),
      altText: input.altText ?? null,
      caption: input.caption ?? null,
      tags: toJson(input.tags ?? []),
      variants: toJson(variants),
      uploadedByUserId: input.uploadedByUserId ?? null,
    },
  });
  await recordAudit({ actorUserId: input.uploadedByUserId ?? null, businessId: input.businessId, action: "media.uploaded", entityType: "media", entityId: media.id, metadata: { kind, mimeType: input.mimeType, bytes: body.length } });
  await emitEvent({ type: "media.uploaded", businessId: input.businessId, payload: { businessId: input.businessId, mediaId: media.id, kind }, actorUserId: input.uploadedByUserId ?? null });
  return media;
}

/** Replace the bytes of an existing media record (keeps the id so references stay valid). */
export async function replaceMediaFile(businessId: string, mediaId: string, buffer: Buffer, mimeType: string, originalName: string, actorUserId: string | null): Promise<Media> {
  const db = tenantDb(businessId);
  const existing = await db.media.findUniqueOrThrow({ where: { id: mediaId } });
  const fresh = await uploadMedia({ businessId, buffer, mimeType, originalName, folderId: existing.folderId, visibility: existing.visibility, uploadedByUserId: actorUserId, altText: existing.altText, caption: existing.caption, title: existing.title });
  // Move the new object's data onto the old record, then delete the temporary record and old objects.
  const updated = await db.media.update({
    where: { id: mediaId },
    data: { storageDriver: fresh.storageDriver, storageKey: fresh.storageKey, filename: fresh.filename, originalName: fresh.originalName, mimeType: fresh.mimeType, sizeBytes: fresh.sizeBytes, width: fresh.width, height: fresh.height, variants: fresh.variants as object, kind: fresh.kind },
  });
  await db.media.delete({ where: { id: fresh.id } });
  await deleteObjects(existing);
  return updated;
}

/** Applies an edit (crop/rotate) producing new bytes for the same record. */
export async function transformMedia(businessId: string, mediaId: string, ops: { rotate?: number; crop?: { left: number; top: number; width: number; height: number }; flip?: boolean; flop?: boolean }, actorUserId: string | null): Promise<Media> {
  const db = tenantDb(businessId);
  const media = await db.media.findUniqueOrThrow({ where: { id: mediaId } });
  if (media.kind !== "IMAGE") throw new MediaError("Only images can be edited.");
  const storage = await getStorage(media.storageDriver);
  const object = await storage.get(media.storageKey);
  if (!object) throw new MediaError("Original file is missing from storage.");
  const buffer = Buffer.concat(await object.body.toArray());
  let image = sharp(buffer);
  if (ops.crop) image = image.extract({ left: Math.max(0, Math.round(ops.crop.left)), top: Math.max(0, Math.round(ops.crop.top)), width: Math.max(1, Math.round(ops.crop.width)), height: Math.max(1, Math.round(ops.crop.height)) });
  if (ops.rotate) image = image.rotate(ops.rotate);
  if (ops.flip) image = image.flip();
  if (ops.flop) image = image.flop();
  const out = await image.toBuffer();
  return replaceMediaFile(businessId, mediaId, out, media.mimeType, media.originalName, actorUserId);
}

async function deleteObjects(media: Pick<Media, "storageDriver" | "storageKey" | "variants">) {
  const storage = await getStorage(media.storageDriver);
  await storage.delete(media.storageKey).catch(() => undefined);
  for (const v of Object.values((media.variants ?? {}) as Record<string, { key: string }>)) await storage.delete(v.key).catch(() => undefined);
}

/** Soft delete; objects are removed by a later purge so restores remain possible. */
export async function deleteMedia(businessId: string, mediaId: string, actorUserId: string | null): Promise<void> {
  const db = tenantDb(businessId);
  await db.media.update({ where: { id: mediaId }, data: { deletedAt: new Date() } });
  await recordAudit({ actorUserId, businessId, action: "media.deleted", entityType: "media", entityId: mediaId });
}

export async function purgeDeletedMedia(businessId: string, olderThanDays = 30): Promise<number> {
  const db = tenantDb(businessId);
  const rows = await db.media.findMany({ where: { deletedAt: { lt: new Date(Date.now() - olderThanDays * 86_400_000) } } });
  for (const m of rows) {
    await deleteObjects(m);
    await db.media.delete({ where: { id: m.id } });
  }
  return rows.length;
}

export interface MediaUrlSet {
  id: string;
  url: string;
  thumb: string;
  medium: string;
  large: string;
  alt: string;
  width: number | null;
  height: number | null;
  kind: MediaKind;
  mimeType: string;
}

/** URLs for a media row (variants fall back to the original). Safe for public rendering. */
export async function mediaUrls(media: Pick<Media, "id" | "storageDriver" | "storageKey" | "visibility" | "variants" | "altText" | "title" | "width" | "height" | "kind" | "mimeType">): Promise<MediaUrlSet> {
  const original = await resolveMediaUrl(media);
  const variants = (media.variants ?? {}) as Record<string, { key: string }>;
  const v = async (name: string) => (variants[name] ? resolveMediaUrl({ storageDriver: media.storageDriver, storageKey: variants[name].key, visibility: media.visibility }) : original);
  return { id: media.id, url: original, thumb: await v("thumb"), medium: await v("medium"), large: await v("large"), alt: media.altText ?? media.title ?? "", width: media.width, height: media.height, kind: media.kind, mimeType: media.mimeType };
}

/** Batch resolve for lists (e.g. block renderers). */
export async function mediaUrlMap(rows: Parameters<typeof mediaUrls>[0][]): Promise<Record<string, MediaUrlSet>> {
  const out: Record<string, MediaUrlSet> = {};
  for (const r of rows) out[r.id] = await mediaUrls(r);
  return out;
}

export function maxUploadBytesSync(): number {
  return 50 * 1024 * 1024;
}

export const MEDIA_STORAGE_INFO = { driver: env().MEDIA_STORAGE_DRIVER };
