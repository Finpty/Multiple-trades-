import { z } from "zod";
import type { Form, FormAction, Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/db";
import { asArray, asObject } from "@/lib/json";
import { FORM_FIELD_TYPES, type FormFieldDefinition, type FormFieldType, type FormSettings } from "@/lib/site/public-api";

/** Form builder helpers: schemas for the jsonb columns, key/slug utilities and list summaries. */

export const FORM_ACTIONS: Array<{ value: FormAction; label: string; description: string }> = [
  { value: "LEAD", label: "Lead", description: "Creates a lead in the CRM." },
  { value: "QUOTE_REQUEST", label: "Quote request", description: "Creates a lead flagged as a quote request." },
  { value: "BOOKING_REQUEST", label: "Booking request", description: "Creates a lead and a booking request from the date/time fields." },
  { value: "CONTACT", label: "Contact", description: "General enquiry — creates a lead." },
  { value: "PROJECT_REQUEST", label: "Project request", description: "Larger project enquiry — creates a lead." },
];

export const FIELD_TYPES_WITH_OPTIONS: FormFieldType[] = ["dropdown", "checkbox", "radio"];
export const FIELD_TYPES_WITH_RANGE: FormFieldType[] = ["number", "measurement"];
export const FIELD_TYPES_WITH_FILES: FormFieldType[] = ["file", "photo", "video"];

const fieldTypeValues = FORM_FIELD_TYPES.map((t) => t.type) as [FormFieldType, ...FormFieldType[]];

export const FormFieldSchema = z.object({
  id: z.string().min(1).max(64),
  key: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/, "Keys use lowercase letters, numbers and underscores."),
  type: z.enum(fieldTypeValues),
  label: z.string().trim().min(1, "Label is required.").max(200),
  required: z.boolean().optional(),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional(),
  options: z.array(z.object({ value: z.string().max(200), label: z.string().max(200) })).optional(),
  width: z.enum(["full", "half"]).optional(),
  unit: z.string().max(20).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxFiles: z.number().int().min(1).max(20).optional(),
  defaultValue: z.string().max(1000).optional(),
});

export const FormFieldsSchema = z.array(FormFieldSchema).max(60).superRefine((fields, ctx) => {
  const seen = new Set<string>();
  fields.forEach((f, i) => {
    if (seen.has(f.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, "key"], message: `Duplicate key "${f.key}".` });
    seen.add(f.key);
    if (FIELD_TYPES_WITH_OPTIONS.includes(f.type) && !(f.options ?? []).some((o) => o.value.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, "options"], message: `"${f.label}" needs at least one option.` });
    }
  });
});

export const FormSettingsSchema = z.object({
  submitLabel: z.string().trim().max(60).optional(),
  successMessage: z.string().trim().max(1000).optional(),
  redirectUrl: z.string().trim().max(500).optional(),
  notifyEmails: z.array(z.string().trim().email("Enter valid email addresses.")).max(20).optional(),
  autoReplySubject: z.string().trim().max(200).optional(),
  autoReplyBody: z.string().trim().max(5000).optional(),
});

export const FormMetaSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes."),
  description: z.string().trim().max(500).optional(),
  action: z.enum(["LEAD", "QUOTE_REQUEST", "BOOKING_REQUEST", "CONTACT", "PROJECT_REQUEST"]),
  isActive: z.boolean(),
});

export type FormMetaInput = z.infer<typeof FormMetaSchema>;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "form";
}

/** Snake-case key from a label ("Preferred date?" → "preferred_date"). */
export function snakeKey(label: string): string {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return /^[a-z]/.test(key) ? key : `f_${key || "field"}`;
}

export function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

