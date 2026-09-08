"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessAccess } from "@/lib/authz";
import { bool, fail, formToObject, num, ok, optStr, runAction, str, type ActionResult } from "@/lib/actions";
import { CreatePageSchema, UpdatePageSettingsSchema, archivePage, cancelSchedule, createPage, duplicatePage, listPageRevisions, restorePage, schedulePage, updatePageSeo, updatePageSettings } from "@/lib/website/pages";
import { addSection, deleteSection, duplicateSection, listSections, reorderSections, toggleSectionHidden, updateSection } from "@/lib/website/sections";
import { publishBusiness, publishNavigation, publishPage, restorePageRevision, unpublishPage } from "@/lib/business/publish";
import { NavItemsSchema, saveMenuDraft } from "@/lib/website/navigation";
import { RedirectSchema, SeoDefaultsSchema, createRedirect, deleteRedirect, saveSeoDefaults, setRedirectActive, updateRedirect } from "@/lib/website/seo";
import { isUuid } from "@/lib/ids";
import { restoreThemeRevision, saveThemeDraft } from "@/lib/website/theme";
import { publishTheme } from "@/lib/business/publish";

const wp = (b: string) => `/admin/${b}/website`;

/* ── pages ─────────────────────────────────────────────────────────────────── */

export async function createPageAction(businessId: string, _prev: ActionResult<{ id: string }> | undefined, formData: FormData): Promise<ActionResult<{ id: string }>> {
  let id: string | null = null;
  const r = await runAction<{ id: string }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const o = formToObject(formData);
    const input = CreatePageSchema.parse({ ...o, showInNav: bool(o.showInNav), starterSections: o.starterSections === undefined ? true : bool(o.starterSections), parentId: str(o.parentId) || null, slug: optStr(o.slug), seoTitle: optStr(o.seoTitle), seoDescription: optStr(o.seoDescription) });
    const page = await createPage(ctx.db, businessId, input, ctx.user.id);
    id = page.id;
    revalidatePath(wp(businessId), "layout");
    return ok({ id: page.id });
  });
  if (r.ok && id) redirect(`${wp(businessId)}/pages/${id}`);
  return r;
}

export async function updatePageSettingsAction(businessId: string, pageId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const o = formToObject(formData);
    const input = UpdatePageSettingsSchema.parse({ ...o, showInNav: bool(o.showInNav), seoNoindex: bool(o.seoNoindex), sortOrder: num(o.sortOrder) ?? 0, parentId: str(o.parentId) || null, slug: optStr(o.slug), seoTitle: optStr(o.seoTitle), seoDescription: optStr(o.seoDescription), seoCanonical: optStr(o.seoCanonical), seoSocialImageMediaId: str(o.seoSocialImageMediaId) || null, seoJsonLd: optStr(o.seoJsonLd), settingsJson: optStr(o.settingsJson) });
    await updatePageSettings(ctx.db, businessId, pageId, input, ctx.user.id);
    revalidatePath(wp(businessId), "layout");
    return ok(undefined, "Page settings saved");
  });
}

export async function pageLifecycleAction(businessId: string, pageId: string, action: "publish" | "unpublish" | "duplicate" | "archive" | "restore" | "cancelSchedule"): Promise<ActionResult<{ id?: string }>> {
  return runAction<{ id?: string }>(async () => {
    const ctx = await requireBusinessAccess(businessId, action === "publish" || action === "unpublish" ? "website.publish" : "website.edit", { throwOnly: true });
    switch (action) {
      case "publish": await publishPage(businessId, pageId, { actorUserId: ctx.user.id }); break;
      case "unpublish": await unpublishPage(businessId, pageId, { actorUserId: ctx.user.id }); break;
      case "duplicate": { const p = await duplicatePage(ctx.db, businessId, pageId, ctx.user.id); revalidatePath(wp(businessId), "layout"); return ok({ id: p.id }, "Page duplicated"); }
      case "archive": await archivePage(ctx.db, businessId, pageId, ctx.user.id); break;
      case "restore": await restorePage(ctx.db, businessId, pageId, ctx.user.id); break;
      case "cancelSchedule": await cancelSchedule(ctx.db, businessId, pageId, ctx.user.id); break;
    }
    revalidatePath(wp(businessId), "layout");
    return ok({}, { publish: "Page published", unpublish: "Page unpublished", archive: "Page archived", restore: "Page restored", cancelSchedule: "Schedule cancelled", duplicate: "" }[action]);
  });
}

export async function schedulePageAction(businessId: string, pageId: string, isoDate: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.publish", { throwOnly: true });
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) return fail("Choose a date and time in the future.");
    await schedulePage(ctx.db, businessId, pageId, d, ctx.user.id);
    revalidatePath(wp(businessId), "layout");
    return ok(undefined, `Scheduled for ${d.toLocaleString()}`);
  });
}

