"use client";

import * as React from "react";
import { Button, Checkbox, Input, Select, Textarea, cn } from "@/components/ui";
import { FIELD_TYPE_LABELS } from "@/lib/custom-fields";
import { BLOCK_META, BLOCK_SCHEMAS, BLOCK_TYPES, defaultBlockProps, type BlockType } from "@/lib/blocks/schema";
import { z } from "zod";
import type { ServiceSeed } from "@/lib/platform/industries";

/* ── shared helpers ─────────────────────────────────────────────────────── */

function useJsonField<T>(initial: T) {
  const [value, setValue] = React.useState<T>(initial);
  const hidden = <input type="hidden" name="data:json" value={JSON.stringify(value)} />;
  return [value, setValue, hidden] as const;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function RowTools({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Move up">↑</Button>
      <Button type="button" variant="ghost" size="sm" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="Move down">↓</Button>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label="Remove">✕</Button>
    </div>
  );
}

export const snake = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

/* ── Terminology ────────────────────────────────────────────────────────── */

export function TerminologyEditor({ initial, keys }: { initial: Record<string, string>; keys: Array<{ key: string; label: string; fallback: string }> }) {
  const [value, setValue, hidden] = useJsonField<Record<string, string>>({ ...Object.fromEntries(keys.map((k) => [k.key, k.fallback])), ...initial });
  const [customKey, setCustomKey] = React.useState("");
  const custom = Object.keys(value).filter((k) => !keys.some((s) => s.key === k));
  return (
    <div className="space-y-3">
      {hidden}
      <div className="grid gap-3 sm:grid-cols-2">
        {keys.map((k) => (
          <label key={k.key} className="text-sm"><span className="mb-1 block font-medium">{k.label}</span><Input value={value[k.key] ?? ""} onChange={(e) => setValue({ ...value, [k.key]: e.target.value })} /></label>
        ))}
        {custom.map((k) => (
          <label key={k} className="text-sm"><span className="mb-1 block font-medium">{k} <button type="button" className="ml-2 text-xs text-red-600" onClick={() => { const v = { ...value }; delete v[k]; setValue(v); }}>remove</button></span><Input value={value[k]} onChange={(e) => setValue({ ...value, [k]: e.target.value })} /></label>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <label className="text-sm"><span className="mb-1 block font-medium">Add custom term</span><Input value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder="e.g. site_visit" /></label>
        <Button type="button" variant="secondary" onClick={() => { const k = snake(customKey); if (k && !(k in value)) setValue({ ...value, [k]: "" }); setCustomKey(""); }}>Add</Button>
      </div>
    </div>
  );
}

/* ── Services tree ──────────────────────────────────────────────────────── */

const PRICING_METHODS = ["QUOTE", "FIXED", "RANGE", "HOURLY", "DAY_RATE", "PER_SQM", "PER_UNIT", "PER_LINEAR_METRE"] as const;

export function ServicesEditor({ initial }: { initial: ServiceSeed[] }) {
  const [value, setValue, hidden] = useJsonField<ServiceSeed[]>(initial);
  return (
    <div className="space-y-3">
      {hidden}
      <ServiceList items={value} onChange={setValue} depth={0} />
      <Button type="button" variant="secondary" onClick={() => setValue([...value, { name: "New service", pricingMethod: "QUOTE" }])}>+ Add service</Button>
    </div>
  );
}

function ServiceList({ items, onChange, depth }: { items: ServiceSeed[]; onChange: (v: ServiceSeed[]) => void; depth: number }) {
  const update = (i: number, patch: Partial<ServiceSeed>) => onChange(items.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className={cn("space-y-2", depth > 0 && "ml-6 border-l-2 border-neutral-200 pl-3")}>
      {items.map((s, i) => (
        <ServiceRow key={i} service={s} index={i} count={items.length} depth={depth} onChange={(patch) => update(i, patch)} onMove={(to) => onChange(move(items, i, to))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
      ))}
    </div>
  );
}

function ServiceRow({ service: s, index, count, depth, onChange, onMove, onRemove }: { service: ServiceSeed; index: number; count: number; depth: number; onChange: (p: Partial<ServiceSeed>) => void; onMove: (to: number) => void; onRemove: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={s.name} onChange={(e) => onChange({ name: e.target.value })} className="max-w-xs font-medium" />
        <Select value={s.pricingMethod ?? "QUOTE"} onChange={(e) => onChange({ pricingMethod: e.target.value as ServiceSeed["pricingMethod"] })} className="w-auto">
          {PRICING_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ").toLowerCase()}</option>)}
        </Select>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>{open ? "Less" : "Details"}</Button>
        {depth === 0 && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ children: [...(s.children ?? []), { name: "Sub-service", pricingMethod: "QUOTE" }] })}>+ Sub-service</Button>}
        <RowTools index={index} count={count} onMove={onMove} onRemove={onRemove} />
      </div>
      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2"><span className="mb-1 block">Short description</span><Input value={s.shortDescription ?? ""} onChange={(e) => onChange({ shortDescription: e.target.value })} /></label>
          <label className="text-sm sm:col-span-2"><span className="mb-1 block">Full description</span><Textarea value={s.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} /></label>
          <label className="text-sm"><span className="mb-1 block">Price from ($)</span><Input type="number" step="0.01" value={s.priceMinCents != null ? s.priceMinCents / 100 : ""} onChange={(e) => onChange({ priceMinCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} /></label>
          <label className="text-sm"><span className="mb-1 block">Price to ($)</span><Input type="number" step="0.01" value={s.priceMaxCents != null ? s.priceMaxCents / 100 : ""} onChange={(e) => onChange({ priceMaxCents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} /></label>
          <label className="text-sm"><span className="mb-1 block">Unit</span><Input value={s.priceUnit ?? ""} onChange={(e) => onChange({ priceUnit: e.target.value })} placeholder="m², hour, point…" /></label>
          <label className="text-sm"><span className="mb-1 block">Slug (optional)</span><Input value={s.slug ?? ""} onChange={(e) => onChange({ slug: e.target.value })} /></label>
          <div className="sm:col-span-2">
            <div className="mb-1 text-sm font-medium">FAQs</div>
            {(s.faqs ?? []).map((f, i) => (
              <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                <Input value={f.question} placeholder="Question" onChange={(e) => onChange({ faqs: (s.faqs ?? []).map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })} />
                <Input value={f.answer} placeholder="Answer" onChange={(e) => onChange({ faqs: (s.faqs ?? []).map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) })} />
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ faqs: (s.faqs ?? []).filter((_, j) => j !== i) })}>✕</Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ faqs: [...(s.faqs ?? []), { question: "", answer: "" }] })}>+ FAQ</Button>
          </div>
        </div>
      )}
      {s.children && s.children.length > 0 && <div className="mt-3"><ServiceList items={s.children} onChange={(children) => onChange({ children })} depth={depth + 1} /></div>}
    </div>
  );
}

/* ── Fields (job / estimate / lead) ─────────────────────────────────────── */

export interface FieldSeed {
  key: string;
  label: string;
  type: keyof typeof FIELD_TYPE_LABELS;
  options?: Array<{ value: string; label: string }>;
  isRequired?: boolean;
  helpText?: string;
  groupName?: string;
  showOnForms?: boolean;
  unit?: string;
}

const SEED_FIELD_TYPES: Array<FieldSeed["type"]> = ["TEXT", "TEXTAREA", "NUMBER", "MEASUREMENT", "SELECT", "MULTISELECT", "BOOLEAN", "DATE", "MEDIA", "ADDRESS"];

export function FieldsEditor({ initial }: { initial: FieldSeed[] }) {
  const [value, setValue, hidden] = useJsonField<FieldSeed[]>(initial);
  const update = (i: number, patch: Partial<FieldSeed>) => setValue(value.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-2">
      {hidden}
      {value.length === 0 && <p className="text-sm text-neutral-500">No fields yet.</p>}
      {value.map((f, i) => (
        <div key={i} className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-[2fr_1.5fr_1.5fr_auto]">
            <Input value={f.label} placeholder="Label" onChange={(e) => update(i, { label: e.target.value, key: f.key || snake(e.target.value) })} />
            <Input value={f.key} placeholder="key_name" onChange={(e) => update(i, { key: snake(e.target.value) })} />
            <Select value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldSeed["type"] })}>{SEED_FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}</Select>
            <RowTools index={i} count={value.length} onMove={(to) => setValue(move(value, i, to))} onRemove={() => setValue(value.filter((_, j) => j !== i))} />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <Input value={f.helpText ?? ""} placeholder="Help text" onChange={(e) => update(i, { helpText: e.target.value })} />
            <Input value={f.groupName ?? ""} placeholder="Group" onChange={(e) => update(i, { groupName: e.target.value })} />
            <Input value={f.unit ?? ""} placeholder="Unit (m², kW…)" onChange={(e) => update(i, { unit: e.target.value })} />
            <Checkbox checked={!!f.isRequired} onChange={(e) => update(i, { isRequired: e.target.checked })} label="Required" />
            <Checkbox checked={!!f.showOnForms} onChange={(e) => update(i, { showOnForms: e.target.checked })} label="Ask on forms" />
          </div>
          {(f.type === "SELECT" || f.type === "MULTISELECT") && (
            <div className="mt-2 text-sm">
              <div className="mb-1 font-medium">Options</div>
              {(f.options ?? []).map((o, k) => (
                <div key={k} className="mb-1 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input value={o.label} placeholder="Label" onChange={(e) => update(i, { options: (f.options ?? []).map((x, j) => (j === k ? { label: e.target.value, value: x.value || snake(e.target.value) } : x)) })} />
                  <Input value={o.value} placeholder="value" onChange={(e) => update(i, { options: (f.options ?? []).map((x, j) => (j === k ? { ...x, value: snake(e.target.value) } : x)) })} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => update(i, { options: (f.options ?? []).filter((_, j) => j !== k) })}>✕</Button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => update(i, { options: [...(f.options ?? []), { label: "", value: "" }] })}>+ Option</Button>
            </div>
          )}
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => setValue([...value, { key: "", label: "", type: "TEXT" }])}>+ Add field</Button>
    </div>
  );
}

/* ── Pricing ────────────────────────────────────────────────────────────── */

export interface PricingSeed { key: string; label: string; type: "RATE" | "FEE" | "MULTIPLIER" | "PERCENT"; amount: number; unit?: string; category?: string; description?: string }

export function PricingEditor({ initial }: { initial: PricingSeed[] }) {
  const [value, setValue, hidden] = useJsonField<PricingSeed[]>(initial);
  const update = (i: number, patch: Partial<PricingSeed>) => setValue(value.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-2">
      {hidden}
      <div className="hidden grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-2 text-xs font-medium uppercase text-neutral-500 sm:grid"><span>Label</span><span>Key</span><span>Type</span><span>Amount</span><span>Unit</span><span>Category</span><span /></div>
      {value.map((p, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_auto]">
          <Input value={p.label} onChange={(e) => update(i, { label: e.target.value, key: p.key || snake(e.target.value) })} placeholder="Label" />
          <Input value={p.key} onChange={(e) => update(i, { key: snake(e.target.value) })} placeholder="key" />
          <Select value={p.type} onChange={(e) => update(i, { type: e.target.value as PricingSeed["type"] })}><option value="RATE">Rate</option><option value="FEE">Fee</option><option value="MULTIPLIER">Multiplier</option><option value="PERCENT">Percent</option></Select>
          <Input type="number" step="0.01" value={p.amount} onChange={(e) => update(i, { amount: Number(e.target.value) })} />
          <Input value={p.unit ?? ""} onChange={(e) => update(i, { unit: e.target.value })} placeholder="m²" />
          <Input value={p.category ?? ""} onChange={(e) => update(i, { category: e.target.value })} placeholder="labour" list="pricing-categories" />
          <RowTools index={i} count={value.length} onMove={(to) => setValue(move(value, i, to))} onRemove={() => setValue(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <datalist id="pricing-categories"><option value="labour" /><option value="materials" /><option value="fees" /><option value="preparation" /><option value="finish" /><option value="complexity" /><option value="business" /></datalist>
      <Button type="button" variant="secondary" onClick={() => setValue([...value, { key: "", label: "", type: "RATE", amount: 0, unit: "", category: "labour" }])}>+ Add pricing item</Button>
    </div>
  );
}

/* ── Stages ─────────────────────────────────────────────────────────────── */

export interface StageSeed { key: string; name: string; color?: string; description?: string; isTerminal?: boolean }

export function StagesEditor({ initial }: { initial: StageSeed[] }) {
  const [value, setValue, hidden] = useJsonField<StageSeed[]>(initial.length ? initial : [{ key: "lead", name: "Lead", color: "#64748b" }]);
  const update = (i: number, patch: Partial<StageSeed>) => setValue(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-2">
      {hidden}
      {value.map((s, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[auto_2fr_1.5fr_2fr_auto_auto]">
          <input type="color" value={s.color ?? "#64748b"} onChange={(e) => update(i, { color: e.target.value })} className="h-9 w-10 rounded border" aria-label="Colour" />
          <Input value={s.name} placeholder="Stage name" onChange={(e) => update(i, { name: e.target.value, key: s.key || snake(e.target.value) })} />
          <Input value={s.key} placeholder="key" onChange={(e) => update(i, { key: snake(e.target.value) })} />
          <Input value={s.description ?? ""} placeholder="Description" onChange={(e) => update(i, { description: e.target.value })} />
          <Checkbox checked={!!s.isTerminal} onChange={(e) => update(i, { isTerminal: e.target.checked })} label="Completes job" />
          <RowTools index={i} count={value.length} onMove={(to) => setValue(move(value, i, to))} onRemove={() => value.length > 1 && setValue(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => setValue([...value, { key: "", name: "", color: "#f97316" }])}>+ Add stage</Button>
    </div>
  );
}

/* ── Website sections ───────────────────────────────────────────────────── */

type SectionSeedLite = { type: string; props: Record<string, unknown>; settings?: Record<string, unknown>; isHidden?: boolean };

function simpleFields(type: BlockType): Array<{ key: string; kind: "string" | "text" | "number" | "boolean" | "enum"; options?: string[] }> {
  const shape = (BLOCK_SCHEMAS[type] as z.ZodObject<z.ZodRawShape>).shape;
  const out: Array<{ key: string; kind: "string" | "text" | "number" | "boolean" | "enum"; options?: string[] }> = [];
  for (const [key, def] of Object.entries(shape)) {
    let inner: z.ZodTypeAny = def as z.ZodTypeAny;
    while (inner instanceof z.ZodDefault || inner instanceof z.ZodOptional || inner instanceof z.ZodNullable) inner = inner._def.innerType;
    if (inner instanceof z.ZodString) out.push({ key, kind: /body|intro|description|html|subheading|disclaimer/.test(key) ? "text" : "string" });
    else if (inner instanceof z.ZodNumber) out.push({ key, kind: "number" });
    else if (inner instanceof z.ZodBoolean) out.push({ key, kind: "boolean" });
    else if (inner instanceof z.ZodEnum) out.push({ key, kind: "enum", options: inner.options as string[] });
  }
  return out;
}

export function WebsiteSectionsEditor({ initial, pageKeys, platformDefaults }: { initial: Record<string, SectionSeedLite[]>; pageKeys: string[]; platformDefaults: Record<string, SectionSeedLite[]> }) {
  const [value, setValue, hidden] = useJsonField<Record<string, SectionSeedLite[]>>(initial);
  const [page, setPage] = React.useState(pageKeys[0]);
  const overridden = page in value;
  const sections = overridden ? value[page] : platformDefaults[page] ?? [];
  const setSections = (list: SectionSeedLite[]) => setValue({ ...value, [page]: list });
  const [adding, setAdding] = React.useState<BlockType>("text");
  return (
    <div className="space-y-3">
      {hidden}
      <div className="flex flex-wrap items-center gap-2">
        {pageKeys.map((k) => (
          <button key={k} type="button" onClick={() => setPage(k)} className={cn("rounded-md border px-3 py-1.5 text-sm", page === k ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300", k in value && "font-semibold")}>{k}{k in value ? " •" : ""}</button>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-sm">
        <span>{overridden ? "Custom sections for this page" : "Platform default (not overridden)"}</span>
        {overridden ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => { const v = { ...value }; delete v[page]; setValue(v); }}>Reset to platform default</Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={() => setSections(JSON.parse(JSON.stringify(sections)))}>Customise this page</Button>
        )}
      </div>
      <div className="space-y-2">
        {sections.map((s, i) => (
          <SectionSeedRow key={i} section={s} index={i} count={sections.length} readOnly={!overridden} onChange={(patch) => setSections(sections.map((x, j) => (j === i ? { ...x, ...patch } : x)))} onMove={(to) => setSections(move(sections, i, to))} onRemove={() => setSections(sections.filter((_, j) => j !== i))} />
        ))}
      </div>
      {overridden && (
        <div className="flex items-center gap-2">
          <Select value={adding} onChange={(e) => setAdding(e.target.value as BlockType)} className="w-auto">
            {BLOCK_TYPES.map((t) => <option key={t} value={t}>{BLOCK_META[t].label}</option>)}
          </Select>
          <Button type="button" variant="secondary" onClick={() => setSections([...sections, { type: adding, props: defaultBlockProps(adding) }])}>+ Add block</Button>
        </div>
      )}
    </div>
  );
}

function SectionSeedRow({ section: s, index, count, readOnly, onChange, onMove, onRemove }: { section: SectionSeedLite; index: number; count: number; readOnly: boolean; onChange: (p: Partial<SectionSeedLite>) => void; onMove: (to: number) => void; onRemove: () => void }) {
  const [open, setOpen] = React.useState(false);
  const meta = BLOCK_META[s.type as BlockType];
  const fields = meta ? simpleFields(s.type as BlockType) : [];
  const [advanced, setAdvanced] = React.useState(JSON.stringify(s.props, null, 2));
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-semibold uppercase">{meta?.label ?? s.type}</span>
        <span className="truncate text-sm text-neutral-600">{String(s.props.heading ?? s.props.title ?? meta?.description ?? "")}</span>
        <span className="flex-1" />
        {!readOnly && <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Edit"}</Button>}
        {!readOnly && <RowTools index={index} count={count} onMove={onMove} onRemove={onRemove} />}
      </div>
      {open && !readOnly && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.key} className={cn("text-sm", f.kind === "text" && "sm:col-span-2")}>
              <span className="mb-1 block">{f.key}</span>
              {f.kind === "boolean" ? (
                <input type="checkbox" checked={!!s.props[f.key]} onChange={(e) => onChange({ props: { ...s.props, [f.key]: e.target.checked } })} />
              ) : f.kind === "enum" ? (
                <Select value={String(s.props[f.key] ?? "")} onChange={(e) => onChange({ props: { ...s.props, [f.key]: e.target.value } })}>{f.options!.map((o) => <option key={o} value={o}>{o}</option>)}</Select>
              ) : f.kind === "number" ? (
                <Input type="number" value={String(s.props[f.key] ?? "")} onChange={(e) => onChange({ props: { ...s.props, [f.key]: Number(e.target.value) } })} />
              ) : f.kind === "text" ? (
                <Textarea value={String(s.props[f.key] ?? "")} onChange={(e) => onChange({ props: { ...s.props, [f.key]: e.target.value } })} />
              ) : (
                <Input value={String(s.props[f.key] ?? "")} onChange={(e) => onChange({ props: { ...s.props, [f.key]: e.target.value } })} />
              )}
            </label>
          ))}
          <details className="sm:col-span-2 text-sm"><summary className="cursor-pointer text-neutral-600">Advanced JSON (lists, images, links)</summary>
            <Textarea className="mt-2 font-mono text-xs" rows={8} value={advanced} onChange={(e) => setAdvanced(e.target.value)} onBlur={() => { try { onChange({ props: JSON.parse(advanced) }); } catch { /* keep editing */ } }} />
          </details>
        </div>
      )}
    </div>
  );
}

/* ── Features ───────────────────────────────────────────────────────────── */

export function FeaturesEditor({ initial, features }: { initial: string[]; features: Array<{ key: string; name: string; description: string; category: string; requiresAi: boolean }> }) {
  const [value, setValue, hidden] = useJsonField<string[]>(initial);
  const groups = [...new Set(features.map((f) => f.category))];
  return (
    <div className="space-y-4">
      {hidden}
      {groups.map((g) => (
        <div key={g}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{g}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {features.filter((f) => f.category === g).map((f) => (
              <label key={f.key} className="flex items-start gap-2 rounded-md border border-neutral-200 p-3 text-sm">
                <input type="checkbox" className="mt-0.5" checked={value.includes(f.key)} onChange={(e) => setValue(e.target.checked ? [...value, f.key] : value.filter((k) => k !== f.key))} />
                <span><span className="font-medium">{f.name}</span>{f.requiresAi && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-800">AI optional</span>}<span className="block text-xs text-neutral-500">{f.description}</span></span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
