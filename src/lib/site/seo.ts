import type { Metadata } from "next";
import type { BusinessLocation, ServiceArea } from "@prisma/client";
import { tenantDb } from "@/lib/db";
import { asArray, asObject } from "@/lib/json";
import type { SiteContext } from "@/lib/tenant/resolve";
import { siteAbsoluteUrl, siteMedia, siteTokens } from "./context";

/**
 * SEO helpers for the tenant site: <head> metadata, JSON-LD builders and the
 * sanitiser for owner-supplied head snippets. Everything derives from rows
 * (business, locations, areas, theme, page seo); nothing is business-specific.
 *
 * business.seoDefaults: { titleSuffix?, description?, noindex?, socialImageMediaId?, headSnippet? }
 * business.settings.social: { facebook?: url, instagram?: url, ... }
 */
export interface SeoDefaults {
  titleSuffix?: string;
  description?: string;
  noindex?: boolean;
  socialImageMediaId?: string | null;
  /** Extra <meta>/<link> tags (sanitised) */
  headSnippet?: string;
  headHtml?: string;
  customHead?: string;
}

export function readSeoDefaults(ctx: SiteContext): SeoDefaults {
  return asObject<SeoDefaults>(ctx.business.seoDefaults);
}

export function socialLinks(ctx: SiteContext): Array<{ key: string; url: string }> {
  const settings = asObject<{ social?: Record<string, unknown> }>(ctx.business.settings);
  const social = settings.social && typeof settings.social === "object" ? settings.social : {};
  return Object.entries(social)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && /^https?:\/\//i.test(entry[1]))
    .map(([key, url]) => ({ key, url }));
}

export interface PageMetadataInput {
  ctx: SiteContext;
  /** Site-relative path of the page, e.g. "/services/bathroom-tiling" */
  path: string;
  title: string;
  /** When true the title is used verbatim (no suffix) */
  absoluteTitle?: boolean;
  description?: string | null;
  noindex?: boolean;
  /** Overrides the default self-canonical (site-relative path or absolute URL) */
  canonical?: string | null;
  socialImageMediaId?: string | null;
  socialImageUrl?: string | null;
  type?: "website" | "article";
}

/** Builds Next.js Metadata for a site page (title suffix, canonical, robots, Open Graph). */
export async function buildPageMetadata(input: PageMetadataInput): Promise<Metadata> {
  const { ctx } = input;
  const defaults = readSeoDefaults(ctx);
  const suffix = defaults.titleSuffix ?? ` | ${ctx.business.name}`;
  const title = input.absoluteTitle ? input.title : `${input.title}${suffix}`;
  const description = input.description || defaults.description || ctx.business.tagline || ctx.business.description || undefined;
  const noindex = !!input.noindex || !!defaults.noindex || ctx.preview;
  const canonical = input.canonical ? (/^https?:\/\//i.test(input.canonical) ? input.canonical : siteAbsoluteUrl(ctx, input.canonical)) : siteAbsoluteUrl(ctx, input.path);

  let image = input.socialImageUrl ?? null;
  if (!image) {
    const media = (await siteMedia(ctx, input.socialImageMediaId)) ?? (await siteMedia(ctx, defaults.socialImageMediaId)) ?? (await siteMedia(ctx, siteTokens(ctx).logoMediaId ?? ctx.business.logoMediaId));
    image = media?.large ?? null;
  }
  const absoluteImage = image ? (/^https?:\/\//i.test(image) ? image : `${siteAbsoluteUrl(ctx, "/").replace(/\/$/, "")}${image}`) : null;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: noindex ? { index: false, follow: !ctx.preview } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: ctx.business.name,
      type: input.type ?? "website",
      locale: ctx.business.locale.replace("-", "_"),
      images: absoluteImage ? [{ url: absoluteImage }] : undefined,
    },
    twitter: { card: absoluteImage ? "summary_large_image" : "summary", title, description, images: absoluteImage ? [absoluteImage] : undefined },
  };
}

// ── JSON-LD ───────────────────────────────────────────────────────────────────

export type JsonLd = Record<string, unknown>;

type OpeningHoursEntry = { day?: string; days?: string | string[]; label?: string; open?: string; close?: string; opens?: string; closes?: string; hours?: string; closed?: boolean };

const DAY_CODES: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

