import { z } from "zod";
import type { Business, Redirect } from "@prisma/client";
import { platformDb, type TenantDb } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { asObject, toJson } from "@/lib/json";

/**
 * Site-wide SEO defaults live in businesses.seoDefaults (jsonb). The site
 * renderer reads titleSuffix / description / noindex / socialImage / head
 * snippets / organisation JSON-LD from here. Redirects are rows.
 */
export const OrganizationSeoSchema = z.object({
  schemaType: z.string().trim().max(80).default("LocalBusiness"),
  name: z.string().trim().max(160).optional(),
  legalName: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(60).optional(),
  email: z.string().trim().max(160).optional(),
  url: z.string().trim().max(500).optional(),
  streetAddress: z.string().trim().max(200).optional(),
  addressLocality: z.string().trim().max(120).optional(),
  addressRegion: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(20).optional(),
  addressCountry: z.string().trim().max(10).optional(),
  priceRange: z.string().trim().max(20).optional(),
  openingHours: z.string().trim().max(300).optional(),
  sameAs: z.array(z.string().trim().max(500)).max(20).default([]),
  logoMediaId: z.string().uuid().nullable().optional(),
});

export const SeoDefaultsSchema = z.object({
  titleSuffix: z.string().trim().max(120).optional(),
  description: z.string().trim().max(400).optional(),
  socialImageMediaId: z.string().uuid().nullable().optional(),
  /** Site-wide robots noindex switch. */
  noindex: z.boolean().default(false),
  googleSiteVerification: z.string().trim().max(200).optional(),
  /** Sanitised: only <meta> and <link> tags survive. */
  headSnippets: z.string().max(5000).optional(),
  organization: OrganizationSeoSchema.optional(),
});
export type SeoDefaults = z.infer<typeof SeoDefaultsSchema>;
export type OrganizationSeo = z.infer<typeof OrganizationSeoSchema>;

export function readSeoDefaults(business: Pick<Business, "seoDefaults">): SeoDefaults {
  const parsed = SeoDefaultsSchema.safeParse(asObject(business.seoDefaults));
  return parsed.success ? parsed.data : { noindex: false };
}

/** Organisation fields pre-filled from the business record when nothing is saved yet. */
export function organizationFromBusiness(business: Business, location: { addressLine1?: string | null; city?: string | null; state?: string | null; postcode?: string | null; country?: string | null } | null, siteUrl: string): OrganizationSeo {
  return {
    schemaType: "LocalBusiness",
    name: business.name,
    legalName: business.legalName ?? undefined,
    phone: business.phone ?? undefined,
    email: business.email ?? undefined,
    url: siteUrl,
    streetAddress: location?.addressLine1 ?? undefined,
    addressLocality: location?.city ?? undefined,
    addressRegion: location?.state ?? business.state ?? undefined,
    postalCode: location?.postcode ?? undefined,
    addressCountry: location?.country ?? business.country,
    sameAs: [],
    logoMediaId: business.logoMediaId ?? null,
  };
}

/**
 * Keeps only <meta …> and <link …> tags. Anything else (scripts, styles,
 * event handlers, javascript: URLs) is dropped so owners can paste verification
 * tags safely without being able to inject scripts into their visitors' pages.
 */
export function sanitiseHeadSnippets(input: string): string {
  const tags = input.match(/<(meta|link)\b[^<>]*\/?>/gi) ?? [];
  return tags
    .filter((tag) => !/\son[a-z]+\s*=/i.test(tag) && !/javascript:/i.test(tag) && !/<\s*\/?\s*script/i.test(tag))
    .map((tag) => tag.trim())
    .join("\n");
}

export async function saveSeoDefaults(businessId: string, input: SeoDefaults, actorUserId: string): Promise<SeoDefaults> {
  const business = await platformDb.business.findFirstOrThrow({ where: { id: businessId, deletedAt: null }, select: { seoDefaults: true } });
  const next: SeoDefaults = { ...input, headSnippets: input.headSnippets ? sanitiseHeadSnippets(input.headSnippets) : undefined };
  // Only the SEO column is written; the business row is not RLS-protected so the update is guarded by the caller's access check.
  await platformDb.business.update({ where: { id: businessId }, data: { seoDefaults: toJson(next) } });
  await recordAudit({ actorUserId, businessId, action: "seo.defaults_updated", entityType: "business", entityId: businessId, before: business.seoDefaults, after: next });
  await emitEvent({ type: "business.updated", businessId, payload: { businessId, fields: ["seoDefaults"] }, actorUserId });
  return next;
}

