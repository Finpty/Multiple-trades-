import type { ServiceAreaType } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import type { SiteContext } from "@/lib/tenant/resolve";

export interface SiteServiceArea {
  id: string;
  name: string;
  slug: string;
  type: ServiceAreaType;
  state: string | null;
  postcode: string | null;
  parentId: string | null;
  parentName: string | null;
  /** null when no public page is generated for the area. */
  href: string | null;
  lat: number | null;
  lng: number | null;
  isPrimary: boolean;
}

export async function loadServiceAreasForBlock(ctx: SiteContext, opts: { limit?: number } = {}): Promise<SiteServiceArea[]> {
  const db = tenantDb(ctx.business.id);
  const limit = Math.max(1, Math.min(500, opts.limit ?? 60));
  const rows = await db.serviceArea.findMany({
    where: { businessId: ctx.business.id, isEnabled: true },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    take: limit,
    include: { parent: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    type: r.type,
    state: r.state,
    postcode: r.postcode,
    parentId: r.parentId,
    parentName: r.parent?.name ?? null,
    href: r.generatePage ? `/areas/${r.slug}` : null,
    lat: r.lat === null ? null : Number(r.lat),
    lng: r.lng === null ? null : Number(r.lng),
    isPrimary: r.isPrimary,
  }));
}

export interface AreaGroup {
  label: string;
  areas: SiteServiceArea[];
}

/** Groups by state, then by parent area (city/region) when the list is long. */
export function groupServiceAreas(areas: SiteServiceArea[]): AreaGroup[] {
  const groups = new Map<string, SiteServiceArea[]>();
  for (const a of areas) {
    const key = a.parentName ?? a.state ?? "Other areas";
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.entries()].map(([label, list]) => ({ label, areas: list }));
}
