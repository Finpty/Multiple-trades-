import { Prisma } from "@prisma/client";
import { platformDb, tenantDb, withTenantTransaction } from "@/lib/db";
import { emitEvent, flushEvents } from "@/lib/events";
import { recordAudit } from "@/lib/audit";
import { toJson } from "@/lib/json";
import type { PublishedPageSnapshot } from "@/lib/blocks/schema";

/**
 * Publishing pipeline. Draft state (page_sections, theme.draft, menu.draft)
 * is snapshotted into immutable published JSON that the public site renders.
 * Every publish creates a Revision so any version can be restored.
 */
async function nextRevisionVersion(tx: Prisma.TransactionClient, businessId: string, entityType: "PAGE" | "THEME" | "NAVIGATION", entityId: string): Promise<number> {
  const last = await tx.revision.findFirst({ where: { businessId, entityType, entityId }, orderBy: { version: "desc" }, select: { version: true } });
  return (last?.version ?? 0) + 1;
}

export async function buildPageSnapshot(tx: Prisma.TransactionClient, pageId: string, version: number): Promise<PublishedPageSnapshot> {
  const page = await tx.page.findUniqueOrThrow({ where: { id: pageId }, include: { sections: { orderBy: { sortOrder: "asc" } } } });
  return {
    title: page.title,
    seo: page.seo as Record<string, unknown>,
    settings: page.settings as Record<string, unknown>,
    sections: page.sections.map((s) => ({ id: s.id, type: s.type, props: s.props as Record<string, unknown>, settings: s.settings as Record<string, unknown>, isHidden: s.isHidden })),
    version,
    publishedAt: new Date().toISOString(),
  };
}

export async function publishPage(businessId: string, pageId: string, ctx: { actorUserId: string | null; note?: string }) {
  const eventIds: string[] = [];
  const result = await withTenantTransaction(businessId, async (tx) => {
    const version = await nextRevisionVersion(tx, businessId, "PAGE", pageId);
    const snapshot = await buildPageSnapshot(tx, pageId, version);
    await tx.revision.create({ data: { businessId, entityType: "PAGE", entityId: pageId, version, snapshot: toJson(snapshot), note: ctx.note ?? "Published", createdByUserId: ctx.actorUserId } });
    const page = await tx.page.update({ where: { id: pageId }, data: { published: toJson(snapshot), publishedAt: new Date(), status: "PUBLISHED", scheduledAt: null, updatedByUserId: ctx.actorUserId } });
    eventIds.push(await emitEvent({ type: "page.published", businessId, payload: { businessId, pageId, slug: page.slug, version }, actorUserId: ctx.actorUserId }, tx));
    return { page, version };
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "page.published", entityType: "page", entityId: pageId, metadata: { version: result.version } });
  await flushEvents(eventIds);
  return result;
}

export async function unpublishPage(businessId: string, pageId: string, ctx: { actorUserId: string | null }) {
  const db = tenantDb(businessId);
  const page = await db.page.update({ where: { id: pageId }, data: { status: "DRAFT", published: Prisma.DbNull, updatedByUserId: ctx.actorUserId } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "page.unpublished", entityType: "page", entityId: pageId });
  return page;
}

