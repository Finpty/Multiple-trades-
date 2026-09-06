import { headers } from "next/headers";
import { getCurrentSession } from "@/lib/auth/session";
import { getBusinessAccess } from "@/lib/authz";
import { loadSiteContext, type SiteContext } from "@/lib/tenant/resolve";
import type { TenantMode } from "@/lib/tenant/routing";
import { prisma } from "@/lib/db";
import { EDITOR_PARAM, PREVIEW_PARAM } from "@/lib/editor/protocol";

/**
 * Resolves the SiteContext for a /s/[site] request. Preview/editor mode
 * is only granted when the visitor has an authorised session for that
 * business; otherwise the params are ignored and the published site renders.
 */
export async function resolveSiteRequest(site: string, searchParams: Record<string, string | string[] | undefined>): Promise<{ ctx: SiteContext | null; editor: boolean }> {
  const h = await headers();
  const mode = (h.get("x-tenant-mode") as TenantMode | null) ?? (site.includes(".") ? "domain" : "path");
  const wantsPreview = searchParams[PREVIEW_PARAM] === "draft";
  const wantsEditor = searchParams[EDITOR_PARAM] === "1";
  let preview = false;
  if (wantsPreview || wantsEditor) {
    const { user } = await getCurrentSession();
    if (user) {
      const business = mode === "domain"
        ? (await prisma.businessDomain.findUnique({ where: { hostname: site.toLowerCase() }, select: { businessId: true } }))?.businessId
        : (await prisma.business.findUnique({ where: { slug: site.toLowerCase() }, select: { id: true } }))?.id;
      if (business) {
        const access = await getBusinessAccess(user.id, business);
        preview = !!access && access.permissions.has("website.edit");
      }
    }
  }
  const ctx = await loadSiteContext(site, mode, { preview });
  return { ctx, editor: preview && wantsEditor };
}
