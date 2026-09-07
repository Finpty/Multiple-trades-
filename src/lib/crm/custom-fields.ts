import { ZodError } from "zod";
import type { FieldEntityType } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { coerceFieldValues, listFieldDefinitions, type FieldDefinitionView } from "@/lib/custom-fields";

/** Collects `cf.<key>` inputs from a parsed FormData object for the given entity type and validates them. */
export async function collectCustomFields(db: TenantDb, businessId: string, entityType: FieldEntityType, obj: Record<string, unknown>): Promise<{ defs: FieldDefinitionView[]; values: Record<string, unknown> }> {
  const defs = await listFieldDefinitions(db, businessId, entityType);
  const raw: Record<string, unknown> = {};
  for (const d of defs) {
    if (`cf.${d.key}` in obj) raw[d.key] = obj[`cf.${d.key}`];
    else if (`cf.${d.key}[]` in obj) raw[d.key] = obj[`cf.${d.key}[]`];
  }
  const { values, errors } = coerceFieldValues(defs, raw);
  if (Object.keys(errors).length) throw new ZodError(Object.entries(errors).map(([k, message]) => ({ code: "custom", path: [`cf.${k}`], message })));
  return { defs, values };
}
