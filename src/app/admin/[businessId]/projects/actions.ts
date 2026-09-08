"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { fail, formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { toJson } from "@/lib/json";
import { collectCustomFields } from "@/lib/crm/custom-fields";
import { saveFieldValues } from "@/lib/custom-fields";
import { ProjectInputSchema, ProjectReorderSchema, addTestimonialAsReview, createProject, deleteProject, reorderProjects, restoreProject, setProjectFlag, setProjectStatus, updateProject } from "@/lib/content/projects";

const base = (businessId: string) => `/admin/${businessId}/projects`;
function revalidate(businessId: string, id?: string) {
  revalidatePath(base(businessId));
  if (id) revalidatePath(`${base(businessId)}/${id}`);
}
function idOf(v: unknown, what: string): string {
  const s = str(v);
  if (!isUuid(s)) throw new z.ZodError([{ code: "custom", path: [what], message: `Invalid ${what}.` }]);
  return s;
}

/** Create or update a project. Media rows come in as `media:json`, materials as `materials:json`, services as `serviceIds[]`. */
export async function saveProjectAction(_prev: ActionResult<{ id: string; created: boolean }> | undefined, formData: FormData): Promise<ActionResult<{ id: string; created: boolean }>> {
  return runAction<{ id: string; created: boolean }>(async () => {
    const businessId = idOf(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "projects.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const projectId = str(obj.projectId) ? idOf(obj.projectId, "project") : null;
    const input = ProjectInputSchema.parse({
      ...obj,
      serviceIds: obj["serviceIds[]"] ?? obj.serviceIds ?? [],
      seo: { title: str(obj["seo.title"]) || undefined, description: str(obj["seo.description"]) || undefined, noindex: obj["seo.noindex"] === "on" || obj["seo.noindex"] === "true", socialImageId: str(obj["seo.socialImageId"]) || null },
    });
    const cf = await collectCustomFields(ctx.db, businessId, "PROJECT", obj);

    if (!projectId) {
      const project = await createProject(ctx.db, businessId, input);
      if (cf.defs.length) {
        await saveFieldValues(ctx.db, businessId, "PROJECT", project.id, cf.defs, cf.values);
        await ctx.db.project.update({ where: { id: project.id }, data: { customFields: toJson(cf.values) } });
      }
      await recordAudit({ actorUserId: ctx.user.id, businessId, action: "project.created", entityType: "project", entityId: project.id, after: { ...project, customFields: cf.values } });
      await emitEvent({ type: "project.created", businessId, payload: { businessId, projectId: project.id }, actorUserId: ctx.user.id });
      revalidate(businessId, project.id);
      return ok({ id: project.id, created: true }, "Project created.");
    }

    const { before, after } = await updateProject(ctx.db, businessId, projectId, input);
    let mirrored = after;
    if (cf.defs.length) {
      await saveFieldValues(ctx.db, businessId, "PROJECT", projectId, cf.defs, cf.values);
      mirrored = await ctx.db.project.update({ where: { id: projectId }, data: { customFields: toJson(cf.values) } });
    }
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "project.updated", entityType: "project", entityId: projectId, before, after: mirrored });
    revalidate(businessId, projectId);
    return ok({ id: projectId, created: false }, "Project saved.");
  });
}

export async function setProjectStatusAction(businessId: string, projectId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED"): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "projects.manage", { throwOnly: true });
    const { before, after } = await setProjectStatus(ctx.db, businessId, idOf(projectId, "project"), status);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "project.status_changed", entityType: "project", entityId: projectId, before: { status: before.status }, after: { status: after.status } });
    revalidate(businessId, projectId);
    return ok(undefined, `Project ${status.toLowerCase()}.`);
  });
}

export async function setProjectFeaturedAction(businessId: string, projectId: string, value: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "projects.manage", { throwOnly: true });
    const { before, after } = await setProjectFlag(ctx.db, businessId, idOf(projectId, "project"), "isFeatured", value);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "project.updated", entityType: "project", entityId: projectId, before: { isFeatured: before.isFeatured }, after: { isFeatured: after.isFeatured } });
    revalidate(businessId, projectId);
    return ok(undefined, value ? "Marked as featured." : "Removed from featured.");
  });
}

export async function deleteProjectAction(businessId: string, projectId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "projects.manage", { throwOnly: true });
    const project = await deleteProject(ctx.db, businessId, idOf(projectId, "project"));
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "project.deleted", entityType: "project", entityId: projectId, before: project });
    revalidate(businessId, projectId);
    return ok(undefined, "Project moved to the bin. It can be restored from the Deleted filter.");
  });
}

export async function restoreProjectAction(businessId: string, projectId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "projects.manage", { throwOnly: true });
    await restoreProject(ctx.db, businessId, idOf(projectId, "project"));
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "project.restored", entityType: "project", entityId: projectId });
    revalidate(businessId, projectId);
    return ok(undefined, "Project restored.");
  });
}

export async function reorderProjectsAction(businessId: string, items: Array<{ id: string; sortOrder: number }>): Promise<ActionResult<{ count: number }>> {
  return runAction<{ count: number }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "projects.manage", { throwOnly: true });
    const count = await reorderProjects(ctx.db, businessId, ProjectReorderSchema.parse(items));
    revalidate(businessId);
    return ok({ count });
  });
}

export async function testimonialToReviewAction(businessId: string, projectId: string, input: { testimonial: string; author: string; rating?: number }): Promise<ActionResult<{ reviewId: string | null }>> {
  return runAction<{ reviewId: string | null }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "projects.manage", { throwOnly: true });
    const r = await addTestimonialAsReview(ctx.db, businessId, { projectId: idOf(projectId, "project"), testimonial: input.testimonial, author: input.author, rating: input.rating });
    if (r.duplicate) return fail("This testimonial is already saved as a review.");
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "review.created", entityType: "review", entityId: r.review!.id, after: r.review });
    revalidatePath(`/admin/${businessId}/reviews`);
    return ok({ reviewId: r.review?.id ?? null }, "Saved as a review. It appears in Reviews and on the website.");
  });
}
