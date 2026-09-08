"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, Input, Select, cn } from "@/components/ui";
import { NAV_ITEM_TYPE_META, type NavItem, type NavItemType } from "@/lib/website/nav-types";
import type { MenuView, NavPageOption } from "@/lib/website/navigation";
import type { ActionResult } from "@/lib/actions";

const uid = () => Math.random().toString(36).slice(2, 10);

export function NavBuilder({ businessId, menus, definitions, pages, save, publish, canPublish }: { businessId: string; menus: MenuView[]; definitions: Array<{ key: string; name: string; description: string }>; pages: NavPageOption[]; save: (b: string, key: string, items: unknown) => Promise<ActionResult>; publish: (b: string) => Promise<ActionResult>; canPublish: boolean }) {
  const [active, setActive] = React.useState(definitions[0]?.key ?? "header");
  const [drafts, setDrafts] = React.useState<Record<string, NavItem[]>>(Object.fromEntries(definitions.map((d) => [d.key, menus.find((m) => m.key === d.key)?.draft ?? (d.key === "mobile" ? menus.find((m) => m.key === "header")?.draft ?? [] : [])])));
  const [dirty, setDirty] = React.useState<Set<string>>(new Set());
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const router = useRouter();
  const items = drafts[active] ?? [];
  const setItems = (next: NavItem[]) => { setDrafts({ ...drafts, [active]: next }); setDirty(new Set(dirty).add(active)); };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const def = definitions.find((d) => d.key === active);
  const menu = menus.find((m) => m.key === active);

  const onDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    setItems(arrayMove(items, items.findIndex((i) => i.id === a.id), items.findIndex((i) => i.id === over.id)));
  };
  const update = (i: number, patch: Partial<NavItem>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const add = (type: NavItemType) => {
    const first = pages[0];
    const base: NavItem = { id: uid(), label: type === "services" ? "Services" : type === "dropdown" ? "More" : first?.title ?? "New link", type };
    if (type === "page" && first) base.pageId = first.id;
    if (type === "services") base.pageSystemKey = "services";
    if (type === "link") base.href = "https://";
    if (type === "dropdown") base.children = [];
    setItems([...items, base]);
  };
  const saveActive = () => start(async () => { const r = await save(businessId, active, drafts[active]); setMsg(r.ok ? { tone: "success", text: r.message ?? "Saved" } : { tone: "danger", text: r.error }); if (r.ok) { const d = new Set(dirty); d.delete(active); setDirty(d); router.refresh(); } });

  return (
    <div className="space-y-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        {definitions.map((d) => <button key={d.key} type="button" onClick={() => setActive(d.key)} className={cn("rounded-md border px-3 py-1.5 text-sm", active === d.key ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300")}>{d.name}{dirty.has(d.key) && " •"}</button>)}
        <span className="flex-1" />
        <Button variant="secondary" disabled={pending || !dirty.has(active)} onClick={saveActive}>Save draft</Button>
        {canPublish && <Button disabled={pending || dirty.size > 0} title={dirty.size ? "Save drafts first" : undefined} onClick={() => start(async () => { const r = await publish(businessId); setMsg(r.ok ? { tone: "success", text: r.message ?? "Published" } : { tone: "danger", text: r.error }); router.refresh(); })}>Publish navigation</Button>}
      </div>
      <Card>
        <CardHeader title={def?.name ?? active} description={def?.description} actions={menu?.hasUnpublishedChanges ? <Badge tone="amber">unpublished changes</Badge> : menu?.publishedAt ? <Badge tone="green">published</Badge> : undefined} />
        <CardBody className="space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">{items.map((it, i) => <NavRow key={it.id} item={it} pages={pages} onChange={(p) => update(i, p)} onRemove={() => setItems(items.filter((_, j) => j !== i))} />)}</ul>
            </SortableContext>
          </DndContext>
          {items.length === 0 && <p className="text-sm text-neutral-500">This menu is empty.</p>}
          <div className="flex flex-wrap gap-2 border-t pt-3">{(Object.keys(NAV_ITEM_TYPE_META) as NavItemType[]).map((t) => <Button key={t} size="sm" variant="secondary" onClick={() => add(t)} title={NAV_ITEM_TYPE_META[t].description}>+ {NAV_ITEM_TYPE_META[t].label}</Button>)}</div>
          {active === "header" && <p className="text-xs text-neutral-500">The last item is shown as the highlighted call-to-action button.</p>}
        </CardBody>
      </Card>
    </div>
  );
}

