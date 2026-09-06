import type { Media } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import { mediaUrls, type MediaUrlSet } from "@/lib/media/service";
import type { SiteContext } from "@/lib/tenant/resolve";

/** Shape of a MediaRef prop (see src/lib/blocks/schema.ts). */
export interface MediaRefLike {
  mediaId?: string | null;
  url?: string | null;
  alt?: string;
}

/** Resolved image ready for <SmartImage>. `alt` from the ref wins over the row's alt text. */
export type ResolvedMedia = MediaUrlSet;

const MEDIA_SELECT = { id: true, storageDriver: true, storageKey: true, visibility: true, variants: true, altText: true, title: true, width: true, height: true, kind: true, mimeType: true } as const;

type MediaRow = Pick<Media, keyof typeof MEDIA_SELECT>;

/** Loads media rows by id (tenant-scoped, non-deleted). Preserves the order of `ids`. */
export async function loadMediaRows(ctx: SiteContext, ids: string[]): Promise<Map<string, MediaRow>> {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  if (unique.length === 0) return new Map();
  const db = tenantDb(ctx.business.id);
  const rows = await db.media.findMany({ where: { businessId: ctx.business.id, id: { in: unique } }, select: MEDIA_SELECT });
  return new Map(rows.map((r) => [r.id, r]));
}

/** Resolves many media ids to URL sets (order preserved, missing ids skipped). */
export async function resolveMediaIds(ctx: SiteContext, ids: string[]): Promise<ResolvedMedia[]> {
  const rows = await loadMediaRows(ctx, ids);
  const out: ResolvedMedia[] = [];
  for (const id of ids) {
    const row = rows.get(id);
    if (row) out.push(await mediaUrls(row));
  }
  return out;
}

/** Resolves a map id → URL set for card lists. */
export async function resolveMediaMap(ctx: SiteContext, ids: Array<string | null | undefined>): Promise<Map<string, ResolvedMedia>> {
  const clean = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  const rows = await loadMediaRows(ctx, clean);
  const out = new Map<string, ResolvedMedia>();
  for (const [id, row] of rows) out.set(id, await mediaUrls(row));
  return out;
}

function externalRef(ref: MediaRefLike): ResolvedMedia | null {
  const url = ref.url?.trim();
  if (!url || !/^(https?:)?\/\//i.test(url) && !url.startsWith("/")) return null;
  return { id: "", url, thumb: url, medium: url, large: url, alt: ref.alt ?? "", width: null, height: null, kind: "IMAGE", mimeType: "" };
}

/** Resolves a single MediaRef prop: uploaded media by id, otherwise an explicit URL. */
export async function resolveMediaRef(ctx: SiteContext, ref: MediaRefLike | null | undefined): Promise<ResolvedMedia | null> {
  if (!ref) return null;
  if (ref.mediaId) {
    const [hit] = await resolveMediaIds(ctx, [ref.mediaId]);
    if (hit) return ref.alt ? { ...hit, alt: ref.alt } : hit;
  }
  return externalRef(ref);
}

/** Resolves a list of MediaRef props in order, skipping unresolvable entries. */
export async function resolveMediaRefs(ctx: SiteContext, refs: MediaRefLike[]): Promise<ResolvedMedia[]> {
  const rows = await loadMediaRows(ctx, refs.map((r) => r.mediaId ?? "").filter(Boolean));
  const out: ResolvedMedia[] = [];
  for (const ref of refs) {
    const row = ref.mediaId ? rows.get(ref.mediaId) : undefined;
    if (row) {
      const set = await mediaUrls(row);
      out.push(ref.alt ? { ...set, alt: ref.alt } : set);
      continue;
    }
    const ext = externalRef(ref);
    if (ext) out.push(ext);
  }
  return out;
}
