"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { bool, fail, formToObject, num, ok, optStr, runAction, str, type ActionResult } from "@/lib/actions";
import { publishBusiness, publishNavigation, publishPage, restorePageRevision, unpublishBusiness, unpublishPage } from "@/lib/business/publish";
import { recordAudit } from "@/lib/audit";
import {
  CreatePageSchema,
  UpdatePageSettingsSchema,
  PageError,
  archivePage,
  cancelSchedule,
  createPage,
  duplicatePage,
  restorePage,
  schedulePage,
  updatePageSeo,
  updatePageSettings,
} from "@/lib/website/pages";
import { NavigationError, saveMenuDraft } from "@/lib/website/navigation";
import { RedirectError, RedirectSchema, SeoDefaultsSchema, createRedirect, deleteRedirect, saveSeoDefaults, setRedirectActive, updateRedirect } from "@/lib/website/seo";

/**
 * Server actions for the Website module. Every action is bound to the
 * businessId from the route (never read from the form) and starts with
 * requireBusinessAccess. Field errors from PageError / RedirectError are
 * mapped to the field that caused them.
 */
type Result<T = undefined> = Promise<ActionResult<T>>;
const uuid = z.string().uuid();

function base(businessId: string) {
  return `/admin/${businessId}/website`;
}

function revalidateWebsite(businessId: string, pageId?: string) {
  revalidatePath(base(businessId));
  revalidatePath(`${base(businessId)}/pages`);
  revalidatePath(`${base(businessId)}/seo`);
  revalidatePath(`${base(businessId)}/navigation`);
  if (pageId) {
    revalidatePath(`${base(businessId)}/pages/${pageId}`);
    revalidatePath(`${base(businessId)}/pages/${pageId}/settings`);
    revalidatePath(`${base(businessId)}/pages/${pageId}/history`);
  }
}

function fieldFail(error: unknown): ActionResult<never> | null {
  if (error instanceof PageError || error instanceof RedirectError) return fail(error.message, error.field ? { [error.field]: error.message } : undefined);
  if (error instanceof NavigationError) return fail(error.message);
  return null;
}

async function guarded<T>(fn: () => Promise<ActionResult<T>>): Result<T> {
  return runAction(async () => {
    try {
      return await fn();
    } catch (error) {
      const mapped = fieldFail(error);
      if (mapped) return mapped;
      throw error;
    }
  });
}

// ── Business-level publishing ─────────────────────────────────────────────────

export async function publishBusinessAction(businessId: string, _prev: ActionResult | undefined, _formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.publish", { throwOnly: true });
    await publishBusiness(businessId, { actorUserId: ctx.user.id });
    revalidateWebsite(businessId);
    revalidatePath(`/admin/${businessId}`, "layout");
    return ok(undefined, "Everything is published. The live site now shows your latest content.");
  });
}

export async function unpublishBusinessAction(businessId: string, _prev: ActionResult | undefined, _formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.publish", { throwOnly: true });
    await unpublishBusiness(businessId, { actorUserId: ctx.user.id });
    revalidateWebsite(businessId);
    revalidatePath(`/admin/${businessId}`, "layout");
    return ok(undefined, "The site is now offline. Visitors will see a not-found page until you publish again.");
  });
}

// ── Pages ────────────────────────────────────────────────────────────────────

export async function createPageAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const raw = formToObject(formData);
    const input = CreatePageSchema.parse({
      title: str(raw.title),
      slug: optStr(raw.slug),
      kind: str(raw.kind) || "CUSTOM",
      templateKey: str(raw.templateKey) || "default",
      audience: str(raw.audience) || "PUBLIC",
      showInNav: bool(raw.showInNav),
      parentId: optStr(raw.parentId) ?? null,
      seoTitle: optStr(raw.seoTitle),
      seoDescription: optStr(raw.seoDescription),
      starterSections: bool(raw.starterSections),
    });
    const page = await createPage(ctx.db, businessId, input, ctx.user.id);
    revalidateWebsite(businessId);
    redirect(`${base(businessId)}/pages/${page.id}`);
  });
}

