"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FieldEntityType } from "@prisma/client";
import { requireBusinessAccess } from "@/lib/authz";
import { bool, fail, formToObject, ok, runAction, str, type ActionResult } from "@/lib/actions";
import { recordAudit } from "@/lib/audit";
import { toJson } from "@/lib/json";
import { isUuid } from "@/lib/ids";

const ENTITY_TYPES = ["BUSINESS", "SERVICE", "PROJECT", "CUSTOMER", "LEAD", "QUOTE", "ESTIMATE", "JOB"] as const;

const DefinitionSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  key: z.string().trim().min(1).max(60).regex(/^[a-z0-9_]+$/, "snake_case"),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["TEXT", "TEXTAREA", "RICHTEXT", "NUMBER", "MEASUREMENT", "SELECT", "MULTISELECT", "BOOLEAN", "DATE", "TIME", "EMAIL", "PHONE", "URL", "MEDIA", "ADDRESS"]),
  options: z.array(z.object({ value: z.string().max(80), label: z.string().max(120) })).default([]),
  isRequired: z.boolean().default(false),
  helpText: z.string().trim().max(300).optional(),
  groupName: z.string().trim().max(60).optional(),
  defaultValue: z.string().max(500).optional(),
  unit: z.string().trim().max(20).optional(),
  min: z.coerce.number().optional().or(z.literal("")),
  max: z.coerce.number().optional().or(z.literal("")),
  showOnForms: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export async function saveDefinitionAction(businessId: string, definitionId: string | null, _prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    const o = formToObject(formData);
    const input = DefinitionSchema.parse({ ...o, options: Array.isArray(o.options) ? o.options : [], isRequired: bool(o.isRequired), showOnForms: bool(o.showOnForms), isActive: o.isActive === undefined ? true : bool(o.isActive), min: str(o.min) === "" ? "" : o.min, max: str(o.max) === "" ? "" : o.max });
    const dupe = await ctx.db.customFieldDefinition.findFirst({ where: { businessId, entityType: input.entityType, key: input.key, deletedAt: undefined, ...(definitionId ? { id: { not: definitionId } } : {}) }, select: { id: true } });
    if (dupe) return fail("Please correct the highlighted fields.", { key: "This key already exists for this entity." });
    const validation = { ...(input.unit ? { unit: input.unit } : {}), ...(typeof input.min === "number" ? { min: input.min } : {}), ...(typeof input.max === "number" ? { max: input.max } : {}) };
    const data = { businessId, entityType: input.entityType as FieldEntityType, key: input.key, label: input.label, type: input.type, options: toJson(input.type === "SELECT" || input.type === "MULTISELECT" ? input.options.filter((x) => x.value) : []), isRequired: input.isRequired, helpText: input.helpText || null, groupName: input.groupName || null, defaultValue: input.defaultValue ? toJson(input.defaultValue) : undefined, validation: toJson(validation), showOnForms: input.showOnForms, isActive: input.isActive };
    const row = definitionId && isUuid(definitionId)
      ? await ctx.db.customFieldDefinition.update({ where: { id: definitionId }, data })
      : await ctx.db.customFieldDefinition.create({ data: { ...data, sortOrder: await ctx.db.customFieldDefinition.count({ where: { businessId, entityType: input.entityType } }) } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: definitionId ? "custom_field.updated" : "custom_field.created", entityType: "custom_field_definition", entityId: row.id, after: { entityType: row.entityType, key: row.key, type: row.type } });
    revalidatePath(`/admin/${businessId}/custom-fields`);
    return ok(undefined, "Field saved");
  });
}

export async function reorderDefinitionsAction(businessId: string, ids: string[]): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    await Promise.all(ids.filter(isUuid).map((id, i) => ctx.db.customFieldDefinition.updateMany({ where: { id, businessId }, data: { sortOrder: i } })));
    revalidatePath(`/admin/${businessId}/custom-fields`);
    return ok(undefined);
  });
}

export async function archiveDefinitionAction(businessId: string, definitionId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireBusinessAccess(businessId, "business.settings", { throwOnly: true });
    await ctx.db.customFieldDefinition.update({ where: { id: definitionId }, data: { deletedAt: new Date(), isActive: false } });
    await recordAudit({ actorUserId: ctx.user.id, businessId, action: "custom_field.archived", entityType: "custom_field_definition", entityId: definitionId });
    revalidatePath(`/admin/${businessId}/custom-fields`);
    return ok(undefined, "Field archived");
  });
}
