"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { fail, formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { coerceFieldValues, listFieldDefinitions, saveFieldValues } from "@/lib/custom-fields";
import { toJson } from "@/lib/json";
import { AIService, AIUnavailableError } from "@/lib/ai/service";
import {
  ReorderItemSchema,
  ServiceInputSchema,
  archiveService,
  createService,
  deleteServicePermanently,
  reorderServices,
  restoreService,
  setServiceFlag,
  updateService,
  type ReorderItem,
} from "@/lib/content/services";

function revalidate(businessId: string, serviceId?: string) {
  revalidatePath(`/admin/${businessId}/services`);
  if (serviceId) revalidatePath(`/admin/${businessId}/services/${serviceId}`);
  revalidatePath(`/admin/${businessId}/projects`);
  revalidatePath(`/admin/${businessId}/materials`);
}

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}

/** Collects `cf.<key>` inputs for the SERVICE custom field definitions. */
async function collectCustomFields(db: Awaited<ReturnType<typeof requireBusinessAccess>>["db"], businessId: string, obj: Record<string, unknown>) {
  const defs = await listFieldDefinitions(db, businessId, "SERVICE");
  const raw: Record<string, unknown> = {};
  for (const d of defs) raw[d.key] = obj[`cf.${d.key}`];
  const { values, errors } = coerceFieldValues(defs, raw);
  return { defs, values, errors };
}

export async function saveServiceAction(_prev: ActionResult<{ id: string; created: boolean }> | undefined, formData: FormData): Promise<ActionResult<{ id: string; created: boolean }>> {
  return runAction<{ id: string; created: boolean }>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "services.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const serviceId = str(obj.serviceId) ? idFrom(obj.serviceId, "service") : null;
    const input = ServiceInputSchema.parse({
      ...obj,
      seo: { title: str(obj["seo.title"]) || undefined, description: str(obj["seo.description"]) || undefined, noindex: obj["seo.noindex"] === "on" || obj["seo.noindex"] === "true", socialImageId: str(obj["seo.socialImageId"]) || null },
    });
    const cf = await collectCustomFields(ctx.db, businessId, obj);
    if (Object.keys(cf.errors).length) {
      const fieldErrors: Record<string, string> = {};
      for (const [k, v] of Object.entries(cf.errors)) fieldErrors[`cf.${k}`] = v;
      return fail("Please correct the highlighted fields.", fieldErrors);
    }

    if (!serviceId) {
      const service = await createService(ctx.db, businessId, input);
      if (cf.defs.length) {
        await saveFieldValues(ctx.db, businessId, "SERVICE", service.id, cf.defs, cf.values);
        await ctx.db.service.update({ where: { id: service.id }, data: { customFields: toJson(cf.values) } });
      }
      await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service.created", entityType: "service", entityId: service.id, after: { ...service, customFields: cf.values } });
      await emitEvent({ type: "service.created", businessId, payload: { businessId, serviceId: service.id }, actorUserId: ctx.user.id });
      revalidate(businessId, service.id);
      return ok({ id: service.id, created: true }, "Service created.");
    }

    const { before, after } = await updateService(ctx.db, businessId, serviceId, input);
    let mirrored = after;
    if (cf.defs.length) {
      await saveFieldValues(ctx.db, businessId, "SERVICE", serviceId, cf.defs, cf.values);
      mirrored = await ctx.db.service.update({ where: { id: serviceId }, data: { customFields: toJson(cf.values) } });
    }
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service.updated", entityType: "service", entityId: serviceId, before, after: mirrored });
    revalidate(businessId, serviceId);
    return ok({ id: serviceId, created: false }, "Service saved.");
  });
}

const FlagSchema = z.object({ flag: z.enum(["isEnabled", "isFeatured"]), value: z.boolean() });

export async function toggleServiceFlagAction(businessId: string, serviceId: string, flag: "isEnabled" | "isFeatured", value: boolean): Promise<ActionResult> {
  return runAction(async () => {
    if (!isUuid(businessId) || !isUuid(serviceId)) throw new Error("Invalid id.");
    const ctx = await requireBusinessAccess(businessId, "services.manage", { throwOnly: true });
    const parsed = FlagSchema.parse({ flag, value });
    const { before, after } = await setServiceFlag(ctx.db, businessId, serviceId, parsed.flag, parsed.value);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: parsed.flag === "isEnabled" ? (parsed.value ? "service.enabled" : "service.disabled") : parsed.value ? "service.featured" : "service.unfeatured", entityType: "service", entityId: serviceId, before: { [parsed.flag]: before[parsed.flag] }, after: { [parsed.flag]: after[parsed.flag] } });
    revalidate(businessId, serviceId);
    return ok(undefined, "Updated.");
  });
}