function NavRow({ item, pages, onChange, onRemove }: { item: NavItem; pages: NavPageOption[]; onChange: (p: Partial<NavItem>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const type = item.type ?? (item.href ? "link" : item.pageSystemKey === "services" ? "services" : item.children?.length ? "dropdown" : "page");
  const children = item.children ?? [];
  const setChild = (i: number, p: Partial<NavItem>) => onChange({ children: children.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="rounded-md border border-neutral-200 bg-white p-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" {...attributes} {...listeners} className="cursor-grab px-1 text-neutral-400" aria-label="Drag">⋮⋮</button>
        <Select value={type} className="w-32" onChange={(e) => { const t = e.target.value as NavItemType; onChange({ type: t, href: t === "link" ? item.href ?? "https://" : undefined, pageId: t === "page" ? item.pageId ?? pages[0]?.id : undefined, pageSystemKey: t === "services" ? "services" : undefined, children: t === "dropdown" ? children : undefined }); }}>{(Object.keys(NAV_ITEM_TYPE_META) as NavItemType[]).map((t) => <option key={t} value={t}>{NAV_ITEM_TYPE_META[t].label}</option>)}</Select>
        <Input value={item.label} className="w-40" placeholder="Label" onChange={(e) => onChange({ label: e.target.value })} />
        {type === "page" && <Select value={item.pageId ?? ""} className="w-48" onChange={(e) => onChange({ pageId: e.target.value, pageSystemKey: undefined })}>{pages.map((p) => <option key={p.id} value={p.id}>{p.title} {p.status !== "PUBLISHED" ? `(${p.status.toLowerCase()})` : ""}</option>)}</Select>}
        {type === "link" && <><Input value={item.href ?? ""} className="w-56" placeholder="https:// or /path or tel:" onChange={(e) => onChange({ href: e.target.value })} /><Checkbox checked={!!item.newTab} onChange={(e) => onChange({ newTab: e.target.checked })} label="New tab" /></>}
        {type === "services" && <Checkbox checked={!!item.mega} onChange={(e) => onChange({ mega: e.target.checked })} label="Mega menu (list services)" />}
        <span className="flex-1" />
        {type === "dropdown" && <Button size="sm" variant="ghost" onClick={() => onChange({ children: [...children, { id: uid(), label: pages[0]?.title ?? "Link", type: "page", pageId: pages[0]?.id }] })}>+ Child</Button>}
        <Button size="sm" variant="ghost" onClick={onRemove}>✕</Button>
      </div>
      {type === "dropdown" && (
        <ul className="mt-2 ml-6 space-y-1 border-l-2 border-neutral-200 pl-3">
          {children.map((c, i) => {
            const ct = c.type ?? (c.href ? "link" : "page");
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <Select value={ct} className="w-28" onChange={(e) => setChild(i, { type: e.target.value as NavItemType, href: e.target.value === "link" ? c.href ?? "https://" : undefined, pageId: e.target.value === "page" ? c.pageId ?? pages[0]?.id : undefined })}><option value="page">Page</option><option value="link">Custom link</option></Select>
                <Input value={c.label} className="w-40" onChange={(e) => setChild(i, { label: e.target.value })} />
                {ct === "page" ? <Select value={c.pageId ?? ""} className="w-48" onChange={(e) => setChild(i, { pageId: e.target.value })}>{pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select> : <Input value={c.href ?? ""} className="w-56" onChange={(e) => setChild(i, { href: e.target.value })} />}
                <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => onChange({ children: arrayMove(children, i, i - 1) })}>↑</Button>
                <Button size="sm" variant="ghost" onClick={() => onChange({ children: children.filter((_, j) => j !== i) })}>✕</Button>
              </li>
            );
          })}
          {children.length === 0 && <li className="text-xs text-neutral-500">No child items yet.</li>}
        </ul>
      )}
    </li>
  );
}
