"use client";

import * as React from "react";
import { z } from "zod";
import { Button, Checkbox, Input, Select, Textarea, cn } from "@/components/ui";
import { MediaPicker } from "@/components/admin/media-picker";
import type { EditorOptions } from "@/lib/website/options";
import { BLOCK_SCHEMAS, type BlockType } from "@/lib/blocks/schema";

/**
 * Generic form derived from a zod object schema at runtime. Used for every block's
 * props so adding a block never requires a hand-written form.
 */
type Any = z.ZodTypeAny;

function unwrap(def: Any): { inner: Any; optional: boolean } {
  let inner = def;
  let optional = false;
  for (;;) {
    if (inner instanceof z.ZodDefault) inner = inner._def.innerType;
    else if (inner instanceof z.ZodOptional || inner instanceof z.ZodNullable) { inner = inner._def.innerType; optional = true; }
    else if (inner instanceof z.ZodEffects) inner = inner._def.schema;
    else break;
  }
  return { inner, optional };
}

const LONG = /body|description|intro|answer|html|text$|caption|subheading|disclaimer|terms|notes|address/i;
const label = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/[_.]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const isMediaRef = (o: z.ZodObject<z.ZodRawShape>) => "mediaId" in o.shape && "url" in o.shape;
const isLink = (o: z.ZodObject<z.ZodRawShape>) => "label" in o.shape && "href" in o.shape;

export function SchemaForm({ schema, value, onChange, businessId, options, path = "" }: { schema: z.ZodObject<z.ZodRawShape>; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; businessId: string; options: EditorOptions; path?: string }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3">
      {Object.entries(schema.shape).map(([key, def]) => (
        <FieldFor key={key} name={key} def={def as Any} value={value[key]} onChange={(v) => set(key, v)} businessId={businessId} options={options} path={path ? `${path}.${key}` : key} />
      ))}
    </div>
  );
}

