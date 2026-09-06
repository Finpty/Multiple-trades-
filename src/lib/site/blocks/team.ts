import { tenantDb } from "@/lib/db";
import type { SiteContext } from "@/lib/tenant/resolve";
import { resolveMediaMap, type ResolvedMedia } from "./media";

export interface SiteTeamMember {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  photo: ResolvedMedia | null;
}

export async function loadTeamForBlock(ctx: SiteContext, opts: { source: "all" | "selected"; memberIds?: string[] }): Promise<SiteTeamMember[]> {
  const db = tenantDb(ctx.business.id);
  const ids = (opts.memberIds ?? []).filter(Boolean);
  if (opts.source === "selected" && ids.length === 0) return [];
  const rows = await db.teamMember.findMany({
    where: { businessId: ctx.business.id, isActive: true, ...(opts.source === "selected" ? { id: { in: ids } } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const ordered = opts.source === "selected" ? [...rows].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)) : rows;
  const photos = await resolveMediaMap(ctx, ordered.map((r) => r.mediaId));
  return ordered.map((r) => ({ id: r.id, name: r.name, role: r.role, bio: r.bio, photo: r.mediaId ? (photos.get(r.mediaId) ?? null) : null }));
}