export async function restoreRevisionAction(businessId: string, pageId: string, version: number): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    await restorePageRevision(businessId, pageId, version, { actorUserId: ctx.user.id });
    revalidatePath(wp(businessId), "layout");
    return ok(undefined, `Restored version ${version} into the draft. Publish to make it live.`);
  });
}

export async function quickSeoAction(businessId: string, pageId: string, patch: { title?: string; description?: string; noindex?: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    await updatePageSeo(ctx.db, businessId, pageId, patch, ctx.user.id);
    revalidatePath(`${wp(businessId)}/seo`);
    return ok(undefined, "Saved");
  });
}

export async function publishAllAction(businessId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.publish", { throwOnly: true });
    await publishBusiness(businessId, { actorUserId: ctx.user.id });
    revalidatePath(`/admin/${businessId}`, "layout");
    return ok(undefined, "Website published");
  });
}

export async function listRevisionsAction(businessId: string, pageId: string) {
  const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
  return listPageRevisions(ctx.db, businessId, pageId);
}

/* ── sections (lib functions already authorise; re-exported here as server actions) ── */

export const listSectionsAction = listSections;
export const addSectionAction = addSection;
export const updateSectionAction = updateSection;
export const reorderSectionsAction = reorderSections;
export const duplicateSectionAction = duplicateSection;
export const toggleSectionHiddenAction = toggleSectionHidden;
export const deleteSectionAction = deleteSection;

/* ── navigation ─────────────────────────────────────────────────────────── */

export async function saveMenuAction(businessId: string, key: string, items: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const parsed = NavItemsSchema.parse(items);
    await saveMenuDraft(ctx.db, businessId, key, parsed, ctx.user.id);
    revalidatePath(`${wp(businessId)}/navigation`);
    return ok(undefined, "Menu saved");
  });
}

export async function publishNavigationAction(businessId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.publish", { throwOnly: true });
    await publishNavigation(businessId, { actorUserId: ctx.user.id });
    revalidatePath(`${wp(businessId)}/navigation`);
    return ok(undefined, "Navigation published");
  });
}

/* ── SEO ─────────────────────────────────────────────────────────────────── */

export async function saveSeoDefaultsAction(businessId: string, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const o = formToObject(formData);
    const org: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) if (k.startsWith("organization.") && str(v)) org[k.slice(13)] = str(v);
    const input = SeoDefaultsSchema.parse({ titleSuffix: optStr(o.titleSuffix), description: optStr(o.description), socialImageMediaId: str(o.socialImageMediaId) || null, noindex: bool(o.noindex), googleSiteVerification: optStr(o.googleSiteVerification), headSnippets: optStr(o.headSnippets), organization: Object.keys(org).length ? org : undefined });
    await saveSeoDefaults(businessId, input, ctx.user.id);
    revalidatePath(`${wp(businessId)}/seo`);
    return ok(undefined, "SEO defaults saved");
  });
}

export async function saveRedirectAction(businessId: string, redirectId: string | null, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    const o = formToObject(formData);
    const input = RedirectSchema.parse({ ...o, statusCode: num(o.statusCode) ?? 301, isActive: o.isActive === undefined ? true : bool(o.isActive) });
    if (redirectId && isUuid(redirectId)) await updateRedirect(ctx.db, businessId, redirectId, input, ctx.user.id);
    else await createRedirect(ctx.db, businessId, input, ctx.user.id);
    revalidatePath(`${wp(businessId)}/seo`);
    return ok(undefined, "Redirect saved");
  });
}

export async function redirectStateAction(businessId: string, redirectId: string, action: "enable" | "disable" | "delete"): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    if (action === "delete") await deleteRedirect(ctx.db, businessId, redirectId, ctx.user.id);
    else await setRedirectActive(ctx.db, businessId, redirectId, action === "enable", ctx.user.id);
    revalidatePath(`${wp(businessId)}/seo`);
    return ok(undefined);
  });
}

/* ── brand & theme ─────────────────────────────────────────────────────────── */

export async function saveThemeAction(businessId: string, input: { tokens: unknown; designFamilyId?: string | null }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    await saveThemeDraft(ctx.db, businessId, input, ctx.user.id);
    revalidatePath(wp(businessId), "layout");
    return ok(undefined, "Theme draft saved");
  });
}

export async function publishThemeAction(businessId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.publish", { throwOnly: true });
    await publishTheme(businessId, { actorUserId: ctx.user.id });
    revalidatePath(wp(businessId), "layout");
    return ok(undefined, "Theme published");
  });
}

export async function restoreThemeRevisionAction(businessId: string, version: number): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "website.edit", { throwOnly: true });
    await restoreThemeRevision(businessId, Math.trunc(version), { actorUserId: ctx.user.id });
    revalidatePath(wp(businessId), "layout");
    return ok(undefined, `Restored theme version ${version} into the draft. Publish to make it live.`);
  });
}
