"use client";

import * as React from "react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import type { MediaListItem } from "@/lib/media/library";
import { formatBytes } from "@/lib/media/format";

export function MediaDetail({ businessId, item, folders, onClose, onChanged, onError }: { businessId: string; item: MediaListItem; folders: Array<{ id: string; name: string; depth: number }>; onClose: () => void; onChanged: (msg: string) => void; onError: (msg: string) => void }) {
  const api = `/api/admin/${businessId}/media/${item.id}`;
  const [busy, setBusy] = React.useState(false);
  const [usage, setUsage] = React.useState<Array<{ type: string; label: string; href?: string }> | null>(null);
  const [crop, setCrop] = React.useState({ left: 0, top: 0, width: item.width ?? 0, height: item.height ?? 0 });
  const fileRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    fetch(api).then((r) => r.json()).then((d) => setUsage(Array.isArray(d.usage) ? d.usage : [])).catch(() => setUsage([]));
  }, [api]);
  const call = async (fn: () => Promise<Response>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      onChanged(okMsg);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const patch = (body: Record<string, unknown>, msg = "Saved") => call(() => fetch(api, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), msg);
  const transform = (ops: Record<string, unknown>, msg: string) => call(() => fetch(`${api}/transform`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ops) }), msg);
  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    void patch({ title: fd.get("title") || null, altText: fd.get("altText") || null, caption: fd.get("caption") || null, tags: String(fd.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean), folderId: (fd.get("folderId") as string) || null, visibility: fd.get("visibility") === "on" ? "PRIVATE" : "PUBLIC" });
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3"><h3 className="truncate text-base font-semibold">{item.title ?? item.originalName}</h3><Button variant="ghost" size="sm" onClick={onClose}>Close</Button></div>
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-center rounded-lg bg-neutral-100 p-2">{item.kind === "IMAGE" ? <img src={item.medium} alt={item.alt} className="max-h-72 rounded" /> : item.kind === "VIDEO" ? <video src={item.url} controls className="max-h-72 rounded" /> : <a href={item.url} target="_blank" rel="noreferrer" className="underline">Open file</a>}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-600"><span>Type: {item.mimeType}</span><span>Size: {formatBytes(item.sizeBytes)}</span>{item.width && <span>Dimensions: {item.width}×{item.height}</span>}<span>Uploaded: {new Date(item.createdAt).toLocaleString()}</span><span className="col-span-2 truncate">Key: {item.filename}</span></div>
          {item.deletedAt ? (
            <div className="flex gap-2"><Button disabled={busy} onClick={() => call(() => fetch(`${api}/restore`, { method: "POST" }), "Restored")}>Restore</Button></div>
          ) : (
            <>
              <form onSubmit={save} className="space-y-3">
                <Field label="Title"><Input name="title" defaultValue={item.title ?? ""} /></Field>
                <Field label="Alt text" hint="Describes the image for accessibility and SEO."><Input name="altText" defaultValue={item.alt} /></Field>
                <Field label="Caption"><Textarea name="caption" rows={2} defaultValue={item.caption ?? ""} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tags" hint="Comma separated"><Input name="tags" defaultValue={item.tags.join(", ")} /></Field>
                  <Field label="Folder"><Select name="folderId" defaultValue={item.folderId ?? ""}><option value="">Unfiled</option>{folders.map((f) => <option key={f.id} value={f.id}>{"— ".repeat(f.depth)}{f.name}</option>)}</Select></Field>
                </div>
                <Checkbox name="visibility" defaultChecked={item.visibility === "PRIVATE"} label="Private (requires sign-in or a signed link to view)" />
                <Button type="submit" disabled={busy}>Save details</Button>
              </form>
              {item.kind === "IMAGE" && (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="text-sm font-medium">Edit image</div>
                  <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy} onClick={() => transform({ rotate: -90 }, "Rotated")}>↺ Rotate left</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => transform({ rotate: 90 }, "Rotated")}>↻ Rotate right</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => transform({ flop: true }, "Flipped")}>Flip horizontal</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => transform({ flip: true }, "Flipped")}>Flip vertical</Button></div>
                  <div className="grid grid-cols-4 gap-2 text-xs">{(["left", "top", "width", "height"] as const).map((k) => <label key={k}>{k}<Input type="number" value={crop[k]} onChange={(e) => setCrop({ ...crop, [k]: Number(e.target.value) })} /></label>)}</div>
                  <Button size="sm" variant="secondary" disabled={busy || crop.width <= 0 || crop.height <= 0} onClick={() => transform({ crop }, "Cropped")}>Apply crop</Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); void call(() => fetch(`${api}/replace`, { method: "POST", body: fd }), "File replaced"); }} />
                <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>Replace file</Button>
                <a className="inline-flex h-9 items-center rounded-md border border-neutral-300 px-4 text-sm" href={item.url} download target="_blank" rel="noreferrer">Download</a>
                <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(item.url)}>Copy URL</Button>
                <Button variant="danger" disabled={busy} onClick={() => { if (window.confirm("Move this file to the trash?")) void call(() => fetch(api, { method: "DELETE" }), "Moved to trash"); }}>Delete</Button>
              </div>
            </>
          )}
          <div>
            <div className="mb-1 text-sm font-medium">Used in</div>
            {usage === null ? <p className="text-xs text-neutral-500">Checking…</p> : usage.length === 0 ? <p className="text-xs text-neutral-500">Not referenced anywhere yet.</p> : <ul className="text-xs">{usage.map((u, i) => <li key={i}>{u.href ? <a href={u.href} className="underline">{u.label}</a> : u.label} <span className="text-neutral-400">({u.type})</span></li>)}</ul>}
          </div>
        </div>
      </div>
    </div>
  );
}
