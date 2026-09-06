"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { tenantDb, withTenantTransaction } from "@/lib/db";
import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { recordAudit } from "@/lib/audit";
import { toJson } from "@/lib/json";
import { BLOCK_META, BLOCK_SCHEMAS, SectionSettingsSchema, defaultBlockProps, validateBlockProps, type BlockType } from "@/lib/blocks/schema";
import { toSectionView, type SectionView } from "./section-types";

/**
 * Section (block) server actions used by the page section editor and the
 * live editor. Every action re-checks access for the business, scopes each
 * query by businessId (on top of RLS) and records an audit entry.
 */

const uuid = z.string().uuid();

function pagePath(businessId: string, pageId: string) {
  return `/admin/${businessId}/website/pages/${pageId}`;
}

async function loadSection(businessId: string, sectionId: string) {
  const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
  const section = await ctx.db.pageSection.findFirst({ where: { id: uuid.parse(sectionId), businessId } });
  if (!section) throw new SectionError("Section not found.");
  return { ctx, section };
}

class SectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SectionError";
  }
}

async function touchPage(businessId: string, pageId: string, userId: string) {
  await tenantDb(businessId).page.updateMany({ where: { id: pageId, businessId }, data: { updatedByUserId: userId } });
}

/** Insert a new block of `type` at `index` (append when omitted). */
export async function addSection(businessId: string, pageId: string, type: string, index?: number): Promise<ActionResult<SectionView>> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    if (!(type in BLOCK_SCHEMAS)) return fail(`Unknown block type "${type}".`);
    const blockType = type as BlockType;
    const page = await ctx.db.page.findFirst({ where: { id: uuid.parse(pageId), businessId }, select: { id: true } });
    if (!page) return fail("Page not found.");
    const existing = await ctx.db.pageSection.findMany({ where: { pageId, businessId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
    const at = index === undefined || index < 0 || index > existing.length ? existing.length : Math.floor(index);
    const created = await withTenantTransaction(businessId, async (tx) => {
      const row = await tx.pageSection.create({ data: { businessId, pageId, type: blockType, sortOrder: at, props: toJson(defaultBlockProps(blockType)), settings: toJson({}) } });
      const ordered = [...existing.map((s) => s.id)];
      ordered.splice(at, 0, row.id);
      await Promise.all(ordered.map((id, i) => tx.pageSection.update({ where: { id }, data: { sortOrder: i } })));
      await tx.page.update({ where: { id: pageId }, data: { updatedByUserId: ctx.user.id } });
      return row;
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "section.added", entityType: "page_section", entityId: created.id, after: { pageId, type: blockType, index: at } });
    revalidatePath(pagePath(businessId, pageId));
    return ok(toSectionView(created), `${BLOCK_META[blockType].label} added`);
  });
}

/** Save block props and layout settings. Returns field errors keyed by dotted path. */
export async function updateSection(businessId: string, sectionId: string, props: unknown, settings?: unknown): Promise<ActionResult<SectionView>> {
  return runAction(async () => {
    const { ctx, section } = await loadSection(businessId, sectionId);
    const schema = BLOCK_SCHEMAS[section.type as BlockType];
    if (!schema) return fail(`Unknown block type "${section.type}".`);
    const fieldErrors: Record<string, string> = {};
    const parsedProps = schema.safeParse(props ?? {});
    if (!parsedProps.success) for (const issue of parsedProps.error.issues) fieldErrors[issue.path.join(".") || "_"] = issue.message;
    const parsedSettings = SectionSettingsSchema.safeParse(settings ?? section.settings ?? {});
    if (!parsedSettings.success) for (const issue of parsedSettings.error.issues) fieldErrors[`settings.${issue.path.join(".")}`] = issue.message;
    if (Object.keys(fieldErrors).length) return fail("Please correct the highlighted fields.", fieldErrors);
    const validated = validateBlockProps(section.type, parsedProps.success ? parsedProps.data : {});
    if (!validated.ok) return fail(validated.error);
    const updated = await ctx.db.pageSection.update({ where: { id: section.id }, data: { props: toJson(validated.props), settings: toJson(parsedSettings.success ? parsedSettings.data : {}) } });
    await touchPage(businessId, section.pageId, ctx.user.id);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "section.updated", entityType: "page_section", entityId: section.id, before: { props: section.props, settings: section.settings }, after: { props: updated.props, settings: updated.settings }, metadata: { pageId: section.pageId, type: section.type } });
    revalidatePath(pagePath(businessId, section.pageId));
    return ok(toSectionView(updated), "Section saved");
  });
}

