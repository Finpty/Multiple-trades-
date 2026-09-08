"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Badge, Button, Input, Select, cn } from "@/components/ui";
import type { FolderNode, MediaListItem, StorageSummary, BulkMediaOp } from "@/lib/media/library";
import { formatBytes } from "@/lib/media/format";
import type { ActionResult } from "@/lib/actions";
import { MediaDetail } from "./media-detail";

interface Query { folder: string; kind: string; q: string; tag: string; sort: string; trashed: boolean }

export function MediaLibrary({ businessId, folders, items, total, page, pageSize, tags, summary, query, bulk, emptyTrash }: {
  businessId: string; folders: FolderNode[]; items: MediaListItem[]; total: number; page: number; pageSize: number; tags: Array<{ tag: string; count: number }>; summary: StorageSummary; query: Query;
  bulk: (businessId: string, ids: string[], op: BulkMediaOp) => Promise<ActionResult<{ count: number }>>;
  emptyTrash: (businessId: string) => Promise<ActionResult<{ count: number }>>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const api = `/api/admin/${businessId}/media`;
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [open, setOpen] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [drag, setDrag] = React.useState(false);
  const [pending, start] = React.useTransition();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const setParam = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") p.delete(k); else p.set(k, v); }
    p.delete("page");
    router.push(`?${p.toString()}`);
  };
  const refresh = () => router.refresh();
  const notify = (r: ActionResult<unknown> | { ok: boolean; error?: string; message?: string }) => setMsg(r.ok ? { tone: "success", text: (r as { message?: string }).message ?? "Done" } : { tone: "danger", text: (r as { error?: string }).error ?? "Failed" });

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(`Uploading ${list.length} file(s)…`);
    let ok = 0, failed = 0;
    for (const f of list) {
      const fd = new FormData();
      fd.append("file", f);
      if (query.folder && query.folder !== "all" && query.folder !== "root") fd.append("folderId", query.folder);
      const res = await fetch(api, { method: "POST", body: fd });
      if (res.ok) ok++; else failed++;
    }
    setUploading(null);
    setMsg({ tone: failed ? "danger" : "success", text: `${ok} uploaded${failed ? `, ${failed} failed` : ""}` });
    refresh();
  };

  const runBulk = (op: BulkMediaOp) => start(async () => { const r = await bulk(businessId, [...selected], op); notify(r); setSelected(new Set()); refresh(); });

  const folderApi = async (method: string, body: unknown) => {
    const res = await fetch(`${api}/folders`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { tone: "success", text: "Folder saved" } : { tone: "danger", text: data.error ?? "Folder action failed" });
    refresh();
  };

  const FolderTree = ({ nodes, depth = 0 }: { nodes: FolderNode[]; depth?: number }) => (
    <ul className={cn(depth > 0 && "ml-3 border-l border-neutral-200 pl-2")}>
      {nodes.map((n) => (
        <li key={n.id}>
          <div className={cn("group flex items-center justify-between rounded px-2 py-1 text-sm", query.folder === n.id ? "bg-neutral-900 text-white" : "hover:bg-neutral-100")}>
            <button type="button" className="truncate text-left" onClick={() => setParam({ folder: n.id, trashed: null })}>{n.name}</button>
            <span className="hidden gap-1 group-hover:flex">
              <button type="button" title="Rename" className="text-xs opacity-70" onClick={() => { const name = window.prompt("Folder name", n.name); if (name && name !== n.name) void folderApi("PATCH", { id: n.id, name }); }}>✎</button>
              <button type="button" title="New subfolder" className="text-xs opacity-70" onClick={() => { const name = window.prompt("New subfolder name"); if (name) void folderApi("POST", { name, parentId: n.id }); }}>＋</button>
              <button type="button" title="Delete" className="text-xs opacity-70" onClick={() => { if (window.confirm(`Delete folder "${n.name}"? Files move to the parent folder.`)) void fetch(`${api}/folders?id=${n.id}&moveContents=1`, { method: "DELETE" }).then(refresh); }}>✕</button>
            </span>
          </div>
          {n.children.length > 0 && <FolderTree nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );

  const current = items.find((i) => i.id === open) ?? null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]" onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}>
      <aside className="space-y-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-2">
          <div className="mb-1 flex items-center justify-between px-2 text-xs font-semibold uppercase text-neutral-500">Folders<button type="button" title="New folder" onClick={() => { const name = window.prompt("Folder name"); if (name) void folderApi("POST", { name, parentId: null }); }}>＋</button></div>
          <button type="button" className={cn("block w-full rounded px-2 py-1 text-left text-sm", query.folder === "all" && !query.trashed ? "bg-neutral-900 text-white" : "hover:bg-neutral-100")} onClick={() => setParam({ folder: null, trashed: null })}>All files</button>
          <button type="button" className={cn("block w-full rounded px-2 py-1 text-left text-sm", query.folder === "root" ? "bg-neutral-900 text-white" : "hover:bg-neutral-100")} onClick={() => setParam({ folder: "root", trashed: null })}>Unfiled</button>
          <FolderTree nodes={folders} />
          <button type="button" className={cn("mt-2 block w-full rounded px-2 py-1 text-left text-sm", query.trashed ? "bg-red-600 text-white" : "text-neutral-500 hover:bg-neutral-100")} onClick={() => setParam({ trashed: "1", folder: null })}>Trash</button>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
          <div className="font-semibold text-neutral-800">Storage</div>
          <div>{summary.files} files · {formatBytes(summary.bytes)}</div>
          {summary.byKind.map((k) => <div key={k.kind}>{k.kind.toLowerCase()}: {k.files} ({formatBytes(k.bytes)})</div>)}
          {summary.trashed.files > 0 && <div className="mt-1">{summary.trashed.files} in trash</div>}
        </div>
        {tags.length > 0 && <div className="rounded-lg border border-neutral-200 bg-white p-3"><div className="mb-1 text-xs font-semibold uppercase text-neutral-500">Tags</div><div className="flex flex-wrap gap-1">{tags.map((t) => <button key={t.tag} type="button" onClick={() => setParam({ tag: query.tag === t.tag ? null : t.tag })} className={cn("rounded-full px-2 py-0.5 text-xs", query.tag === t.tag ? "bg-neutral-900 text-white" : "bg-neutral-100")}>{t.tag} <span className="opacity-60">{t.count}</span></button>)}</div></div>}
      </aside>
      <div className="min-w-0 space-y-3">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="flex flex-wrap items-center gap-2">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setParam({ q: (new FormData(e.currentTarget).get("q") as string) || null }); }}><Input name="q" defaultValue={query.q} placeholder="Search…" className="w-48" /></form>
          <Select value={query.kind} onChange={(e) => setParam({ kind: e.target.value || null })} className="w-auto"><option value="">All types</option><option value="IMAGE">Images</option><option value="VIDEO">Videos</option><option value="DOCUMENT">Documents</option></Select>
          <Select value={query.sort} onChange={(e) => setParam({ sort: e.target.value })} className="w-auto"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name</option><option value="size">Size</option></Select>
          <Button variant="ghost" size="sm" onClick={() => setView(view === "grid" ? "list" : "grid")}>{view === "grid" ? "List view" : "Grid view"}</Button>
          <span className="flex-1" />
          {query.trashed ? (
            <Button variant="danger" size="sm" disabled={pending} onClick={() => { if (window.confirm("Permanently delete everything in the trash?")) start(async () => { notify(await emptyTrash(businessId)); refresh(); }); }}>Empty trash</Button>
          ) : (
            <>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} />
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={!!uploading}>{uploading ?? "Upload files"}</Button>
            </>
          )}
        </div>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            {query.trashed ? (<><Button size="sm" variant="secondary" onClick={() => runBulk({ op: "restore" })}>Restore</Button><Button size="sm" variant="danger" onClick={() => { if (window.confirm("Permanently delete the selected files?")) runBulk({ op: "purge" }); }}>Delete forever</Button></>) : (<>
              <Select className="w-auto" defaultValue="" onChange={(e) => { if (e.target.value) runBulk({ op: "move", folderId: e.target.value === "root" ? null : e.target.value }); }}><option value="">Move to…</option><option value="root">Unfiled</option>{flatten(folders).map((f) => <option key={f.id} value={f.id}>{"— ".repeat(f.depth)}{f.name}</option>)}</Select>
              <Button size="sm" variant="secondary" onClick={() => { const tag = window.prompt("Add tag"); if (tag) runBulk({ op: "addTag", tag }); }}>Add tag</Button>
              <Button size="sm" variant="secondary" onClick={() => runBulk({ op: "visibility", visibility: "PRIVATE" })}>Make private</Button>
              <Button size="sm" variant="secondary" onClick={() => runBulk({ op: "visibility", visibility: "PUBLIC" })}>Make public</Button>
              <Button size="sm" variant="danger" onClick={() => runBulk({ op: "delete" })}>Move to trash</Button>
            </>)}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
        <div className={cn("min-h-64 rounded-lg border-2 border-dashed p-3 transition", drag ? "border-neutral-900 bg-neutral-50" : "border-transparent")}>
          {items.length === 0 ? (
            <div className="py-16 text-center text-sm text-neutral-500">{query.trashed ? "Trash is empty." : "No files here yet. Drag & drop files anywhere, or click Upload files."}</div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {items.map((m) => (
                <div key={m.id} className={cn("group relative overflow-hidden rounded-lg border bg-white", selected.has(m.id) ? "border-neutral-900 ring-2 ring-neutral-900" : "border-neutral-200")}>
                  <input type="checkbox" className="absolute left-2 top-2 z-10 h-4 w-4" checked={selected.has(m.id)} onChange={(e) => { const s = new Set(selected); if (e.target.checked) s.add(m.id); else s.delete(m.id); setSelected(s); }} />
                  <button type="button" className="block w-full" onClick={() => setOpen(m.id)}>
                    <div className="aspect-square bg-neutral-100">{m.kind === "IMAGE" ? <img src={m.thumb} alt={m.alt} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center text-xs text-neutral-500"><span className="text-2xl">{m.kind === "VIDEO" ? "🎬" : "📄"}</span>{m.mimeType.split("/")[1]}</div>}</div>
                    <div className="truncate px-2 py-1 text-left text-[11px] text-neutral-700">{m.title ?? m.originalName}</div>
                  </button>
                  {m.visibility === "PRIVATE" && <Badge className="absolute right-2 top-2">private</Badge>}
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-sm"><thead className="text-left text-xs uppercase text-neutral-500"><tr><th></th><th className="py-1">File</th><th>Type</th><th>Size</th><th>Tags</th><th>Uploaded</th></tr></thead><tbody className="divide-y divide-neutral-100">{items.map((m) => <tr key={m.id} className="hover:bg-neutral-50"><td className="py-1.5"><input type="checkbox" checked={selected.has(m.id)} onChange={(e) => { const s = new Set(selected); if (e.target.checked) s.add(m.id); else s.delete(m.id); setSelected(s); }} /></td><td className="py-1.5"><button type="button" className="flex items-center gap-2 text-left" onClick={() => setOpen(m.id)}>{m.kind === "IMAGE" && <img src={m.thumb} alt="" className="h-8 w-8 rounded object-cover" />}<span>{m.title ?? m.originalName}</span></button></td><td className="text-neutral-500">{m.kind.toLowerCase()}</td><td className="text-neutral-500">{formatBytes(m.sizeBytes)}</td><td className="text-xs">{m.tags.join(", ")}</td><td className="text-neutral-500">{new Date(m.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>
          )}
        </div>
        {pages > 1 && <div className="flex items-center justify-between text-sm text-neutral-500"><span>{total} files</span><span className="flex gap-2">{page > 1 && <Button size="sm" variant="ghost" onClick={() => { const p = new URLSearchParams(sp.toString()); p.set("page", String(page - 1)); router.push(`?${p}`); }}>Previous</Button>}<span>Page {page} of {pages}</span>{page < pages && <Button size="sm" variant="ghost" onClick={() => { const p = new URLSearchParams(sp.toString()); p.set("page", String(page + 1)); router.push(`?${p}`); }}>Next</Button>}</span></div>}
      </div>
      {current && <MediaDetail businessId={businessId} item={current} folders={flatten(folders)} onClose={() => setOpen(null)} onChanged={(text) => { setMsg({ tone: "success", text }); refresh(); }} onError={(text) => setMsg({ tone: "danger", text })} />}
    </div>
  );
}

function flatten(nodes: FolderNode[], depth = 0): Array<{ id: string; name: string; depth: number }> {
  return nodes.flatMap((n) => [{ id: n.id, name: n.name, depth }, ...flatten(n.children, depth + 1)]);
}