function dayName(value: string): string | null {
  const key = value.trim().slice(0, 3).toLowerCase();
  return DAY_CODES[key] ?? null;
}

/** Normalised opening hours rows for display and schema.org. Tolerates several admin shapes. */
export function normaliseOpeningHours(raw: unknown): Array<{ label: string; hours: string; days: string[]; opens?: string; closes?: string }> {
  const rows = Array.isArray(raw) ? (raw as OpeningHoursEntry[]) : [];
  const out: Array<{ label: string; hours: string; days: string[]; opens?: string; closes?: string }> = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rawDays = row.days ?? row.day ?? row.label ?? "";
    const dayList = (Array.isArray(rawDays) ? rawDays : String(rawDays).split(/[,&]|\s+to\s+|–|-/)).map((d) => dayName(String(d))).filter((d): d is string => !!d);
    const label = Array.isArray(rawDays) ? rawDays.join(", ") : String(rawDays);
    const opens = row.open ?? row.opens;
    const closes = row.close ?? row.closes;
    const hours = row.closed ? "Closed" : row.hours ?? (opens && closes ? `${opens} – ${closes}` : "");
    if (!label && !hours) continue;
    out.push({ label, hours, days: dayList, opens: row.closed ? undefined : opens, closes: row.closed ? undefined : closes });
  }
  return out;
}

export async function loadPrimaryLocation(ctx: SiteContext): Promise<BusinessLocation | null> {
  const db = tenantDb(ctx.business.id);
  return (
    (await db.businessLocation.findFirst({ where: { businessId: ctx.business.id, isPrimary: true, isActive: true } })) ??
    (await db.businessLocation.findFirst({ where: { businessId: ctx.business.id, isActive: true }, orderBy: { sortOrder: "asc" } }))
  );
}

export function postalAddress(location: BusinessLocation | null): JsonLd | undefined {
  if (!location) return undefined;
  const street = [location.addressLine1, location.addressLine2].filter(Boolean).join(", ");
  if (!street && !location.city && !location.postcode) return undefined;
  return {
    "@type": "PostalAddress",
    streetAddress: street || undefined,
    addressLocality: location.city ?? undefined,
    addressRegion: location.state ?? undefined,
    postalCode: location.postcode ?? undefined,
    addressCountry: location.country,
  };
}

/** schema.org LocalBusiness for every page of the site. */
export async function localBusinessJsonLd(ctx: SiteContext, opts: { location?: BusinessLocation | null; areas?: Array<Pick<ServiceArea, "name" | "type">> } = {}): Promise<JsonLd> {
  const db = tenantDb(ctx.business.id);
  const location = opts.location !== undefined ? opts.location : await loadPrimaryLocation(ctx);
  const areas = opts.areas ?? (await db.serviceArea.findMany({ where: { businessId: ctx.business.id, isEnabled: true }, select: { name: true, type: true }, orderBy: { sortOrder: "asc" }, take: 100 }));
  const logo = await siteMedia(ctx, siteTokens(ctx).logoMediaId ?? ctx.business.logoMediaId);
  const hours = normaliseOpeningHours(location?.openingHours);
  const social = socialLinks(ctx).map((s) => s.url);
  const url = siteAbsoluteUrl(ctx, "/");
  const address = postalAddress(location);
  const AREA_TYPES: Record<string, string> = { COUNTRY: "Country", STATE: "State", REGION: "AdministrativeArea", CITY: "City", SUBURB: "Place", POSTCODE: "PostalCodeRangeSpecification" };
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${url}#business`,
    name: ctx.business.name,
    legalName: ctx.business.legalName ?? undefined,
    description: ctx.business.description ?? ctx.business.tagline ?? undefined,
    url,
    telephone: location?.phone ?? ctx.business.phone ?? undefined,
    email: location?.email ?? ctx.business.email ?? undefined,
    image: logo?.large ?? undefined,
    logo: logo?.url ?? undefined,
    address,
    geo: location?.lat != null && location?.lng != null ? { "@type": "GeoCoordinates", latitude: Number(location.lat), longitude: Number(location.lng) } : undefined,
    areaServed: areas.length ? areas.map((a) => ({ "@type": AREA_TYPES[a.type] ?? "Place", name: a.name })) : ctx.business.serviceAreaText ? [{ "@type": "Place", name: ctx.business.serviceAreaText }] : undefined,
    openingHoursSpecification: hours.filter((h) => h.days.length && h.opens && h.closes).map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.days, opens: h.opens, closes: h.closes })) || undefined,
    sameAs: social.length ? social : undefined,
    currenciesAccepted: ctx.business.currency,
  };
}