// ── Redirects ────────────────────────────────────────────────────────────────

export const RedirectSchema = z.object({
  fromPath: z
    .string()
    .trim()
    .min(1, "From path is required")
    .max(500)
    .refine((v) => v.startsWith("/"), "From path must start with /")
    .refine((v) => !/\s/.test(v), "From path cannot contain spaces"),
  toPath: z
    .string()
    .trim()
    .min(1, "Destination is required")
    .max(1000)
    .refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "Destination must start with / or be a full https:// URL"),
  statusCode: z.coerce.number().int().refine((v) => v === 301 || v === 302, "Use 301 (permanent) or 302 (temporary)").default(301),
  isActive: z.boolean().default(true),
});
export type RedirectInput = z.infer<typeof RedirectSchema>;

export class RedirectError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = "RedirectError";
  }
}

function normalisePath(p: string): string {
  if (/^https?:\/\//i.test(p)) return p;
  const clean = p.replace(/\/{2,}/g, "/");
  return clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
}

export async function listRedirects(db: TenantDb, businessId: string): Promise<Redirect[]> {
  return db.redirect.findMany({ where: { businessId }, orderBy: [{ isActive: "desc" }, { fromPath: "asc" }] });
}

export async function createRedirect(db: TenantDb, businessId: string, input: RedirectInput, actorUserId: string): Promise<Redirect> {
  const fromPath = normalisePath(input.fromPath);
  const toPath = normalisePath(input.toPath);
  if (fromPath === toPath) throw new RedirectError("A redirect cannot point to itself.", "toPath");
  const existing = await db.redirect.findFirst({ where: { businessId, fromPath }, select: { id: true } });
  if (existing) throw new RedirectError("A redirect from this path already exists.", "fromPath");
  const row = await db.redirect.create({ data: { businessId, fromPath, toPath, statusCode: input.statusCode, isActive: input.isActive } });
  await recordAudit({ actorUserId, businessId, action: "redirect.created", entityType: "redirect", entityId: row.id, after: { fromPath, toPath, statusCode: row.statusCode, isActive: row.isActive } });
  return row;
}

export async function updateRedirect(db: TenantDb, businessId: string, id: string, input: RedirectInput, actorUserId: string): Promise<Redirect> {
  const current = await db.redirect.findFirst({ where: { id, businessId } });
  if (!current) throw new RedirectError("Redirect not found.");
  const fromPath = normalisePath(input.fromPath);
  const toPath = normalisePath(input.toPath);
  if (fromPath === toPath) throw new RedirectError("A redirect cannot point to itself.", "toPath");
  const clash = await db.redirect.findFirst({ where: { businessId, fromPath, id: { not: id } }, select: { id: true } });
  if (clash) throw new RedirectError("Another redirect already uses this from path.", "fromPath");
  const row = await db.redirect.update({ where: { id }, data: { fromPath, toPath, statusCode: input.statusCode, isActive: input.isActive } });
  await recordAudit({ actorUserId, businessId, action: "redirect.updated", entityType: "redirect", entityId: id, before: { fromPath: current.fromPath, toPath: current.toPath, statusCode: current.statusCode, isActive: current.isActive }, after: { fromPath, toPath, statusCode: row.statusCode, isActive: row.isActive } });
  return row;
}

export async function setRedirectActive(db: TenantDb, businessId: string, id: string, isActive: boolean, actorUserId: string): Promise<Redirect> {
  const current = await db.redirect.findFirst({ where: { id, businessId } });
  if (!current) throw new RedirectError("Redirect not found.");
  const row = await db.redirect.update({ where: { id }, data: { isActive } });
  await recordAudit({ actorUserId, businessId, action: isActive ? "redirect.enabled" : "redirect.disabled", entityType: "redirect", entityId: id });
  return row;
}

/** Redirect rows have no soft-delete column; disabling is the reversible path, deletion is confirmed in the UI. */
export async function deleteRedirect(db: TenantDb, businessId: string, id: string, actorUserId: string): Promise<void> {
  const current = await db.redirect.findFirst({ where: { id, businessId } });
  if (!current) throw new RedirectError("Redirect not found.");
  await db.redirect.delete({ where: { id } });
  await recordAudit({ actorUserId, businessId, action: "redirect.deleted", entityType: "redirect", entityId: id, before: { fromPath: current.fromPath, toPath: current.toPath, statusCode: current.statusCode } });
}