export async function reorderServicesAction(businessId: string, items: ReorderItem[]): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    if (!isUuid(businessId)) throw new Error("Invalid business id.");
    const ctx = await requireBusinessAccess(businessId, "services.manage", { throwOnly: true });
    const parsed = z.array(ReorderItemSchema).max(2000).parse(items);
    const count = await reorderServices(ctx.db, businessId, parsed);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service.reordered", entityType: "service", metadata: { count } });
    revalidate(businessId);
    return ok({ count }, "Order saved.");
  });
}

export async function archiveServiceAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const serviceId = idFrom(formData.get("serviceId"), "service");
    const ctx = await requireBusinessAccess(businessId, "services.manage", { throwOnly: true });
    const row = await archiveService(ctx.db, businessId, serviceId);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service.archived", entityType: "service", entityId: serviceId, after: { deletedAt: row.deletedAt } });
    revalidate(businessId, serviceId);
    return ok(undefined, "Service archived. It no longer appears on the website.");
  });
}

export async function restoreServiceAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const serviceId = idFrom(formData.get("serviceId"), "service");
    const ctx = await requireBusinessAccess(businessId, "services.manage", { throwOnly: true });
    await restoreService(ctx.db, businessId, serviceId);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service.restored", entityType: "service", entityId: serviceId });
    revalidate(businessId, serviceId);
    return ok(undefined, "Service restored. Enable it to show it on the website again.");
  });
}

export async function deleteServiceAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const serviceId = idFrom(formData.get("serviceId"), "service");
    const ctx = await requireBusinessAccess(businessId, "services.manage", { throwOnly: true });
    const row = await deleteServicePermanently(ctx.db, businessId, serviceId);
    await ctx.db.customFieldValue.deleteMany({ where: { businessId, entityType: "SERVICE", entityId: serviceId } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service.deleted", entityType: "service", entityId: serviceId, severity: "NOTICE", before: row });
    revalidate(businessId, serviceId);
    return ok(undefined, "Service deleted permanently.");
  });
}

const DraftSchema = z.object({ name: z.string().trim().min(1).max(160), shortDescription: z.string().trim().max(400).optional(), existing: z.string().trim().max(4000).optional() });

/** Optional AI assist. Never required: the caller shows the manual path when this fails. */
export async function draftServiceDescriptionAction(businessId: string, input: { name: string; shortDescription?: string; existing?: string }): Promise<ActionResult<{ text: string }>> {
  return runAction(async () => {
    if (!isUuid(businessId)) throw new Error("Invalid business id.");
    const ctx = await requireBusinessAccess(businessId, "services.manage", { throwOnly: true });
    const parsed = DraftSchema.parse(input);
    const industry = ctx.business.industryId ? await ctx.db.industry.findUnique({ where: { id: ctx.business.industryId }, select: { name: true } }).catch(() => null) : null;
    try {
      const result = await AIService.generateText(
        {
          feature: "service.description",
          system: "You write clear, honest website copy for a local trade business. Use Markdown with short paragraphs, one or two headings and a bullet list of what's included. Do not invent prices, certifications or guarantees. Keep it under 250 words.",
          prompt: `Business: ${ctx.business.name}${industry ? ` (${industry.name})` : ""}.\nService: ${parsed.name}.\n${parsed.shortDescription ? `Summary: ${parsed.shortDescription}\n` : ""}${parsed.existing ? `Existing notes to improve:\n${parsed.existing}\n` : ""}Write the full service description.`,
          maxTokens: 700,
          temperature: 0.6,
        },
        { businessId, userId: ctx.user.id },
      );
      return ok({ text: result.text.trim() }, "Draft ready — review and edit before saving.");
    } catch (error) {
      if (error instanceof AIUnavailableError) return fail(error.message);
      throw error;
    }
  });
}
