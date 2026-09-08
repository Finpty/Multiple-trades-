"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Alert, Badge, Button, Select, cn, statusTone } from "@/components/ui";
import { MediaBrowserDialog, type PickedMedia } from "@/components/admin/media-picker";
import { SchemaForm, SectionPropsForm } from "@/components/editor/schema-form/schema-form";
import type { SectionActions } from "@/components/editor/sections/section-editor";
import { BLOCK_META, BLOCK_TYPES, SectionSettingsSchema, type BlockType } from "@/lib/blocks/schema";
import type { SectionView } from "@/lib/website/section-types";
import type { EditorOptions } from "@/lib/website/options";
import type { ActionResult } from "@/lib/actions";
import { getPath, setPath } from "@/lib/website/paths";
import { EDITOR_SOURCE, isEditorMessage, type EditorToSiteMessage, type SiteToEditorMessage } from "@/lib/editor/protocol";

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };

interface PageRef { id: string; title: string; slug: string; status: string }

interface LiveActions extends SectionActions {
  list: (businessId: string, pageId: string) => Promise<ActionResult<SectionView[]>>;
  lifecycle: (businessId: string, pageId: string, action: "publish" | "unpublish" | "duplicate" | "archive" | "restore" | "cancelSchedule") => Promise<ActionResult<{ id?: string }>>;
}

function summary(s: SectionView): string {
  const p = s.props;
  return String(p.heading ?? p.title ?? p.eyebrow ?? p.body ?? "").slice(0, 60);
}

/**
 * Live visual editor. Left: the draft page in an iframe (click a section to
 * select it, click text to edit it inline, click an image to replace it).
 * Right: the schema-driven form for the selected section, or the section
 * list for reordering, hiding, duplicating, deleting and adding blocks.
 * Every change saves the draft; Publish makes the page live.
 */
