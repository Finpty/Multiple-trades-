import type { CustomFieldDefinition, FieldEntityType, Prisma } from "@prisma/client";
import { z } from "zod";
import type { TenantDb } from "@/lib/db";
import { toJson } from "@/lib/json";

/**
 * Custom fields engine. Definitions are rows (managed in the business admin
 * or seeded from the industry); values are stored per entity in
 * custom_field_values and mirrored into the entity's `customFields` jsonb for
 * cheap reads.
 */
export type FieldOption = { value: string; label: string };

export interface FieldDefinitionView {
  id: string;
  key: string;
  label: string;
  type: CustomFieldDefinition["type"];
  options: FieldOption[];
  isRequired: boolean;
  helpText: string | null;
  groupName: string | null;
  defaultValue: unknown;
  validation: { unit?: string; min?: number; max?: number; pattern?: string };
  showOnForms: boolean;
  sortOrder: number;
}

export function toFieldView(d: CustomFieldDefinition): FieldDefinitionView {
  return {
    id: d.id,
    key: d.key,
    label: d.label,
    type: d.type,
    options: Array.isArray(d.options) ? (d.options as unknown as FieldOption[]) : [],
    isRequired: d.isRequired,
    helpText: d.helpText,
    groupName: d.groupName,
    defaultValue: d.defaultValue ?? null,
    validation: (d.validation as FieldDefinitionView["validation"]) ?? {},
    showOnForms: d.showOnForms,
    sortOrder: d.sortOrder,
  };
}

export async function listFieldDefinitions(db: TenantDb, businessId: string, entityType: FieldEntityType, opts: { activeOnly?: boolean } = { activeOnly: true }): Promise<FieldDefinitionView[]> {
  const rows = await db.customFieldDefinition.findMany({ where: { businessId, entityType, ...(opts.activeOnly === false ? {} : { isActive: true }) }, orderBy: { sortOrder: "asc" } });
  return rows.map(toFieldView);
}

/** Coerces raw form values to typed values according to the definition; returns errors per key. */
export function coerceFieldValues(defs: FieldDefinitionView[], raw: Record<string, unknown>): { values: Record<string, unknown>; errors: Record<string, string> } {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const d of defs) {
    const v = raw[d.key];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (d.isRequired) errors[d.key] = `${d.label} is required.`;
      else values[d.key] = d.defaultValue ?? null;
      continue;
    }
    switch (d.type) {
      case "NUMBER":
      case "MEASUREMENT": {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) errors[d.key] = `${d.label} must be a number.`;
        else if (d.validation.min !== undefined && n < d.validation.min) errors[d.key] = `${d.label} must be at least ${d.validation.min}.`;
        else if (d.validation.max !== undefined && n > d.validation.max) errors[d.key] = `${d.label} must be at most ${d.validation.max}.`;
        else values[d.key] = n;
        break;
      }
      case "BOOLEAN":
        values[d.key] = v === true || v === "true" || v === "on" || v === "1" || v === 1;
        break;
      case "MULTISELECT": {
        const list = Array.isArray(v) ? v.map(String) : String(v).split(",").map((s) => s.trim()).filter(Boolean);
        const allowed = new Set(d.options.map((o) => o.value));
        values[d.key] = d.options.length ? list.filter((x) => allowed.has(x)) : list;
        break;
      }
      case "SELECT": {
        const s = String(v);
        if (d.options.length && !d.options.some((o) => o.value === s)) errors[d.key] = `${d.label} has an invalid option.`;
        else values[d.key] = s;
        break;
      }
      case "EMAIL":
        if (!z.string().email().safeParse(String(v)).success) errors[d.key] = `${d.label} must be a valid email.`;
        else values[d.key] = String(v);
        break;
      case "URL":
        if (!z.string().url().safeParse(String(v)).success) errors[d.key] = `${d.label} must be a valid URL.`;
        else values[d.key] = String(v);
        break;
      case "DATE":
        if (Number.isNaN(Date.parse(String(v)))) errors[d.key] = `${d.label} must be a date.`;
        else values[d.key] = String(v).slice(0, 10);
        break;
      case "ADDRESS":
        values[d.key] = typeof v === "object" ? v : String(v);
        break;
      default:
        values[d.key] = typeof v === "string" ? v.slice(0, 5000) : v;
    }
  }
  return { values, errors };
}

/** Persists values for an entity (rows + mirrored jsonb on the entity when a mirror updater is given). */
/** Minimal structural type so both transaction clients and RLS-scoped clients are accepted without deep generic comparison. */
type FieldValueWriter = { customFieldValue: { upsert: (args: Prisma.CustomFieldValueUpsertArgs) => Promise<unknown> } };

export async function saveFieldValues(
  tx: FieldValueWriter,
  businessId: string,
  entityType: FieldEntityType,
  entityId: string,
  defs: FieldDefinitionView[],
  values: Record<string, unknown>,
): Promise<void> {
  for (const d of defs) {
    if (!(d.key in values)) continue;
    await tx.customFieldValue.upsert({
      where: { definitionId_entityId: { definitionId: d.id, entityId } },
      create: { businessId, definitionId: d.id, entityType, entityId, value: toJson(values[d.key]) },
      update: { value: toJson(values[d.key]) },
    });
  }
}

export async function loadFieldValues(db: TenantDb, entityId: string): Promise<Record<string, unknown>> {
  const rows = await db.customFieldValue.findMany({ where: { entityId }, include: { definition: { select: { key: true } } } });
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.definition.key] = r.value;
  return out;
}

export const FIELD_TYPE_LABELS: Record<CustomFieldDefinition["type"], string> = {
  TEXT: "Text",
  TEXTAREA: "Long text",
  RICHTEXT: "Rich text",
  NUMBER: "Number",
  MEASUREMENT: "Measurement",
  SELECT: "Dropdown",
  MULTISELECT: "Multi-select",
  BOOLEAN: "Yes / No",
  DATE: "Date",
  TIME: "Time",
  EMAIL: "Email",
  PHONE: "Phone",
  URL: "URL",
  MEDIA: "Photo / file",
  ADDRESS: "Address",
};
