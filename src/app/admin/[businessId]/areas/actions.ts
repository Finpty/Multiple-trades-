"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import {
  AreaInputSchema,
  AreaReorderItemSchema,
  BulkAddSchema,
  MatrixCellSchema,
  applyMatrixCells,
  archiveArea,
  bulkAddAreas,
  createArea,
  reorderAreas,
  restoreArea,
  setAreaFlag,
  updateArea,
  type AreaFlag,
  type AreaReorderItem,
  type BulkAddResult,
  type MatrixCell,
} from "@/lib/content/areas";

function revalidate(businessId: string, areaId?: string) {
  revalidatePath(`/admin/${businessId}/areas`);
  revalidatePath(`/admin/${businessId}/areas/matrix`);
  if (areaId) revalidatePath(`/admin/${businessId}/areas/${areaId}`);
  revalidatePath(`/admin/${businessId}/services`);
  revalidatePath(`/admin/${businessId}/projects`);
}

function idFrom(value: unknown, label = "id"): string {
  const id = str(value);
  if (!isUuid(id)) throw new Error(`Invalid ${label}.`);
  return id;
}

export async function saveAreaAction(_prev: ActionResult<{ id: string; created: boolean }> | undefined, formData: FormData): Promise<ActionResult<{ id: string; created: boolean }>> {
  return runAction<{ id: string; created: boolean }>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "areas.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const areaId = str(obj.areaId) ? idFrom(obj.areaId, "area") : null;
    const input = AreaInputSchema.parse({
      ...obj,
      content: { intro: str(obj["content.intro"]), body: str(obj["content.body"]), highlights: obj["content.highlights"], faqs: obj["content.faqs"] },
      seo: { title: str(obj["seo.title"]) || undefined, description: str(obj["seo.description"]) || undefined, noindex: obj["seo.noindex"] === "on" || obj["seo.noindex"] === "true" },
    });
    if (!areaId) {
      const area = await createArea(ctx.db, businessId, input);
      await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service_area.created", entityType: "service_area", entityId: area.id, after: area });
      revalidate(businessId, area.id);
      return ok({ id: area.id, created: true }, "Service area created.");
    }
    const { before, after } = await updateArea(ctx.db, businessId, areaId, input);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service_area.updated", entityType: "service_area", entityId: areaId, before, after });
    revalidate(businessId, areaId);
    return ok({ id: areaId, created: false }, "Service area saved.");
  });
}

export async function bulkAddAreasAction(_prev: ActionResult<BulkAddResult> | undefined, formData: FormData): Promise<ActionResult<BulkAddResult>> {
  return runAction<BulkAddResult>(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "areas.manage", { throwOnly: true });
    const input = BulkAddSchema.parse(formToObject(formData));
    const result = await bulkAddAreas(ctx.db, businessId, input);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service_area.bulk_created", entityType: "service_area", metadata: { created: result.created.length, skipped: result.skipped.length, type: input.type } });
    revalidate(businessId);
    return ok(result, `${result.created.length} area${result.created.length === 1 ? "" : "s"} created, ${result.skipped.length} skipped.`);
  });
}

const FlagSchema = z.object({ flag: z.enum(["isEnabled", "generatePage", "isPrimary"]), value: z.boolean() });

export async function toggleAreaFlagAction(businessId: string, areaId: string, flag: AreaFlag, value: boolean): Promise<ActionResult> {
  return runAction(async () => {
    if (!isUuid(businessId) || !isUuid(areaId)) throw new Error("Invalid id.");
    const ctx = await requireBusinessAccess(businessId, "areas.manage", { throwOnly: true });
    const parsed = FlagSchema.parse({ flag, value });
    const { before, after } = await setAreaFlag(ctx.db, businessId, areaId, parsed.flag, parsed.value);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: `service_area.${parsed.flag}_${parsed.value ? "on" : "off"}`, entityType: "service_area", entityId: areaId, before: { [parsed.flag]: before[parsed.flag] }, after: { [parsed.flag]: after[parsed.flag] } });
    revalidate(businessId, areaId);
    return ok(undefined, "Updated.");
  });
}

export async function reorderAreasAction(businessId: string, items: AreaReorderItem[]): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    if (!isUuid(businessId)) throw new Error("Invalid business id.");
    const ctx = await requireBusinessAccess(businessId, "areas.manage", { throwOnly: true });
    const parsed = z.array(AreaReorderItemSchema).max(2000).parse(items);
    const count = await reorderAreas(ctx.db, businessId, parsed);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service_area.reordered", entityType: "service_area", metadata: { count } });
    revalidate(businessId);
    return ok({ count }, "Order saved.");
  });
}

export async function archiveAreaAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const areaId = idFrom(formData.get("areaId"), "area");
    const ctx = await requireBusinessAccess(businessId, "areas.manage", { throwOnly: true });
    const row = await archiveArea(ctx.db, businessId, areaId);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service_area.archived", entityType: "service_area", entityId: areaId, after: { deletedAt: row.deletedAt } });
    revalidate(businessId, areaId);
    return ok(undefined, "Service area archived.");
  });
}

export async function restoreAreaAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const businessId = idFrom(formData.get("businessId"), "business");
    const areaId = idFrom(formData.get("areaId"), "area");
    const ctx = await requireBusinessAccess(businessId, "areas.manage", { throwOnly: true });
    await restoreArea(ctx.db, businessId, areaId);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service_area.restored", entityType: "service_area", entityId: areaId });
    revalidate(businessId, areaId);
    return ok(undefined, "Service area restored.");
  });
}

export async function saveMatrixAction(businessId: string, cells: MatrixCell[]): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    if (!isUuid(businessId)) throw new Error("Invalid business id.");
    const ctx = await requireBusinessAccess(businessId, "areas.manage", { throwOnly: true });
    const parsed = z.array(MatrixCellSchema).max(20_000).parse(cells);
    const count = await applyMatrixCells(ctx.db, businessId, parsed);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "service_area.matrix_updated", entityType: "service_area", metadata: { count } });
    revalidate(businessId);
    return ok({ count }, `${count} change${count === 1 ? "" : "s"} saved.`);
  });
}
