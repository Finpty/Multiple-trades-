import { z } from "zod";
import type { Page, PageAudience, PageKind, PageStatus } from "@prisma/client";
import { Prisma, withTenantTransaction, type TenantDb } from "@/lib/db";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { asObject, toJson } from "@/lib/json";
import { slugify } from "@/lib/slug";
import { defaultBlockProps, type BlockType, type PublishedPageSnapshot } from "@/lib/blocks/schema";

/**
 * Page management helpers used by the website admin. Every function takes an
 * RLS-scoped client (from requireBusinessAccess) plus the businessId that was
 * checked, and audits its mutation. Publishing lives in src/lib/business/publish.ts.
 */

export const PAGE_KINDS = ["SYSTEM", "CUSTOM", "LANDING"] as const satisfies readonly PageKind[];
export const PAGE_STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"] as const satisfies readonly PageStatus[];
export const PAGE_AUDIENCES = ["PUBLIC", "CUSTOMERS", "STAFF"] as const satisfies readonly PageAudience[];

export const PAGE_TEMPLATES: Array<{ key: string; label: string; description: string }> = [
  { key: "default", label: "Default", description: "Standard page layout with header and footer." },
  { key: "landing", label: "Landing", description: "Conversion-focused layout with minimal navigation." },
  { key: "narrow", label: "Narrow", description: "Reading-width content for articles and policies." },
  { key: "full-width", label: "Full width", description: "Edge-to-edge sections for visual pages." },
];

/** SEO settings stored in pages.seo */
export const PageSeoSchema = z.object({
  title: z.string().max(160).optional(),
  description: z.string().max(400).optional(),
  noindex: z.boolean().default(false),
  canonical: z.string().max(500).optional(),
  socialImageMediaId: z.string().nullable().optional(),
  /** Extra JSON-LD merged into the page's structured data. */
  jsonLd: z.record(z.unknown()).optional(),
});
export type PageSeo = z.infer<typeof PageSeoSchema>;

export function readPageSeo(page: Pick<Page, "seo">): PageSeo {
  const parsed = PageSeoSchema.safeParse(asObject(page.seo));
  return parsed.success ? parsed.data : { noindex: false };
}

const CUSTOM_KINDS = ["CUSTOM", "LANDING"] as const;

export const CreatePageSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  slug: z.string().trim().max(160).optional(),
  kind: z.enum(CUSTOM_KINDS).default("CUSTOM"),
  templateKey: z.string().trim().max(60).default("default"),
  audience: z.enum(PAGE_AUDIENCES).default("PUBLIC"),
  showInNav: z.boolean().default(true),
  parentId: z.string().uuid().nullable().optional(),
  seoTitle: z.string().trim().max(160).optional(),
  seoDescription: z.string().trim().max(400).optional(),
  starterSections: z.boolean().default(true),
});
export type CreatePageInput = z.infer<typeof CreatePageSchema>;

export const UpdatePageSettingsSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  slug: z.string().trim().max(160).optional(),
  templateKey: z.string().trim().max(60).default("default"),
  audience: z.enum(PAGE_AUDIENCES).default("PUBLIC"),
  showInNav: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  parentId: z.string().uuid().nullable().optional(),
  seoTitle: z.string().trim().max(160).optional(),
  seoDescription: z.string().trim().max(400).optional(),
  seoNoindex: z.boolean().default(false),
  seoCanonical: z.string().trim().max(500).optional(),
  seoSocialImageMediaId: z.string().uuid().nullable().optional(),
  seoJsonLd: z.string().trim().optional(),
  settingsJson: z.string().trim().optional(),
});
export type UpdatePageSettingsInput = z.infer<typeof UpdatePageSettingsSchema>;

export class PageError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = "PageError";
  }
}

/** Slug cleaning: lower-case, path-safe, allows nested "a/b" slugs. */
export function normalisePageSlug(raw: string): string {
  return raw
    .split("/")
    .map((s) => slugify(s))
    .filter(Boolean)
    .join("/");
}

