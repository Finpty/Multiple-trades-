import { z, type ZodTypeAny } from "zod";

/**
 * Runtime introspection of zod v3 schemas so a form can be generated from any
 * block/props schema without per-block UI code.
 */
export interface Unwrapped {
  inner: ZodTypeAny;
  optional: boolean;
  nullable: boolean;
  hasDefault: boolean;
  defaultValue?: unknown;
  description?: string;
}

export function unwrap(schema: ZodTypeAny): Unwrapped {
  let cur: ZodTypeAny = schema;
  let optional = false;
  let nullable = false;
  let hasDefault = false;
  let defaultValue: unknown;
  let description: string | undefined = schema.description;
  for (let i = 0; i < 12; i++) {
    description = description ?? cur.description;
    if (cur instanceof z.ZodDefault) {
      hasDefault = true;
      defaultValue = cur._def.defaultValue();
      cur = cur._def.innerType;
    } else if (cur instanceof z.ZodOptional) {
      optional = true;
      cur = cur._def.innerType;
    } else if (cur instanceof z.ZodNullable) {
      nullable = true;
      cur = cur._def.innerType;
    } else if (cur instanceof z.ZodEffects) {
      cur = cur._def.schema;
    } else if (cur instanceof z.ZodLazy) {
      cur = cur._def.getter();
    } else if (cur instanceof z.ZodBranded) {
      cur = cur._def.type;
    } else if (cur instanceof z.ZodCatch) {
      cur = cur._def.innerType;
    } else break;
  }
  return { inner: cur, optional: optional || hasDefault, nullable, hasDefault, defaultValue, description };
}

export type FieldKind = "string" | "number" | "boolean" | "enum" | "string-array" | "object-array" | "media" | "link" | "object" | "unknown";

export function objectKeys(schema: ZodTypeAny): string[] {
  return schema instanceof z.ZodObject ? Object.keys(schema.shape as Record<string, ZodTypeAny>) : [];
}

export function isMediaRefSchema(schema: ZodTypeAny): boolean {
  const keys = objectKeys(schema);
  return keys.includes("mediaId") && keys.includes("alt");
}

export function isLinkSchema(schema: ZodTypeAny): boolean {
  const keys = objectKeys(schema);
  return keys.includes("label") && keys.includes("href");
}

export function fieldKind(schema: ZodTypeAny): FieldKind {
  const { inner } = unwrap(schema);
  if (inner instanceof z.ZodString) return "string";
  if (inner instanceof z.ZodNumber) return "number";
  if (inner instanceof z.ZodBoolean) return "boolean";
  if (inner instanceof z.ZodEnum || inner instanceof z.ZodNativeEnum) return "enum";
  if (inner instanceof z.ZodLiteral) return "enum";
  if (inner instanceof z.ZodArray) {
    const el = unwrap(inner.element).inner;
    if (el instanceof z.ZodString || el instanceof z.ZodEnum) return "string-array";
    return "object-array";
  }
  if (inner instanceof z.ZodObject) {
    if (isMediaRefSchema(inner)) return "media";
    if (isLinkSchema(inner)) return "link";
    return "object";
  }
  return "unknown";
}

export function enumValues(schema: ZodTypeAny): string[] {
  const { inner } = unwrap(schema);
  if (inner instanceof z.ZodEnum) return [...(inner.options as string[])];
  if (inner instanceof z.ZodNativeEnum) return Object.values(inner.enum as Record<string, string>).filter((v) => typeof v === "string");
  if (inner instanceof z.ZodLiteral) return [String(inner.value)];
  return [];
}

export interface NumberConstraints {
  min?: number;
  max?: number;
  step?: number | "any";
}

export function numberConstraints(schema: ZodTypeAny): NumberConstraints {
  const { inner } = unwrap(schema);
  const out: NumberConstraints = { step: "any" };
  if (!(inner instanceof z.ZodNumber)) return out;
  for (const check of inner._def.checks) {
    if (check.kind === "min") out.min = check.value;
    if (check.kind === "max") out.max = check.value;
    if (check.kind === "int") out.step = 1;
  }
  return out;
}

export function stringMaxLength(schema: ZodTypeAny): number | undefined {
  const { inner } = unwrap(schema);
  if (!(inner instanceof z.ZodString)) return undefined;
  const max = inner._def.checks.find((c) => c.kind === "max");
  return max && "value" in max ? (max.value as number) : undefined;
}

export function isRequired(schema: ZodTypeAny): boolean {
  const { optional, nullable } = unwrap(schema);
  return !optional && !nullable;
}

/** Value to seed a newly added array row / object so required fields exist. */
export function emptyValueFor(schema: ZodTypeAny): unknown {
  const info = unwrap(schema);
  if (info.hasDefault) return info.defaultValue;
  const inner = info.inner;
  if (inner instanceof z.ZodString) return "";
  if (inner instanceof z.ZodNumber) return undefined;
  if (inner instanceof z.ZodBoolean) return false;
  if (inner instanceof z.ZodEnum) return (inner.options as string[])[0];
  if (inner instanceof z.ZodArray) return [];
  if (inner instanceof z.ZodObject) {
    const out: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(inner.shape as Record<string, ZodTypeAny>)) {
      const child = unwrap(def);
      if (!child.optional || child.hasDefault) {
        const v = emptyValueFor(def);
        if (v !== undefined) out[key] = v;
      }
    }
    return out;
  }
  return undefined;
}

const ACRONYMS: Record<string, string> = { cta: "CTA", url: "URL", id: "ID", ids: "IDs", html: "HTML", seo: "SEO", faq: "FAQ", css: "CSS", "3d": "3D" };

/** camelCase / snake_case → Title Case ("primaryCta" → "Primary CTA"). */
export function labelFromKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/);
  return words
    .map((w) => {
      const lower = w.toLowerCase();
      if (ACRONYMS[lower]) return ACRONYMS[lower];
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export const TEXTAREA_KEY_RE = /body|description|intro|answer|html|text|caption|subheading|disclaimer|terms|notes/i;
export const MONOSPACE_KEY_RE = /html|css|json|snippet|code/i;

/** Reference fields resolved through EditorOptions by key name. */
export type ReferenceKind = "services" | "projects" | "teamMembers" | "forms" | "pages";

export function referenceKind(key: string): { kind: ReferenceKind; multiple: boolean } | null {
  switch (key) {
    case "serviceId":
      return { kind: "services", multiple: false };
    case "serviceIds":
      return { kind: "services", multiple: true };
    case "projectId":
      return { kind: "projects", multiple: false };
    case "projectIds":
      return { kind: "projects", multiple: true };
    case "memberId":
      return { kind: "teamMembers", multiple: false };
    case "memberIds":
      return { kind: "teamMembers", multiple: true };
    case "formSlug":
      return { kind: "forms", multiple: false };
    case "pageId":
      return { kind: "pages", multiple: false };
    case "pageIds":
      return { kind: "pages", multiple: true };
    default:
      return null;
  }
}
