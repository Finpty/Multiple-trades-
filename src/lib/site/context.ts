import { headers } from "next/headers";
import { permanentRedirect, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getBusinessAccess } from "@/lib/authz";
import { loadSiteContext, publicSiteUrl, siteHref, type SiteContext } from "@/lib/tenant/resolve";
import type { TenantMode } from "@/lib/tenant/routing";
import { platformDb, prisma, tenantDb } from "@/lib/db";
import { asObject } from "@/lib/json";
import { EDITOR_PARAM, PREVIEW_PARAM, parseEditorMode, type EditorMode } from "@/lib/editor/protocol";
import { DEFAULT_THEME_TOKENS, mergeTokens, type ThemeTokens } from "@/lib/theme/tokens";
import { mediaUrls, type MediaUrlSet } from "@/lib/media/service";

/**
 * Resolves the SiteContext for a /s/[site] request. Preview/editor mode
 * is only granted when the visitor has an authorised session for that
 * business; otherwise the params are ignored and the published site renders.
 */
export async function resolveSiteRequest(site: string, searchParams: Record<string, string | string[] | undefined>): Promise<{ ctx: SiteContext | null; editor: boolean; editorMode: EditorMode | null }> {
  const h = await headers();
  const mode = (h.get("x-tenant-mode") as TenantMode | null) ?? (site.includes(".") ? "domain" : "path");
  const wantsPreview = searchParams[PREVIEW_PARAM] === "draft";
  const editorMode = parseEditorMode(searchParams[EDITOR_PARAM]);
  const wantsEditor = editorMode !== null;
  let preview = false;
  if (wantsPreview || wantsEditor) {
    const { user } = await getCurrentSession();
    if (user) {
      const business = mode === "domain"
        ? (await platformDb.businessDomain.findUnique({ where: { hostname: site.toLowerCase() }, select: { businessId: true } }))?.businessId // hostname → business is a platform-level lookup (RLS table)
        : (await prisma.business.findUnique({ where: { slug: site.toLowerCase() }, select: { id: true } }))?.id;
      if (business) {
        const access = await getBusinessAccess(user.id, business);
        preview = !!access && access.permissions.has("website.edit");
      }
    }
  }
  const ctx = await loadSiteContext(site, mode, { preview });
  return { ctx, editor: preview && wantsEditor, editorMode: preview ? editorMode : null };
}

/**
 * Context for the site layout. Layouts cannot read search params, so the
 * layout renders published chrome; when the business itself is not published
 * (draft business being previewed by an editor) it falls back to preview.
 */
export async function resolveSiteLayout(site: string): Promise<SiteContext | null> {
  const h = await headers();
  const previewHeader = h.get("x-tenant-preview");
  const editorHeader = h.get("x-tenant-editor");
  if (previewHeader === "draft" || editorHeader) {
    const previewed = await resolveSiteRequest(site, { [PREVIEW_PARAM]: previewHeader ?? undefined, [EDITOR_PARAM]: editorHeader ?? undefined });
    if (previewed.ctx?.preview) return previewed.ctx;
  }
  const { ctx } = await resolveSiteRequest(site, {});
  if (ctx) return ctx;
  return (await resolveSiteRequest(site, { [PREVIEW_PARAM]: "draft" })).ctx;
}

/** Effective theme tokens for the request (draft in preview, else published). */
export function siteTokens(ctx: SiteContext): ThemeTokens {
  const theme = ctx.theme;
  const raw = ctx.preview ? theme?.draft : (theme?.published ?? theme?.draft);
  return mergeTokens(DEFAULT_THEME_TOKENS, asObject<Partial<ThemeTokens>>(raw ?? null));
}