/** Persist a new order. `ids` must contain every section of the page exactly once. */
export async function reorderSections(businessId: string, pageId: string, ids: string[]): Promise<ActionResult<SectionView[]>> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const wanted = z.array(uuid).parse(ids);
    const existing = await ctx.db.pageSection.findMany({ where: { pageId: uuid.parse(pageId), businessId }, select: { id: true } });
    const have = new Set(existing.map((s) => s.id));
    if (wanted.length !== have.size || wanted.some((id) => !have.has(id)) || new Set(wanted).size !== wanted.length) return fail("The section list is out of date. Reload the page and try again.");
    const rows = await withTenantTransaction(businessId, async (tx) => {
      await Promise.all(wanted.map((id, i) => tx.pageSection.update({ where: { id }, data: { sortOrder: i } })));
      await tx.page.update({ where: { id: pageId }, data: { updatedByUserId: ctx.user.id } });
      return tx.pageSection.findMany({ where: { pageId, businessId }, orderBy: { sortOrder: "asc" } });
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "section.reordered", entityType: "page", entityId: pageId, after: { order: wanted } });
    revalidatePath(pagePath(businessId, pageId));
    return ok(rows.map(toSectionView), "Order saved");
  });
}

export async function duplicateSection(businessId: string, sectionId: string): Promise<ActionResult<SectionView[]>> {
  return runAction(async () => {
    const { ctx, section } = await loadSection(businessId, sectionId);
    const rows = await withTenantTransaction(businessId, async (tx) => {
      const siblings = await tx.pageSection.findMany({ where: { pageId: section.pageId, businessId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
      const copy = await tx.pageSection.create({ data: { businessId, pageId: section.pageId, type: section.type, sortOrder: section.sortOrder + 1, props: toJson(section.props), settings: toJson(section.settings), isHidden: section.isHidden } });
      const order = siblings.map((s) => s.id);
      order.splice(order.indexOf(section.id) + 1, 0, copy.id);
      await Promise.all(order.map((id, i) => tx.pageSection.update({ where: { id }, data: { sortOrder: i } })));
      await tx.page.update({ where: { id: section.pageId }, data: { updatedByUserId: ctx.user.id } });
      return tx.pageSection.findMany({ where: { pageId: section.pageId, businessId }, orderBy: { sortOrder: "asc" } });
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "section.duplicated", entityType: "page_section", entityId: section.id, metadata: { pageId: section.pageId, type: section.type } });
    revalidatePath(pagePath(businessId, section.pageId));
    return ok(rows.map(toSectionView), "Section duplicated");
  });
}

export async function toggleSectionHidden(businessId: string, sectionId: string, hidden?: boolean): Promise<ActionResult<SectionView>> {
  return runAction(async () => {
    const { ctx, section } = await loadSection(businessId, sectionId);
    const isHidden = hidden ?? !section.isHidden;
    const updated = await ctx.db.pageSection.update({ where: { id: section.id }, data: { isHidden } });
    await touchPage(businessId, section.pageId, ctx.user.id);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: isHidden ? "section.hidden" : "section.shown", entityType: "page_section", entityId: section.id, metadata: { pageId: section.pageId } });
    revalidatePath(pagePath(businessId, section.pageId));
    return ok(toSectionView(updated), isHidden ? "Section hidden" : "Section visible");
  });
}

/**
 * Removes a section from the draft. Drafts are working copies: every publish
 * is kept as a revision, so a deleted section can be recovered from History.
 */
export async function deleteSection(businessId: string, sectionId: string): Promise<ActionResult<SectionView[]>> {
  return runAction(async () => {
    const { ctx, section } = await loadSection(businessId, sectionId);
    const rows = await withTenantTransaction(businessId, async (tx) => {
      await tx.pageSection.delete({ where: { id: section.id } });
      const rest = await tx.pageSection.findMany({ where: { pageId: section.pageId, businessId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
      await Promise.all(rest.map((s, i) => tx.pageSection.update({ where: { id: s.id }, data: { sortOrder: i } })));
      await tx.page.update({ where: { id: section.pageId }, data: { updatedByUserId: ctx.user.id } });
      return tx.pageSection.findMany({ where: { pageId: section.pageId, businessId }, orderBy: { sortOrder: "asc" } });
    });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "section.deleted", entityType: "page_section", entityId: section.id, before: { type: section.type, props: section.props, settings: section.settings, sortOrder: section.sortOrder }, metadata: { pageId: section.pageId } });
    revalidatePath(pagePath(businessId, section.pageId));
    return ok(rows.map(toSectionView), "Section deleted");
  });
}

/** Lists the draft sections of a page (used by the live editor to refresh). */
export async function listSections(businessId: string, pageId: string): Promise<ActionResult<SectionView[]>> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const rows = await ctx.db.pageSection.findMany({ where: { pageId: uuid.parse(pageId), businessId }, orderBy: { sortOrder: "asc" } });
    return ok(rows.map(toSectionView));
  });
}