/** Default label/key/settings when a field type is added from the palette. */
export function newFieldDefinition(type: FormFieldType, id: string, taken: Set<string>): FormFieldDefinition {
  const meta = FORM_FIELD_TYPES.find((t) => t.type === type);
  const defaults: Partial<Record<FormFieldType, Partial<FormFieldDefinition>>> = {
    text: { label: "Your name", key: "name", required: true },
    email: { label: "Email", key: "email", required: true },
    phone: { label: "Phone", key: "phone", required: true },
    textarea: { label: "Tell us about the job", key: "message" },
    address: { label: "Job address", key: "address" },
    service: { label: "Service", key: "service" },
    date: { label: "Preferred date", key: "preferred_date" },
    time: { label: "Preferred time", key: "preferred_time" },
    photo: { label: "Photos of the area", key: "photos", maxFiles: 5 },
    file: { label: "Attachments", key: "attachments", maxFiles: 3 },
    video: { label: "Video walkthrough", key: "video", maxFiles: 1 },
    measurement: { label: "Approximate area", key: "area_sqm", unit: "m²" },
    number: { label: "Quantity", key: "quantity" },
    dropdown: { label: "Choose one", key: "choice", options: [{ value: "option_1", label: "Option 1" }, { value: "option_2", label: "Option 2" }] },
    radio: { label: "Choose one", key: "choice", options: [{ value: "option_1", label: "Option 1" }, { value: "option_2", label: "Option 2" }] },
    checkbox: { label: "Select all that apply", key: "selection", options: [{ value: "option_1", label: "Option 1" }, { value: "option_2", label: "Option 2" }] },
    signature: { label: "Signature", key: "signature" },
    hidden: { label: "Hidden value", key: "hidden_value", defaultValue: "" },
  };
  const d = defaults[type] ?? {};
  const label = d.label ?? meta?.label ?? "Field";
  const { key: preferredKey, ...rest } = d;
  return { id, type, width: "full", ...rest, label, key: uniqueKey(preferredKey ?? snakeKey(label), taken) };
}

export function formFields(form: Pick<Form, "fields">): FormFieldDefinition[] {
  return asArray<FormFieldDefinition>(form.fields).filter((f) => f && typeof f === "object" && typeof f.key === "string");
}

export function formSettings(form: Pick<Form, "settings">): FormSettings {
  return asObject<FormSettings>(form.settings);
}

export function parseNotifyEmails(raw: string): string[] {
  return raw
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Counts, per form slug, how many page sections embed the form (lead_form / quote_form / contact / calculator blocks). */
export async function embeddedPageCounts(db: TenantDb, businessId: string): Promise<Record<string, number>> {
  const sections = await db.pageSection.findMany({
    where: { businessId, type: { in: ["lead_form", "quote_form", "contact", "calculator"] }, page: { deletedAt: null } },
    select: { pageId: true, props: true },
  });
  const pagesBySlug = new Map<string, Set<string>>();
  for (const s of sections) {
    const slug = asObject<{ formSlug?: string }>(s.props).formSlug;
    if (!slug) continue;
    if (!pagesBySlug.has(slug)) pagesBySlug.set(slug, new Set());
    pagesBySlug.get(slug)!.add(s.pageId);
  }
  const out: Record<string, number> = {};
  for (const [slug, pages] of pagesBySlug) out[slug] = pages.size;
  return out;
}

/** Human summary of a submission: the first few filled non-file fields. */
export function submissionSummary(data: Prisma.JsonValue, fields: FormFieldDefinition[], max = 3): Array<{ label: string; value: string }> {
  const obj = asObject<Record<string, unknown>>(data);
  const out: Array<{ label: string; value: string }> = [];
  const preferred = ["name", "full_name", "email", "phone", "service", "message"];
  const ordered = [...fields].sort((a, b) => preferred.indexOf(a.key) - preferred.indexOf(b.key)).filter((f) => !FIELD_TYPES_WITH_FILES.includes(f.type) && f.type !== "signature" && f.type !== "hidden");
  const keys = ordered.length ? ordered.map((f) => f.key) : Object.keys(obj);
  for (const key of keys) {
    const v = obj[key];
    const text = displayValue(v);
    if (!text) continue;
    out.push({ label: fields.find((f) => f.key === key)?.label ?? key, value: text });
    if (out.length >= max) break;
  }
  return out;
}

export function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string") return v.startsWith("data:image/") ? "[signature]" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(displayValue).filter(Boolean).join(", ");
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).map(displayValue).filter(Boolean).join(", ");
  return String(v);
}

export function fieldLabelFor(fields: FormFieldDefinition[], key: string): string {
  return fields.find((f) => f.key === key)?.label ?? key;
}
