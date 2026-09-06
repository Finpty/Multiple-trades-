"use client";

import type { z } from "zod";
import { BLOCK_META, BLOCK_SCHEMAS, SectionSettingsSchema, type BlockType } from "@/lib/blocks/schema";
import type { EditorOptions } from "@/lib/website/options";
import { Alert } from "@/components/ui";
import { SchemaForm } from "./schema-form";

/** Props form for one block type: looks up BLOCK_SCHEMAS[type] and renders the schema-driven form. */
export function SectionPropsForm({ type, value, onChange, businessId, options, errors, disabled }: {
  type: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  businessId: string;
  options?: EditorOptions;
  errors?: Record<string, string>;
  disabled?: boolean;
}) {
  const schema = BLOCK_SCHEMAS[type as BlockType] as z.ZodObject<z.ZodRawShape> | undefined;
  if (!schema) return <Alert tone="warning" title="Unknown block">This block type ({type}) has no schema. It will render with its stored content but cannot be edited here.</Alert>;
  const preferred = ["eyebrow", "heading", "subheading", "intro", "body", "html"];
  return <SchemaForm schema={schema} value={value} onChange={onChange} businessId={businessId} options={options} errors={errors} order={preferred} disabled={disabled} />;
}

/** Layout settings shared by every section (background, spacing, width, anchor, …). */
export function SectionSettingsForm({ value, onChange, businessId, errors, disabled }: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  businessId: string;
  errors?: Record<string, string>;
  disabled?: boolean;
}) {
  const scoped: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors ?? {})) if (k.startsWith("settings.")) scoped[k.slice("settings.".length)] = v;
  return <SchemaForm schema={SectionSettingsSchema} value={value} onChange={onChange} businessId={businessId} errors={scoped} order={["background", "backgroundImage", "paddingTop", "paddingBottom", "width", "anchor", "hideOnMobile", "cssClass"]} disabled={disabled} />;
}

export function blockLabel(type: string): string {
  return BLOCK_META[type as BlockType]?.label ?? type;
}