/** Restores a page's draft sections from a revision (does not publish). */
export async function restorePageRevision(businessId: string, pageId: string, version: number, ctx: { actorUserId: string | null }) {
  await withTenantTransaction(businessId, async (tx) => {
    const revision = await tx.revision.findUniqueOrThrow({ where: { businessId_entityType_entityId_version: { businessId, entityType: "PAGE", entityId: pageId, version } } });
    const snapshot = revision.snapshot as unknown as PublishedPageSnapshot;
    // Save current draft as a revision before overwriting so restore itself is reversible.
    const current = await buildPageSnapshot(tx, pageId, await nextRevisionVersion(tx, businessId, "PAGE", pageId));
    await tx.revision.create({ data: { businessId, entityType: "PAGE", entityId: pageId, version: current.version, snapshot: toJson(current), note: `Auto-saved before restoring v${version}`, createdByUserId: ctx.actorUserId } });
    await tx.pageSection.deleteMany({ where: { pageId } });
    if (snapshot.sections.length) {
      await tx.pageSection.createMany({ data: snapshot.sections.map((s, i) => ({ businessId, pageId, type: s.type, sortOrder: i, props: toJson(s.props), settings: toJson(s.settings), isHidden: s.isHidden })) });
    }
    await tx.page.update({ where: { id: pageId }, data: { title: snapshot.title, seo: toJson(snapshot.seo), settings: toJson(snapshot.settings), updatedByUserId: ctx.actorUserId } });
    await emitEvent({ type: "page.restored", businessId, payload: { businessId, pageId, version }, actorUserId: ctx.actorUserId }, tx);
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "page.restored", entityType: "page", entityId: pageId, metadata: { version } });
}

export async function publishTheme(businessId: string, ctx: { actorUserId: string | null }) {
  await withTenantTransaction(businessId, async (tx) => {
    const theme = await tx.businessTheme.findUniqueOrThrow({ where: { businessId } });
    const version = await nextRevisionVersion(tx, businessId, "THEME", theme.id);
    await tx.revision.create({ data: { businessId, entityType: "THEME", entityId: theme.id, version, snapshot: toJson(theme.draft), note: "Published", createdByUserId: ctx.actorUserId } });
    await tx.businessTheme.update({ where: { businessId }, data: { published: toJson(theme.draft), publishedAt: new Date() } });
    await emitEvent({ type: "theme.published", businessId, payload: { businessId }, actorUserId: ctx.actorUserId }, tx);
  });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "theme.published", entityType: "theme", entityId: businessId });
}

export async function publishNavigation(businessId: string, ctx: { actorUserId: string | null }) {
  await withTenantTransaction(businessId, async (tx) => {
    const menus = await tx.navigationMenu.findMany({ where: { businessId } });
    for (const menu of menus) {
      const version = await nextRevisionVersion(tx, businessId, "NAVIGATION", menu.id);
      await tx.revision.create({ data: { businessId, entityType: "NAVIGATION", entityId: menu.id, version, snapshot: toJson(menu.draft), note: "Published", createdByUserId: ctx.actorUserId } });
      await tx.navigationMenu.update({ where: { id: menu.id }, data: { published: toJson(menu.draft), publishedAt: new Date() } });
    }
  });
}

/**
 * PUBLISH BUSINESS: publishes every non-archived page, the theme and the
 * navigation, then flips the business to PUBLISHED. Safe to re-run.
 */
export async function publishBusiness(businessId: string, ctx: { actorUserId: string | null }) {
  const db = tenantDb(businessId);
  const pages = await db.page.findMany({ where: { businessId, status: { not: "ARCHIVED" } }, select: { id: true } });
  for (const p of pages) await publishPage(businessId, p.id, { actorUserId: ctx.actorUserId, note: "Business publish" });
  await publishTheme(businessId, ctx);
  await publishNavigation(businessId, ctx);
  const business = await platformDb.business.update({ where: { id: businessId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, organizationId: business.organizationId, action: "business.published", entityType: "business", entityId: businessId, severity: "NOTICE", metadata: { pageCount: pages.length } });
  await emitEvent({ type: "business.published", businessId, organizationId: business.organizationId, payload: { businessId, pageCount: pages.length }, actorUserId: ctx.actorUserId });
  return business;
}

export async function unpublishBusiness(businessId: string, ctx: { actorUserId: string | null }) {
  const business = await platformDb.business.update({ where: { id: businessId }, data: { status: "DRAFT" } });
  await recordAudit({ actorUserId: ctx.actorUserId, businessId, action: "business.unpublished", entityType: "business", entityId: businessId, severity: "NOTICE" });
  await emitEvent({ type: "business.unpublished", businessId, payload: { businessId }, actorUserId: ctx.actorUserId });
  return business;
}