function FieldFor({ name, def, value, onChange, businessId, options, path }: { name: string; def: Any; value: unknown; onChange: (v: unknown) => void; businessId: string; options: EditorOptions; path: string }) {
  const { inner } = unwrap(def);
  const L = <span className="mb-1 block text-xs font-medium text-neutral-600">{label(name)}</span>;
  const str = value === undefined || value === null ? "" : String(value);

  // Entity references by conventional key names.
  const refList = name === "serviceIds" ? options.services : name === "projectIds" ? options.projects : name === "memberIds" ? options.teamMembers : null;
  if (refList && inner instanceof z.ZodArray) {
    const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
    return <label className="block">{L}<div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">{refList.map((o) => <Checkbox key={o.id} checked={selected.has(o.id)} onChange={(e) => { const s = new Set(selected); if (e.target.checked) s.add(o.id); else s.delete(o.id); onChange([...s]); }} label={o.label} />)}{refList.length === 0 && <span className="text-xs text-neutral-500">Nothing to choose yet.</span>}</div></label>;
  }
  const refOne = name === "serviceId" ? options.services : name === "projectId" ? options.projects : name === "formSlug" ? options.forms : null;
  if (refOne && inner instanceof z.ZodString) {
    return <label className="block">{L}<Select value={str} onChange={(e) => onChange(e.target.value || undefined)}><option value="">—</option>{refOne.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></label>;
  }
  if (inner instanceof z.ZodString) {
    return LONG.test(name) ? <label className="block">{L}<Textarea rows={name === "html" ? 8 : 3} className={cn(name === "html" && "font-mono text-xs")} value={str} onChange={(e) => onChange(e.target.value)} /></label> : <label className="block">{L}<Input value={str} onChange={(e) => onChange(e.target.value)} /></label>;
  }
  if (inner instanceof z.ZodNumber) return <label className="block">{L}<Input type="number" value={str} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} /></label>;
  if (inner instanceof z.ZodBoolean) return <Checkbox checked={value === true} onChange={(e) => onChange(e.target.checked)} label={label(name)} />;
  if (inner instanceof z.ZodEnum) return <label className="block">{L}<Select value={str} onChange={(e) => onChange(e.target.value)}>{(inner.options as string[]).map((o) => <option key={o} value={o}>{o.replace(/[-_]/g, " ")}</option>)}</Select></label>;
  if (inner instanceof z.ZodObject) {
    const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    if (isMediaRef(inner)) {
      return <div>{L}<MediaPicker businessId={businessId} value={typeof obj.mediaId === "string" ? obj.mediaId : null} onChange={(m) => onChange(m ? { ...obj, mediaId: m.id, url: null, alt: obj.alt ?? m.alt } : { ...obj, mediaId: null, url: null })} kind={/video/i.test(name) ? "VIDEO" : "IMAGE"} /><Input className="mt-1" placeholder="Alt text" value={typeof obj.alt === "string" ? obj.alt : ""} onChange={(e) => onChange({ ...obj, alt: e.target.value })} /></div>;
    }
    if (isLink(inner)) {
      return (
        <div className="rounded-md border p-2">{L}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_110px]">
            <Input placeholder="Label" value={typeof obj.label === "string" ? obj.label : ""} onChange={(e) => onChange({ ...obj, label: e.target.value })} />
            <div className="flex gap-1"><Input placeholder="/quote or https://" value={typeof obj.href === "string" ? obj.href : ""} onChange={(e) => onChange({ ...obj, href: e.target.value })} /><Select className="w-28" value="" onChange={(e) => { if (e.target.value) onChange({ ...obj, href: e.target.value }); }}><option value="">Pick…</option>{options.pages.map((p) => <option key={p.id} value={p.href ?? "/"}>{p.label}</option>)}{options.services.map((p) => <option key={p.id} value={p.href ?? ""}>{p.label}</option>)}</Select></div>
            <Select value={typeof obj.style === "string" ? obj.style : "primary"} onChange={(e) => onChange({ ...obj, style: e.target.value })}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="link">Link</option></Select>
          </div>
          {!obj.label && <button type="button" className="mt-1 text-xs text-neutral-500 underline" onClick={() => onChange({ label: "Learn more", href: "/contact", style: "primary" })}>Add link</button>}
        </div>
      );
    }
    return <fieldset className="rounded-md border p-2"><legend className="px-1 text-xs font-medium text-neutral-600">{label(name)}</legend><SchemaForm schema={inner} value={obj} onChange={onChange} businessId={businessId} options={options} path={path} /></fieldset>;
  }
  if (inner instanceof z.ZodArray) {
    const { inner: el } = unwrap(inner.element as Any);
    const list = Array.isArray(value) ? (value as unknown[]) : [];
    const setList = (l: unknown[]) => onChange(l);
    if (el instanceof z.ZodString) {
      return (
        <div>{L}
          <div className="space-y-1">{list.map((item, i) => <div key={i} className="flex gap-1"><Input value={String(item ?? "")} onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value : x)))} /><Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => setList(move(list, i, i - 1))}>↑</Button><Button type="button" variant="ghost" size="sm" onClick={() => setList(list.filter((_, j) => j !== i))}>✕</Button></div>)}</div>
          <Button type="button" variant="secondary" size="sm" className="mt-1" onClick={() => setList([...list, ""])}>+ Add</Button>
        </div>
      );
    }
    if (el instanceof z.ZodObject) {
      const blank = () => { const r = el.safeParse({}); return r.success ? (r.data as Record<string, unknown>) : Object.fromEntries(Object.keys(el.shape).map((k) => [k, ""])); };
      return (
        <div>{L}
          <div className="space-y-2">
            {list.map((item, i) => (
              <div key={i} className="rounded-md border bg-neutral-50 p-2">
                <div className="mb-1 flex items-center justify-between text-xs text-neutral-500"><span>#{i + 1}</span><span className="flex gap-1"><Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => setList(move(list, i, i - 1))}>↑</Button><Button type="button" variant="ghost" size="sm" disabled={i === list.length - 1} onClick={() => setList(move(list, i, i + 1))}>↓</Button><Button type="button" variant="ghost" size="sm" onClick={() => setList(list.filter((_, j) => j !== i))}>✕</Button></span></div>
                {isMediaRef(el) ? <FieldFor name={name.replace(/s$/, "")} def={el} value={item} onChange={(v) => setList(list.map((x, j) => (j === i ? v : x)))} businessId={businessId} options={options} path={`${path}.${i}`} /> : <SchemaForm schema={el} value={(item ?? {}) as Record<string, unknown>} onChange={(v) => setList(list.map((x, j) => (j === i ? v : x)))} businessId={businessId} options={options} path={`${path}.${i}`} />}
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" className="mt-1" onClick={() => setList([...list, blank()])}>+ Add {label(name).replace(/s$/, "").toLowerCase()}</Button>
        </div>
      );
    }
  }
  return <label className="block">{L}<Textarea className="font-mono text-xs" rows={3} value={JSON.stringify(value ?? null)} onChange={(e) => { try { onChange(JSON.parse(e.target.value)); } catch { /* keep typing */ } }} /></label>;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const c = [...list];
  const [x] = c.splice(from, 1);
  c.splice(to, 0, x);
  return c;
}

export function SectionPropsForm({ type, value, onChange, businessId, options }: { type: string; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; businessId: string; options: EditorOptions }) {
  const schema = BLOCK_SCHEMAS[type as BlockType] as z.ZodObject<z.ZodRawShape> | undefined;
  if (!schema) return <p className="text-sm text-neutral-500">Unknown block type “{type}”.</p>;
  return <SchemaForm schema={schema} value={value} onChange={onChange} businessId={businessId} options={options} />;
}
