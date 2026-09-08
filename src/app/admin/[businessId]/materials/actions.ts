"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/authz";
import { formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { isUuid } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { MaterialInputSchema, MaterialReorderSchema, archiveMaterial, createMaterial, reorderMaterials, restoreMaterial, setMaterialActive, updateMaterial } from "@/lib/content/materials";

const base = (b: string) => `/admin/${b}/materials`;
function idOf(v: unknown, what: string): string {
  const s = str(v);
  if (!isUuid(s)) throw new z.ZodError([{ code: "custom", path: [what], message: `Invalid ${what}.` }]);
  return s;
}

export async function saveMaterialAction(_prev: ActionResult<{ id: string; created: boolean }> | undefined, formData: FormData): Promise<ActionResult<{ id: string; created: boolean }>> {
  return runAction<{ id: string; created: boolean }>(async () => {
    const businessId = idOf(formData.get("businessId"), "business");
    const ctx = await requireBusinessAccess(businessId, "services.manage", { throwOnly: true });
    const obj = formToObject(formData);
    const materialId = str(obj.materialId) ? idOf(obj.materialId, "material") : null;
    const input = MaterialInputSchema.parse({ ...obj, serviceIds: obj["serviceIds[]"] ?? obj.serviceIds ?? [] });
    if (!materialId) {
      const m = await createMaterial(ctx.db, businessId, input);
      await recordAudit({ actorUserId: ctx.user.id, businessId, action: "material.created", entityType: "material", entityId: m.id, after: m });
      revalidatePath(base(businessId));
      return ok({ id: m.id, created: true }, "Material added.");
    }
    const { before, after } = await updateMaterial(ctx.db, businessId, materialId, input);
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "material.updated", entityType: "material", entityId: materialId, before, after });
    revalidatePath(base(businessId));
    revalidatePath(`${base(businessId)}/${materialId}`);
    return ok({ id: materialId, created: false }, "Saved.");
  });
}

export async function materialStateAction(businessId: string, materialId: string, state: "activate" | "deactivate" | "archive" | "restore"): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "services.manage", { throwOnly: true });
    const id = idOf(materialId, "material");
    if (state === "archive") await archiveMaterial(ctx.db, businessId, id);
    else if (state === "restore") await restoreMaterial(ctx.db, businessId, id);
    else await setMaterialActive(ctx.db, businessId, id, state === "activate");
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: `material.${state}`, entityType: "material", entityId: id });
    revalidatePath(base(businessId));
    return ok(undefined, { activate: "Material is active.", deactivate: "Material is inactive.", archive: "Archived.", restore: "Restored." }[state]);
  });
}

export async function reorderMaterialsAction(businessId: string, items: Array<{ id: string; sortOrder: number }>): Promise<ActionResult<{ count: number }>> {
  return runAction<{ count: number }>(async () => {
    const ctx = await requireBusinessAccess(businessId, "services.manage", { throwOnly: true });
    const count = await reorderMaterials(ctx.db, businessId, MaterialReorderSchema.parse(items));
    revalidatePath(base(businessId));
    return ok({ count });
  });
}
