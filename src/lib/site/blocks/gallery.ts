import { tenantDb } from "@/lib/db";
import { mediaUrls } from "@/lib/media/service";
import type { SiteContext } from "@/lib/tenant/resolve";
import type { ResolvedMedia } from "./media";

/** Public images carrying a tag (Media.tags jsonb array). */
export async function loadMediaByTag(ctx: SiteContext, tag: string | null | undefined, limit = 24): Promise<Array<ResolvedMedia & { caption: string }>> {
  const clean = (tag ?? "").trim();
  if (!clean) return [];
  const db = tenantDb(ctx.business.id);
  const rows = await db.media.findMany({
    where: { businessId: ctx.business.id, kind: "IMAGE", visibility: "PUBLIC", tags: { array_contains: [clean] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(200, limit)),
  });
  const out: Array<ResolvedMedia & { caption: string }> = [];
  for (const r of rows) out.push({ ...(await mediaUrls(r)), caption: r.caption ?? r.title ?? "" });
  return out;
}
