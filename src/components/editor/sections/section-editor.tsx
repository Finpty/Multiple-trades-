"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Select, cn } from "@/components/ui";
import { BLOCK_META, BLOCK_TYPES, SectionSettingsSchema, type BlockType } from "@/lib/blocks/schema";
import type { SectionView } from "@/lib/website/section-types";
import type { EditorOptions } from "@/lib/website/options";
import type { ActionResult } from "@/lib/actions";
import { SchemaForm, SectionPropsForm } from "@/components/editor/schema-form/schema-form";
import { z } from "zod";

export interface SectionActions {
  add: (businessId: string, pageId: string, type: string, index?: number) => Promise<ActionResult<SectionView>>;
  update: (businessId: string, sectionId: string, props: unknown, settings?: unknown) => Promise<ActionResult<SectionView>>;
  reorder: (businessId: string, pageId: string, ids: string[]) => Promise<ActionResult<SectionView[]>>;
  duplicate: (businessId: string, sectionId: string) => Promise<ActionResult<SectionView[]>>;
  toggleHidden: (businessId: string, sectionId: string, hidden?: boolean) => Promise<ActionResult<SectionView>>;
  remove: (businessId: string, sectionId: string) => Promise<ActionResult<SectionView[]>>;
}

function summary(s: SectionView): string {
  const p = s.props;
  return String(p.heading ?? p.title ?? p.eyebrow ?? p.body ?? "").toString().slice(0, 70);
}

export function SectionEditor({ businessId, pageId, initial, options, actions }: { businessId: string; pageId: string; initial: SectionView[]; options: EditorOptions; actions: SectionActions }) {
  const [sections, setSections] = React.useState(initial);
  const [selected, setSelected] = React.useState<string | null>(initial[0]?.id ?? null);
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [adding, setAdding] = React.useState<BlockType>("text");
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const current = sections.find((s) => s.id === selected) ?? null;
  const apply = (r: ActionResult<SectionView[]>) => { if (r.ok) setSections(r.data); else setMsg({ tone: "danger", text: r.error }); };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    const next = arrayMove(sections, from, to);
    setSections(next);
    apply(await actions.reorder(businessId, pageId, next.map((s) => s.id)));
  };

  // Debounced save of the selected section's props/settings.
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = (section: SectionView) => {
    setSections((list) => list.map((s) => (s.id === section.id ? section : s)));
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    timer.current = setTimeout(async () => {
      const r = await actions.update(businessId, section.id, section.props, section.settings);
      setSaving(false);
      if (!r.ok) setMsg({ tone: "danger", text: r.error }); else setMsg(null);
    }, 600);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Card>
          <CardHeader title="Sections" description="Drag to reorder. Click a section to edit it on the right." actions={<span className="text-xs text-neutral-500">{saving ? "Saving…" : "All changes saved"}</span>} />
          <CardBody>
            {sections.length === 0 && <p className="mb-3 text-sm text-neutral-500">This page has no sections yet. Add a block below.</p>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1.5">
                  {sections.map((s) => (
                    <SortableRow key={s.id} section={s} selected={s.id === selected} onSelect={() => setSelected(s.id)}
                      onDuplicate={async () => apply(await actions.duplicate(businessId, s.id))}
                      onToggle={async () => { const r = await actions.toggleHidden(businessId, s.id); if (r.ok) setSections((l) => l.map((x) => (x.id === s.id ? r.data : x))); }}
                      onDelete={async () => { if (window.confirm("Delete this section?")) { const r = await actions.remove(businessId, s.id); apply(r); if (selected === s.id) setSelected(null); } }} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
              <Select value={adding} onChange={(e) => setAdding(e.target.value as BlockType)} className="w-auto">
                {["layout", "content", "media", "data", "social-proof", "conversion"].map((cat) => <optgroup key={cat} label={cat.replace("-", " ")}>{BLOCK_TYPES.filter((t) => BLOCK_META[t].category === cat).map((t) => <option key={t} value={t}>{BLOCK_META[t].label}</option>)}</optgroup>)}
              </Select>
              <Button size="sm" onClick={async () => { const idx = selected ? sections.findIndex((s) => s.id === selected) + 1 : undefined; const r = await actions.add(businessId, pageId, adding, idx); if (r.ok) { const list = await refreshList(); setSelected(r.data.id); if (!list) setSections((l) => [...l, r.data]); } else setMsg({ tone: "danger", text: r.error }); }}>+ Add block</Button>
              <span className="text-xs text-neutral-500">{BLOCK_META[adding].description}</span>
            </div>
          </CardBody>
        </Card>
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start">
        {current ? (
          <Card>
            <CardHeader title={BLOCK_META[current.type as BlockType]?.label ?? current.type} description={BLOCK_META[current.type as BlockType]?.description} actions={current.isHidden ? <Badge>hidden</Badge> : undefined} />
            <CardBody className="max-h-[70vh] space-y-4 overflow-y-auto">
              <SectionPropsForm type={current.type} value={current.props} onChange={(props) => queueSave({ ...current, props })} businessId={businessId} options={options} />
              <details className="rounded-md border p-2"><summary className="cursor-pointer text-sm font-medium">Section settings</summary><div className="mt-2"><SchemaForm schema={SectionSettingsSchema as unknown as z.ZodObject<z.ZodRawShape>} value={current.settings} onChange={(settings) => queueSave({ ...current, settings })} businessId={businessId} options={options} /></div></details>
            </CardBody>
          </Card>
        ) : (
          <Card><CardBody><p className="text-sm text-neutral-500">Select a section to edit its content.</p></CardBody></Card>
        )}
      </div>
    </div>
  );

  async function refreshList(): Promise<boolean> {
    router.refresh();
    return false;
  }
}

function SortableRow({ section, selected, onSelect, onDuplicate, onToggle, onDelete }: { section: SectionView; selected: boolean; onSelect: () => void; onDuplicate: () => void; onToggle: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const meta = BLOCK_META[section.type as BlockType];
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-center gap-2 rounded-md border bg-white px-2 py-1.5", selected ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200", isDragging && "opacity-60", section.isHidden && "opacity-50")}>
      <button type="button" {...attributes} {...listeners} className="cursor-grab px-1 text-neutral-400" aria-label="Drag">⋮⋮</button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left"><span className="text-sm font-medium">{meta?.label ?? section.type}</span><span className="ml-2 truncate text-xs text-neutral-500">{summary(section)}</span></button>
      <Button variant="ghost" size="sm" onClick={onDuplicate} title="Duplicate">⧉</Button>
      <Button variant="ghost" size="sm" onClick={onToggle} title={section.isHidden ? "Show" : "Hide"}>{section.isHidden ? "👁" : "🙈"}</Button>
      <Button variant="ghost" size="sm" onClick={onDelete} title="Delete">✕</Button>
    </li>
  );
}