export async function uniquePageSlug(db: TenantDb, businessId: string, base: string, excludeId?: string): Promise<string> {
  const root = normalisePageSlug(base) || "page";
  let candidate = root;
  let n = 2;
  while (await db.page.findFirst({ where: { businessId, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })) {
    candidate = `${root}-${n++}`;
  }
  return candidate;
}

function parseJsonObject(input: string | undefined, field: string): Record<string, unknown> | undefined {
  if (!input) return undefined;
  try {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new PageError("Must be a valid JSON object.", field);
  }
}

export async function createPage(db: TenantDb, businessId: string, input: CreatePageInput, actorUserId: string): Promise<Page> {
  const slug = await uniquePageSlug(db, businessId, input.slug || input.title);
  if (input.parentId) {
    const parent = await db.page.findFirst({ where: { id: input.parentId, businessId }, select: { id: true } });
    if (!parent) throw new PageError("Parent page not found.", "parentId");
  }
  const last = await db.page.findFirst({ where: { businessId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const seo: PageSeo = { noindex: false, ...(input.seoTitle ? { title: input.seoTitle } : {}), ...(input.seoDescription ? { description: input.seoDescription } : {}) };
  const page = await withTenantTransaction(businessId, async (tx) => {
    const created = await tx.page.create({
      data: {
        businessId,
        title: input.title,
        slug,
        kind: input.kind,
        templateKey: input.templateKey || "default",
        audience: input.audience,
        showInNav: input.showInNav,
        parentId: input.parentId ?? null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        status: "DRAFT",
        seo: toJson(seo),
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
    });
    if (input.starterSections) {
      await tx.pageSection.createMany({
        data: [
          { businessId, pageId: created.id, type: "page_header", sortOrder: 0, props: toJson({ ...defaultBlockProps("page_header"), heading: input.title }), settings: toJson({}) },
          { businessId, pageId: created.id, type: "text", sortOrder: 1, props: toJson({ ...defaultBlockProps("text"), body: "Write your content here." }), settings: toJson({}) },
        ],
      });
    }
    return created;
  });
  await recordAudit({ actorUserId, businessId, action: "page.created", entityType: "page", entityId: page.id, after: { title: page.title, slug: page.slug, kind: page.kind } });
  return page;
}

export async function updatePageSettings(db: TenantDb, businessId: string, pageId: string, input: UpdatePageSettingsInput, actorUserId: string): Promise<Page> {
  const page = await db.page.findFirst({ where: { id: pageId, businessId } });
  if (!page) throw new PageError("Page not found.");
  const slugLocked = page.kind === "SYSTEM" && page.systemKey !== "home";
  let slug = page.slug;
  if (!slugLocked && input.slug !== undefined) {
    const wanted = normalisePageSlug(input.slug);
    if (page.systemKey !== "home" && wanted === "") throw new PageError("Slug is required.", "slug");
    if (wanted !== page.slug) {
      const taken = await db.page.findFirst({ where: { businessId, slug: wanted, id: { not: pageId } }, select: { id: true } });
      if (taken) throw new PageError("Another page already uses this slug.", "slug");
      slug = wanted;
    }
  }
  if (input.parentId) {
    if (input.parentId === pageId) throw new PageError("A page cannot be its own parent.", "parentId");
    const parent = await db.page.findFirst({ where: { id: input.parentId, businessId }, select: { id: true } });
    if (!parent) throw new PageError("Parent page not found.", "parentId");
  }
  const jsonLd = parseJsonObject(input.seoJsonLd, "seoJsonLd");
  const settings = parseJsonObject(input.settingsJson, "settingsJson");
  const seo: PageSeo = {
    title: input.seoTitle || undefined,
    description: input.seoDescription || undefined,
    noindex: input.seoNoindex,
    canonical: input.seoCanonical || undefined,
    socialImageMediaId: input.seoSocialImageMediaId ?? null,
    jsonLd,
  };
  const updated = await db.page.update({
    where: { id: pageId },
    data: {
      title: input.title,
      slug,
      templateKey: input.templateKey || "default",
      audience: input.audience,
      showInNav: input.showInNav,
      sortOrder: input.sortOrder,
      parentId: input.parentId ?? null,
      seo: toJson(seo),
      settings: settings !== undefined ? toJson(settings) : undefined,
      updatedByUserId: actorUserId,
    },
  });
  await recordAudit({
    actorUserId,
    businessId,
    action: "page.updated",
    entityType: "page",
    entityId: pageId,
    before: { title: page.title, slug: page.slug, audience: page.audience, showInNav: page.showInNav, seo: page.seo },
    after: { title: updated.title, slug: updated.slug, audience: updated.audience, showInNav: updated.showInNav, seo: updated.seo },
  });
  return updated;
}

/** Quick per-page SEO edit used by the SEO table. */
export async function updatePageSeo(db: TenantDb, businessId: string, pageId: string, patch: Partial<Pick<PageSeo, "title" | "description" | "noindex">>, actorUserId: string): Promise<Page> {
  const page = await db.page.findFirst({ where: { id: pageId, businessId } });
  if (!page) throw new PageError("Page not found.");
  const seo = { ...readPageSeo(page), ...patch };
  const updated = await db.page.update({ where: { id: pageId }, data: { seo: toJson(seo), updatedByUserId: actorUserId } });
  await recordAudit({ actorUserId, businessId, action: "page.seo_updated", entityType: "page", entityId: pageId, before: page.seo, after: updated.seo });
  return updated;
}

export async function duplicatePage(db: TenantDb, businessId: string, pageId: string, actorUserId: string): Promise<Page> {
  const source = await db.page.findFirst({ where: { id: pageId, businessId }, include: { sections: { orderBy: { sortOrder: "asc" } } } });
  if (!source) throw new PageError("Page not found.");
  const slug = await uniquePageSlug(db, businessId, `${source.slug || "home"}-copy`);
  const copy = await withTenantTransaction(businessId, async (tx) => {
    const created = await tx.page.create({
      data: {
        businessId,
        title: `${source.title} (copy)`,
        slug,
        kind: source.kind === "SYSTEM" ? "CUSTOM" : source.kind,
        systemKey: null,
        templateKey: source.templateKey,
        audience: source.audience,
        showInNav: false,
        parentId: source.parentId,
        sortOrder: source.sortOrder + 1,
        status: "DRAFT",
        seo: toJson(source.seo),
        settings: toJson(source.settings),
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
    });
    if (source.sections.length) {
      await tx.pageSection.createMany({ data: source.sections.map((s, i) => ({ businessId, pageId: created.id, type: s.type, sortOrder: i, props: toJson(s.props), settings: toJson(s.settings), isHidden: s.isHidden })) });
    }
    return created;
  });
  await recordAudit({ actorUserId, businessId, action: "page.duplicated", entityType: "page", entityId: copy.id, metadata: { sourcePageId: pageId, slug } });
  return copy;
}

export async function archivePage(db: TenantDb, businessId: string, pageId: string, actorUserId: string): Promise<Page> {
  const page = await db.page.findFirst({ where: { id: pageId, businessId } });
  if (!page) throw new PageError("Page not found.");
  if (page.kind === "SYSTEM") throw new PageError("System pages cannot be archived. Hide them from navigation instead.");
  const updated = await db.page.update({ where: { id: pageId }, data: { status: "ARCHIVED", archivedAt: new Date(), scheduledAt: null, published: Prisma.DbNull, updatedByUserId: actorUserId } });
  await recordAudit({ actorUserId, businessId, action: "page.archived", entityType: "page", entityId: pageId, before: { status: page.status }, after: { status: "ARCHIVED" } });
  return updated;
}

export async function restorePage(db: TenantDb, businessId: string, pageId: string, actorUserId: string): Promise<Page> {
  const page = await db.page.findFirst({ where: { id: pageId, businessId } });
  if (!page) throw new PageError("Page not found.");
  if (page.status !== "ARCHIVED") return page;
  const updated = await db.page.update({ where: { id: pageId }, data: { status: "DRAFT", archivedAt: null, updatedByUserId: actorUserId } });
  await recordAudit({ actorUserId, businessId, action: "page.restored_from_archive", entityType: "page", entityId: pageId, before: { status: "ARCHIVED" }, after: { status: "DRAFT" } });
  return updated;
}

export async function schedulePage(db: TenantDb, businessId: string, pageId: string, scheduledAt: Date, actorUserId: string): Promise<Page> {
  const page = await db.page.findFirst({ where: { id: pageId, businessId } });
  if (!page) throw new PageError("Page not found.");
  if (page.status === "ARCHIVED") throw new PageError("Restore the page before scheduling it.");
  if (scheduledAt.getTime() <= Date.now()) throw new PageError("Pick a time in the future.", "scheduledAt");
  const updated = await db.page.update({ where: { id: pageId }, data: { status: "SCHEDULED", scheduledAt, updatedByUserId: actorUserId } });
  await recordAudit({ actorUserId, businessId, action: "page.scheduled", entityType: "page", entityId: pageId, metadata: { scheduledAt: scheduledAt.toISOString() } });
  return updated;
}

export async function cancelSchedule(db: TenantDb, businessId: string, pageId: string, actorUserId: string): Promise<Page> {
  const page = await db.page.findFirst({ where: { id: pageId, businessId } });
  if (!page) throw new PageError("Page not found.");
  const updated = await db.page.update({ where: { id: pageId }, data: { status: page.published ? "PUBLISHED" : "DRAFT", scheduledAt: null, updatedByUserId: actorUserId } });
  await recordAudit({ actorUserId, businessId, action: "page.schedule_cancelled", entityType: "page", entityId: pageId });
  return updated;
}

export interface PageRevisionView {
  id: string;
  version: number;
  note: string | null;
  createdAt: Date;
  author: string | null;
  sectionCount: number;
  snapshot: PublishedPageSnapshot;
}

export async function listPageRevisions(db: TenantDb, businessId: string, pageId: string): Promise<PageRevisionView[]> {
  const rows = await db.revision.findMany({ where: { businessId, entityType: "PAGE", entityId: pageId }, orderBy: { version: "desc" } });
  const userIds = [...new Set(rows.map((r) => r.createdByUserId).filter((x): x is string => !!x))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => {
    const snapshot = r.snapshot as unknown as PublishedPageSnapshot;
    return { id: r.id, version: r.version, note: r.note, createdAt: r.createdAt, author: r.createdByUserId ? names.get(r.createdByUserId) ?? null : null, sectionCount: Array.isArray(snapshot?.sections) ? snapshot.sections.length : 0, snapshot };
  });
}

/** One-line description of a section (used in lists and revision previews). */
export function sectionSummary(type: string, props: Record<string, unknown>): string {
  for (const key of ["heading", "title", "eyebrow", "caption", "body", "html"]) {
    const v = props[key];
    if (typeof v === "string" && v.trim()) return v.replace(/<[^>]+>/g, "").trim().slice(0, 90);
  }
  if (Array.isArray(props.items) && props.items.length) return `${props.items.length} items`;
  if (Array.isArray(props.images) && props.images.length) return `${props.images.length} images`;
  if (typeof props.formSlug === "string") return `Form: ${props.formSlug}`;
  if (typeof props.source === "string") return `Source: ${props.source}`;
  return "";
}

export function isBlockType(type: string): type is BlockType {
  return typeof type === "string" && /^[a-z_0-9]+$/.test(type);
}