export function breadcrumbJsonLd(ctx: SiteContext, crumbs: Array<{ label: string; path: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: siteAbsoluteUrl(ctx, c.path) })),
  };
}

export function faqJsonLd(items: Array<{ question: string; answer: string }>): JsonLd | null {
  const clean = items.filter((f) => f.question && f.answer);
  if (!clean.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: clean.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

/** Removes undefined values recursively so the emitted JSON-LD is tidy. */
export function compactJsonLd<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Serialises JSON-LD safely for a <script> tag (no </script> or HTML comment breakouts). */
export function jsonLdText(data: JsonLd): string {
  return JSON.stringify(compactJsonLd(data)).replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e");
}

// ── Custom head snippets ─────────────────────────────────────────────────────

export interface HeadTag {
  tag: "meta" | "link";
  attrs: Record<string, string>;
}

const META_ATTRS = new Set(["name", "content", "property", "http-equiv", "charset", "itemprop"]);
const LINK_ATTRS = new Set(["rel", "href", "type", "sizes", "media", "hreflang", "as", "crossorigin", "title", "color"]);
const BLOCKED_HTTP_EQUIV = new Set(["refresh", "set-cookie", "content-security-policy"]);

/**
 * Reduces an owner-supplied head snippet to plain <meta> and <link> tags with
 * an attribute allowlist. Scripts, styles, event handlers and javascript:
 * URLs never make it through, so a site owner cannot inject code.
 */
export function sanitizeHeadSnippet(snippet: string | null | undefined): HeadTag[] {
  if (!snippet) return [];
  const out: HeadTag[] = [];
  const tagRe = /<(meta|link)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(snippet)) && out.length < 40) {
    const tag = m[1].toLowerCase() as "meta" | "link";
    const allowed = tag === "meta" ? META_ATTRS : LINK_ATTRS;
    const attrs: Record<string, string> = {};
    const attrRe = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(m[2]))) {
      const key = a[1].toLowerCase();
      const value = (a[2] ?? a[3] ?? a[4] ?? "").trim();
      if (!allowed.has(key) || key.startsWith("on")) continue;
      if (key === "href" && !/^(https?:\/\/|\/)/i.test(value)) continue;
      if (key === "http-equiv" && BLOCKED_HTTP_EQUIV.has(value.toLowerCase())) continue;
      attrs[key] = value.slice(0, 2000);
    }
    if (tag === "link" && !attrs.href) continue;
    if (tag === "link" && /stylesheet|preload|modulepreload|import/i.test(attrs.rel ?? "")) continue; // no external code/style loading
    if (tag === "meta" && !attrs.name && !attrs.property && !attrs["http-equiv"] && !attrs.itemprop) continue;
    out.push({ tag, attrs });
  }
  return out;
}

export function headSnippetTags(ctx: SiteContext): HeadTag[] {
  const defaults = readSeoDefaults(ctx);
  return sanitizeHeadSnippet(defaults.headSnippet ?? defaults.headHtml ?? defaults.customHead);
}

/** Page-level seo json (Page.seo / Service.seo / Project.seo / ServiceArea.seo) */
export interface EntitySeo {
  title?: string;
  description?: string;
  noindex?: boolean;
  canonical?: string;
  socialImageMediaId?: string | null;
  socialImageId?: string | null;
  jsonLd?: Record<string, unknown>;
}

export function readEntitySeo(value: unknown): EntitySeo {
  const seo = asObject<EntitySeo>(value as never);
  return { ...seo, socialImageMediaId: seo.socialImageMediaId ?? seo.socialImageId ?? null };
}

export function readFaqs(value: unknown): Array<{ question: string; answer: string }> {
  return asArray<{ question?: unknown; answer?: unknown }>(value as never)
    .map((f) => ({ question: typeof f?.question === "string" ? f.question : "", answer: typeof f?.answer === "string" ? f.answer : "" }))
    .filter((f) => f.question);
}