export function LiveEditor({ businessId, page, pages, initial, options, siteUrl, canPublish, actions }: { businessId: string; page: PageRef; pages: PageRef[]; initial: SectionView[]; options: EditorOptions; siteUrl: string; canPublish: boolean; actions: LiveActions }) {
  const router = useRouter();
  const frame = React.useRef<HTMLIFrameElement>(null);
  const [sections, setSections] = React.useState(initial);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [panel, setPanel] = React.useState<"edit" | "sections">("sections");
  const [device, setDevice] = React.useState<Device>("desktop");
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [adding, setAdding] = React.useState<BlockType>("text");
  const [imagePick, setImagePick] = React.useState<{ sectionId: string; field: string } | null>(null);
  const [pending, start] = React.useTransition();
  const previewUrl = `${siteUrl}${page.slug ? `/${page.slug}` : ""}?__preview=draft&__editor=1`;
  const current = sections.find((s) => s.id === selected) ?? null;
  const sectionsRef = React.useRef(sections);
  sectionsRef.current = sections;
  const selectedRef = React.useRef(selected);
  selectedRef.current = selected;

  const post = React.useCallback((m: EditorToSiteMessage) => frame.current?.contentWindow?.postMessage(m, "*"), []);
  const reload = React.useCallback(() => post({ source: EDITOR_SOURCE, type: "reload" }), [post]);

  const fail = (text: string) => { setStatus("error"); setMsg({ tone: "danger", text }); };
  const applyList = (r: ActionResult<SectionView[]>, andReload = true) => {
    if (r.ok) { setSections(r.data); setStatus("saved"); if (andReload) reload(); } else fail(r.error);
  };

  // Debounced save for form edits (props/settings); reloads the preview after saving.
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = (section: SectionView) => {
    setSections((list) => list.map((s) => (s.id === section.id ? section : s)));
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(async () => {
      const r = await actions.update(businessId, section.id, section.props, section.settings);
      if (r.ok) { setStatus("saved"); setMsg(null); reload(); } else fail(r.error);
    }, 600);
  };

  // Immediate save for inline text edits coming from the preview (no reload needed).
  const saveInline = async (sectionId: string, field: string, value: string) => {
    const section = sectionsRef.current.find((s) => s.id === sectionId);
    if (!section) return;
    if (getPath(section.props, field) === value) return;
    const next = { ...section, props: setPath(section.props, field, value) };
    setSections((list) => list.map((s) => (s.id === sectionId ? next : s)));
    setStatus("saving");
    const r = await actions.update(businessId, sectionId, next.props, next.settings);
    if (r.ok) { setStatus("saved"); setMsg(null); } else fail(r.error);
  };

  const pickImage = async (m: PickedMedia) => {
    if (!imagePick) return;
    const section = sectionsRef.current.find((s) => s.id === imagePick.sectionId);
    setImagePick(null);
    if (!section) return;
    const existing = getPath(section.props, imagePick.field);
    const ref = { ...(existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {}), mediaId: m.id, url: null, alt: (existing as { alt?: string } | undefined)?.alt || m.alt };
    const next = { ...section, props: setPath(section.props, imagePick.field, ref) };
    setSections((list) => list.map((s) => (s.id === section.id ? next : s)));
    setStatus("saving");
    const r = await actions.update(businessId, section.id, next.props, next.settings);
    if (r.ok) { setStatus("saved"); reload(); } else fail(r.error);
  };

  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isEditorMessage(e.data) || e.source !== frame.current?.contentWindow) return;
      const m = e.data as SiteToEditorMessage;
      switch (m.type) {
        case "ready":
          if (selectedRef.current) { post({ source: EDITOR_SOURCE, type: "select", sectionId: selectedRef.current }); post({ source: EDITOR_SOURCE, type: "scrollTo", sectionId: selectedRef.current }); }
          break;
        case "sectionClick":
          setSelected(m.sectionId);
          setPanel("edit");
          break;
        case "textEdit":
          void saveInline(m.sectionId, m.field, m.value);
          break;
        case "imageClick":
          setSelected(m.sectionId);
          setImagePick({ sectionId: m.sectionId, field: m.field });
          break;
        default:
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post]);

  const select = (id: string | null) => {
    setSelected(id);
    post({ source: EDITOR_SOURCE, type: "select", sectionId: id });
    if (id) post({ source: EDITOR_SOURCE, type: "scrollTo", sectionId: id });
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = sections.findIndex((s) => s.id === id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= sections.length) return;
    const next = [...sections];
    [next[idx], next[to]] = [next[to], next[idx]];
    setSections(next);
    setStatus("saving");
    applyList(await actions.reorder(businessId, page.id, next.map((s) => s.id)));
  };

  const addBlock = async () => {
    const idx = selected ? sections.findIndex((s) => s.id === selected) + 1 : undefined;
    setStatus("saving");
    const r = await actions.add(businessId, page.id, adding, idx);
    if (!r.ok) return fail(r.error);
    const list = await actions.list(businessId, page.id);
    if (list.ok) setSections(list.data); else setSections((l) => [...l, r.data]);
    setStatus("saved");
    setSelected(r.data.id);
    setPanel("edit");
    reload();
  };

  const publish = () => start(async () => {
    const r = await actions.lifecycle(businessId, page.id, "publish");
    setMsg(r.ok ? { tone: "success", text: "Page published" } : { tone: "danger", text: r.error });
    router.refresh();
  });

  const statusText = { idle: "", saving: "Saving…", saved: "All changes saved", error: "Save failed" }[status];

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-3.5rem)] flex-col lg:-mx-8">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-white px-3">
        <Link href={`/admin/${businessId}/website/pages`} className="text-sm text-neutral-600 hover:text-neutral-900">← Pages</Link>
        <Select value={page.id} onChange={(e) => router.push(`/admin/${businessId}/website/editor?page=${e.target.value}`)} className="w-auto max-w-56" aria-label="Page">
          {pages.map((p) => <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>)}
        </Select>
        <Badge tone={statusTone(page.status)}>{page.status}</Badge>
        <div className="ml-2 flex gap-1">{(["desktop", "tablet", "mobile"] as Device[]).map((d) => <Button key={d} size="sm" variant={device === d ? "primary" : "secondary"} onClick={() => setDevice(d)} aria-label={`${d} preview`}>{d}</Button>)}</div>
        <span className={cn("ml-auto text-xs", status === "error" ? "text-red-600" : "text-neutral-500")}>{statusText}</span>
        <Link href={`${siteUrl}${page.slug ? `/${page.slug}` : ""}?__preview=draft`} target="_blank" className="text-sm text-neutral-600 hover:text-neutral-900">Preview ↗</Link>
        <Link href={`/admin/${businessId}/website/pages/${page.id}/settings`} className="text-sm text-neutral-600 hover:text-neutral-900">Settings</Link>
        {canPublish && <Button size="sm" onClick={publish} disabled={pending || status === "saving"}>{pending ? "Publishing…" : "Publish page"}</Button>}
      </div>
      {msg && <div className="px-3 pt-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 justify-center overflow-auto bg-neutral-100 p-3">
          <iframe ref={frame} src={previewUrl} title="Page preview" className="h-full rounded-md bg-white shadow-sm transition-[width]" style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }} />
        </div>
        <aside className="flex w-[380px] shrink-0 flex-col border-l bg-white">
          <div className="flex border-b">
            {(["sections", "edit"] as const).map((k) => <button key={k} type="button" onClick={() => setPanel(k)} className={cn("flex-1 border-b-2 py-2 text-sm", panel === k ? "border-neutral-900 font-medium" : "border-transparent text-neutral-500 hover:text-neutral-900")}>{k === "edit" ? "Edit section" : "Sections"}</button>)}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {panel === "sections" && (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500">Click a section in the preview or below. Click any text in the preview to edit it in place; click an image to replace it.</p>
                <ul className="space-y-1">
                  {sections.map((s, i) => (
                    <li key={s.id} className={cn("flex items-center gap-1 rounded-md border px-2 py-1.5", s.id === selected ? "border-neutral-900 bg-neutral-50" : "border-neutral-200", s.isHidden && "opacity-60")}>
                      <button type="button" onClick={() => select(s.id)} className="min-w-0 flex-1 text-left"><span className="text-sm font-medium">{BLOCK_META[s.type as BlockType]?.label ?? s.type}</span><span className="ml-2 truncate text-xs text-neutral-500">{summary(s)}</span></button>
                      <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => move(s.id, -1)} title="Move up">↑</Button>
                      <Button variant="ghost" size="sm" disabled={i === sections.length - 1} onClick={() => move(s.id, 1)} title="Move down">↓</Button>
                      <Button variant="ghost" size="sm" onClick={async () => { setStatus("saving"); const r = await actions.toggleHidden(businessId, s.id); if (r.ok) { setSections((l) => l.map((x) => (x.id === s.id ? r.data : x))); setStatus("saved"); reload(); } else fail(r.error); }} title={s.isHidden ? "Show" : "Hide"}>{s.isHidden ? "👁" : "🙈"}</Button>
                      <Button variant="ghost" size="sm" onClick={async () => { setStatus("saving"); applyList(await actions.duplicate(businessId, s.id)); }} title="Duplicate">⧉</Button>
                      <Button variant="ghost" size="sm" onClick={async () => { if (!window.confirm("Delete this section?")) return; setStatus("saving"); applyList(await actions.remove(businessId, s.id)); if (selected === s.id) setSelected(null); }} title="Delete">✕</Button>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2 border-t pt-3">
                  <Select value={adding} onChange={(e) => setAdding(e.target.value as BlockType)} className="w-auto flex-1" aria-label="Block type">
                    {["layout", "content", "media", "data", "social-proof", "conversion"].map((cat) => <optgroup key={cat} label={cat.replace("-", " ")}>{BLOCK_TYPES.filter((t) => BLOCK_META[t].category === cat).map((t) => <option key={t} value={t}>{BLOCK_META[t].label}</option>)}</optgroup>)}
                  </Select>
                  <Button size="sm" onClick={addBlock}>+ Add block</Button>
                </div>
                <p className="text-xs text-neutral-500">{BLOCK_META[adding].description}{selected ? " Inserted after the selected section." : ""}</p>
              </div>
            )}
            {panel === "edit" && (current ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between"><div><div className="text-sm font-semibold">{BLOCK_META[current.type as BlockType]?.label ?? current.type}</div><div className="text-xs text-neutral-500">{BLOCK_META[current.type as BlockType]?.description}</div></div>{current.isHidden && <Badge>hidden</Badge>}</div>
                <SectionPropsForm type={current.type} value={current.props} onChange={(props) => queueSave({ ...current, props })} businessId={businessId} options={options} />
                <details className="rounded-md border p-2"><summary className="cursor-pointer text-sm font-medium">Section settings</summary><div className="mt-2"><SchemaForm schema={SectionSettingsSchema as unknown as z.ZodObject<z.ZodRawShape>} value={current.settings} onChange={(settings) => queueSave({ ...current, settings })} businessId={businessId} options={options} /></div></details>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Select a section in the preview to edit its content.</p>
            ))}
          </div>
        </aside>
      </div>
      {imagePick && <MediaBrowserDialog businessId={businessId} kind={imagePick.field === "video" ? "VIDEO" : "IMAGE"} onClose={() => setImagePick(null)} onPick={pickImage} />}
    </div>
  );
}