export async function updatePageSettingsAction(businessId: string, pageId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const raw = formToObject(formData);
    const input = UpdatePageSettingsSchema.parse({
      title: str(raw.title),
      slug: typeof raw.slug === "string" ? raw.slug : undefined,
      templateKey: str(raw.templateKey) || "default",
      audience: str(raw.audience) || "PUBLIC",
      showInNav: bool(raw.showInNav),
      sortOrder: num(raw.sortOrder) ?? 0,
      parentId: optStr(raw.parentId) ?? null,
      seoTitle: optStr(raw.seoTitle),
      seoDescription: optStr(raw.seoDescription),
      seoNoindex: bool(raw.seoNoindex),
      seoCanonical: optStr(raw.seoCanonical),
      seoSocialImageMediaId: optStr(raw.seoSocialImageMediaId) ?? null,
      seoJsonLd: optStr(raw.seoJsonLd),
      settingsJson: optStr(raw.settingsJson),
    });
    await updatePageSettings(ctx.db, businessId, uuid.parse(pageId), input, ctx.user.id);
    revalidateWebsite(businessId, pageId);
    return ok(undefined, "Page settings saved");
  });
}

export async function publishPageAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.publish", { throwOnly: true });
    const pageId = uuid.parse(str(formData.get("pageId")));
    const page = await ctx.db.page.findFirst({ where: { id: pageId, businessId }, select: { id: true, status: true } });
    if (!page) return fail("Page not found.");
    if (page.status === "ARCHIVED") return fail("Restore the page before publishing it.");
    const { version } = await publishPage(businessId, pageId, { actorUserId: ctx.user.id, note: optStr(formData.get("note")) ?? "Published" });
    revalidateWebsite(businessId, pageId);
    return ok(undefined, `Page published (version ${version})`);
  });
}

export async function unpublishPageAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.publish", { throwOnly: true });
    const pageId = uuid.parse(str(formData.get("pageId")));
    const page = await ctx.db.page.findFirst({ where: { id: pageId, businessId }, select: { id: true, systemKey: true } });
    if (!page) return fail("Page not found.");
    if (page.systemKey === "home") return fail("The home page cannot be unpublished. Unpublish the whole site instead.");
    await unpublishPage(businessId, pageId, { actorUserId: ctx.user.id });
    revalidateWebsite(businessId, pageId);
    return ok(undefined, "Page unpublished");
  });
}

export async function schedulePageAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.publish", { throwOnly: true });
    const pageId = uuid.parse(str(formData.get("pageId")));
    const when = str(formData.get("scheduledAt"));
    const date = new Date(when);
    if (!when || Number.isNaN(date.getTime())) return fail("Enter a valid date and time.", { scheduledAt: "Enter a valid date and time." });
    await schedulePage(ctx.db, businessId, pageId, date, ctx.user.id);
    revalidateWebsite(businessId, pageId);
    return ok(undefined, "Page scheduled. It will go live automatically at the chosen time.");
  });
}

export async function cancelScheduleAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.publish", { throwOnly: true });
    const pageId = uuid.parse(str(formData.get("pageId")));
    await cancelSchedule(ctx.db, businessId, pageId, ctx.user.id);
    revalidateWebsite(businessId, pageId);
    return ok(undefined, "Schedule cancelled");
  });
}

export async function duplicatePageAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const pageId = uuid.parse(str(formData.get("pageId")));
    const copy = await duplicatePage(ctx.db, businessId, pageId, ctx.user.id);
    revalidateWebsite(businessId);
    redirect(`${base(businessId)}/pages/${copy.id}`);
  });
}

export async function archivePageAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const pageId = uuid.parse(str(formData.get("pageId")));
    await archivePage(ctx.db, businessId, pageId, ctx.user.id);
    revalidateWebsite(businessId, pageId);
    return ok(undefined, "Page archived. It is no longer visible on the site.");
  });
}

export async function restorePageAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const pageId = uuid.parse(str(formData.get("pageId")));
    await restorePage(ctx.db, businessId, pageId, ctx.user.id);
    revalidateWebsite(businessId, pageId);
    return ok(undefined, "Page restored as a draft");
  });
}

export async function restoreRevisionAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const pageId = uuid.parse(str(formData.get("pageId")));
    const version = num(formData.get("version"));
    if (!version || version < 1) return fail("Choose a version to restore.");
    const page = await ctx.db.page.findFirst({ where: { id: pageId, businessId }, select: { id: true } });
    if (!page) return fail("Page not found.");
    await restorePageRevision(businessId, pageId, version, { actorUserId: ctx.user.id });
    revalidateWebsite(businessId, pageId);
    return ok(undefined, `Version ${version} restored into the draft. Publish the page to make it live.`);
  });
}

// ── Navigation ───────────────────────────────────────────────────────────────

const MenuKeySchema = z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/);