/** Absolute platform URL (login, quote/invoice viewers live on the platform host). */
export function platformUrl(path = "/"): string {
  const base = (process.env.PLATFORM_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${base}${clean === "/" ? "" : clean}`;
}

/**
 * Absolute public URL of a site path. Prefers the verified primary domain;
 * otherwise uses the current host in domain mode or the platform path URL.
 */
export function siteAbsoluteUrl(ctx: SiteContext, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const rel = clean === "/" ? "" : clean;
  if (ctx.primaryDomain) return `https://${ctx.primaryDomain}${rel}`;
  if (ctx.mode === "domain" || ctx.mode === "subdomain") {
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    return `${proto}://${ctx.hostname}${rel}`;
  }
  return `${publicSiteUrl(ctx.business, null)}${rel}`;
}

/** Industry-defined labels (service, project, quote, ...) with sensible fallbacks. */
export function siteTerminology(ctx: SiteContext): Record<string, string> {
  const settings = asObject<{ terminology?: Record<string, string> }>(ctx.business.settings);
  return { service: "Service", services: "Services", project: "Project", projects: "Projects", quote: "Quote", job: "Job", customer: "Customer", lead: "Enquiry", ...(settings.terminology ?? {}) };
}

/** Plural form of a terminology key (uses an explicit plural key when the industry defines one). */
export function termPlural(terms: Record<string, string>, key: string): string {
  if (terms[`${key}s`]) return terms[`${key}s`];
  const single = terms[key] ?? key;
  return /s$/i.test(single) ? single : `${single}s`;
}

/** Whether a business feature (BusinessFeature.featureKey) is switched on. */
export async function siteFeatureEnabled(ctx: SiteContext, featureKey: string): Promise<boolean> {
  const row = await tenantDb(ctx.business.id).businessFeature.findFirst({ where: { businessId: ctx.business.id, featureKey }, select: { isEnabled: true } });
  return !!row?.isEnabled;
}

/** Resolves a media id (belonging to this business) to public URLs, or null. */
export async function siteMedia(ctx: SiteContext, mediaId: string | null | undefined): Promise<MediaUrlSet | null> {
  if (!mediaId) return null;
  const media = await tenantDb(ctx.business.id).media.findFirst({ where: { id: mediaId, businessId: ctx.business.id } });
  return media ? mediaUrls(media) : null;
}

/** Batch variant of siteMedia keyed by id (missing ids are skipped). */
export async function siteMediaMap(ctx: SiteContext, ids: Array<string | null | undefined>): Promise<Record<string, MediaUrlSet>> {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (wanted.length === 0) return {};
  const rows = await tenantDb(ctx.business.id).media.findMany({ where: { businessId: ctx.business.id, id: { in: wanted } } });
  const out: Record<string, MediaUrlSet> = {};
  for (const row of rows) out[row.id] = await mediaUrls(row);
  return out;
}

function normalisePath(path: string): string {
  let p = path.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p.toLowerCase();
}

/**
 * Site-level redirects, evaluated by every site page before rendering:
 *  1. Redirect rows (fromPath → toPath with the configured status code).
 *  2. BusinessDomain.redirectToDomainId — a non-primary domain that should
 *     send visitors to another (verified) hostname of the same business.
 * `path` is the site-relative path ("/services/x"), never the /s/ internal path.
 * Next.js server redirects are 307/308, so 301/308 rows become permanent
 * redirects and every other code a temporary one.
 */
export async function applySiteRedirects(ctx: SiteContext, path: string, searchParams: Record<string, string | string[] | undefined> = {}): Promise<void> {
  const current = normalisePath(path);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === PREVIEW_PARAM || k === EDITOR_PARAM) continue;
    for (const item of Array.isArray(v) ? v : v === undefined ? [] : [v]) qs.append(k, item);
  }
  const query = qs.toString();
  const search = query ? `?${query}` : "";

  if (ctx.mode === "domain") {
    // business_domains is a tenant table (RLS): read it through the tenant-scoped client.
    const db = tenantDb(ctx.business.id);
    const domain = await db.businessDomain.findFirst({ where: { businessId: ctx.business.id, hostname: ctx.hostname.toLowerCase() } });
    if (domain && domain.redirectToDomainId && domain.verificationStatus === "VERIFIED") {
      const target = await db.businessDomain.findFirst({ where: { id: domain.redirectToDomainId, businessId: ctx.business.id, verificationStatus: "VERIFIED" } });
      if (target && target.hostname !== domain.hostname) {
        const url = `https://${target.hostname}${current === "/" ? "" : current}${search}`;
        if (domain.redirectType === 302 || domain.redirectType === 307) redirect(url);
        permanentRedirect(url);
      }
    }
  }

  const rows = await tenantDb(ctx.business.id).redirect.findMany({ where: { businessId: ctx.business.id, isActive: true } });
  const match = rows.find((r) => normalisePath(r.fromPath) === current);
  if (!match) return;
  if (normalisePath(match.toPath) === current) return; // never loop on itself
  const base = /^(https?:)?\/\//i.test(match.toPath) ? match.toPath : siteHref(ctx, match.toPath);
  // Preserve the visitor's query string unless the rule supplies its own.
  const target = search && !base.includes("?") ? `${base}${search}` : base;
  if (match.statusCode === 302 || match.statusCode === 307) redirect(target);
  permanentRedirect(target);
}