export async function saveNavigationDraftAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const raw = formToObject(formData);
    const key = MenuKeySchema.parse(str(raw.key));
    await saveMenuDraft(ctx.db, businessId, key, raw.items, ctx.user.id);
    revalidateWebsite(businessId);
    return ok(undefined, "Draft saved. Publish navigation to update the live site.");
  });
}

export async function publishNavigationAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.publish", { throwOnly: true });
    const raw = formToObject(formData);
    // Save the menu currently being edited first so what the owner sees is what goes live.
    if (typeof raw.key === "string" && raw.key && raw.items !== undefined && raw.items !== null) {
      await saveMenuDraft(ctx.db, businessId, MenuKeySchema.parse(raw.key), raw.items, ctx.user.id);
    }
    await publishNavigation(businessId, { actorUserId: ctx.user.id });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "navigation.published", entityType: "navigation_menu", entityId: null, severity: "NOTICE" });
    revalidateWebsite(businessId);
    return ok(undefined, "Navigation published");
  });
}

// ── SEO ───────────────────────────────────────────────────────────────────────

export async function saveSeoDefaultsAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const raw = formToObject(formData);
    const sameAs = str(raw.orgSameAs)
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const input = SeoDefaultsSchema.parse({
      titleSuffix: optStr(raw.titleSuffix),
      description: optStr(raw.description),
      socialImageMediaId: optStr(raw.socialImageMediaId) ?? null,
      noindex: bool(raw.noindex),
      googleSiteVerification: optStr(raw.googleSiteVerification),
      headSnippets: optStr(raw.headSnippets),
      organization: {
        schemaType: str(raw.orgSchemaType) || "LocalBusiness",
        name: optStr(raw.orgName),
        legalName: optStr(raw.orgLegalName),
        phone: optStr(raw.orgPhone),
        email: optStr(raw.orgEmail),
        url: optStr(raw.orgUrl),
        streetAddress: optStr(raw.orgStreetAddress),
        addressLocality: optStr(raw.orgAddressLocality),
        addressRegion: optStr(raw.orgAddressRegion),
        postalCode: optStr(raw.orgPostalCode),
        addressCountry: optStr(raw.orgAddressCountry),
        priceRange: optStr(raw.orgPriceRange),
        openingHours: optStr(raw.orgOpeningHours),
        sameAs,
        logoMediaId: optStr(raw.orgLogoMediaId) ?? null,
      },
    });
    await saveSeoDefaults(businessId, input, ctx.user.id);
    revalidateWebsite(businessId);
    return ok(undefined, "SEO defaults saved");
  });
}

export async function updatePageSeoAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const pageId = uuid.parse(str(formData.get("pageId")));
    const title = optStr(formData.get("title"));
    const description = optStr(formData.get("description"));
    if (title && title.length > 160) return fail("Title is too long.", { title: "Keep it under 160 characters." });
    if (description && description.length > 400) return fail("Description is too long.", { description: "Keep it under 400 characters." });
    await updatePageSeo(ctx.db, businessId, pageId, { title, description, noindex: bool(formData.get("noindex")) }, ctx.user.id);
    revalidateWebsite(businessId, pageId);
    return ok(undefined, "Saved");
  });
}

// ── Redirects ────────────────────────────────────────────────────────────────

function redirectInput(formData: FormData) {
  return RedirectSchema.parse({
    fromPath: str(formData.get("fromPath")),
    toPath: str(formData.get("toPath")),
    statusCode: str(formData.get("statusCode")) || "301",
    isActive: formData.has("isActive") ? bool(formData.get("isActive")) : true,
  });
}

export async function createRedirectAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    await createRedirect(ctx.db, businessId, redirectInput(formData), ctx.user.id);
    revalidateWebsite(businessId);
    return ok(undefined, "Redirect added");
  });
}

export async function updateRedirectAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const id = uuid.parse(str(formData.get("id")));
    await updateRedirect(ctx.db, businessId, id, redirectInput(formData), ctx.user.id);
    revalidateWebsite(businessId);
    return ok(undefined, "Redirect saved");
  });
}

export async function toggleRedirectAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const id = uuid.parse(str(formData.get("id")));
    const row = await setRedirectActive(ctx.db, businessId, id, bool(formData.get("isActive")), ctx.user.id);
    revalidateWebsite(businessId);
    return ok(undefined, row.isActive ? "Redirect enabled" : "Redirect disabled");
  });
}

export async function deleteRedirectAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Result {
  return guarded(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const id = uuid.parse(str(formData.get("id")));
    await deleteRedirect(ctx.db, businessId, id, ctx.user.id);
    revalidateWebsite(businessId);
    return ok(undefined, "Redirect deleted");
  });
}
