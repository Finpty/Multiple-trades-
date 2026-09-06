"use client";

import * as React from "react";
import { Button, cn, inputClass } from "@/components/ui";

export interface PickedMedia {
  id: string;
  url: string;
  thumb: string;
  medium?: string;
  alt: string;
  kind: string;
  title?: string | null;
  originalName?: string;
}

/**
 * Media picker: browse the business library, upload new files, pick one.
 * Emits the media id (and a preview) — never asks for external URLs.
 * Used by every admin form that references an image/video (services,
 * projects, branding, block props, team, materials…).
 */
export function MediaPicker({
  businessId,
  value,
  onChange,
  kind = "IMAGE",
  label = "Choose media",
  name,
  preview,
  folderKey,
  className,
}: {
  businessId: string;
  value: string | null;
  onChange: (media: PickedMedia | null) => void;
  kind?: "IMAGE" | "VIDEO" | "DOCUMENT" | "ANY";
  label?: string;
  /** When given, a hidden input carries the media id for plain <form> submissions. */
  name?: string;
  preview?: PickedMedia | null;
  folderKey?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<PickedMedia | null>(preview ?? null);
  React.useEffect(() => {
    setCurrent(preview ?? null);
  }, [preview]);

  React.useEffect(() => {
    if (value && !current) {
      fetch(`/api/admin/${businessId}/media?q=&page=1`).then(async (r) => {
        if (!r.ok) return;
        const data = (await r.json()) as { items: PickedMedia[] };
        const found = data.items.find((i) => i.id === value);
        if (found) setCurrent(found);
      }).catch(() => undefined);
    }
  }, [value, current, businessId]);

  const pick = (m: PickedMedia | null) => {
    setCurrent(m);
    onChange(m);
    setOpen(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
          {current ? (
            current.kind === "IMAGE" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.thumb} alt={current.alt} className="h-full w-full object-cover" />
            ) : (
              <span className="px-2 text-center text-xs text-neutral-600">{current.title ?? current.originalName ?? current.kind}</span>
            )
          ) : (
            <span className="text-xs text-neutral-400">No file</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>{current ? "Replace" : label}</Button>
          {current && <Button type="button" variant="ghost" size="sm" onClick={() => pick(null)}>Remove</Button>}
        </div>
      </div>
      {open && <MediaBrowserDialog businessId={businessId} kind={kind} onClose={() => setOpen(false)} onPick={pick} folderKey={folderKey} />}
    </div>
  );
}

export function MediaBrowserDialog({ businessId, kind, onClose, onPick, folderKey, multiple }: { businessId: string; kind: "IMAGE" | "VIDEO" | "DOCUMENT" | "ANY"; onClose: () => void; onPick: (m: PickedMedia) => void; folderKey?: string; multiple?: boolean }) {
  const [items, setItems] = React.useState<PickedMedia[]>([]);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, page: "1" });
      if (kind !== "ANY") params.set("kind", kind);
      const res = await fetch(`/api/admin/${businessId}/media?${params}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load media");
      const data = (await res.json()) as { items: PickedMedia[] };
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [businessId, kind, q]);

  React.useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("file", f);
      if (folderKey) fd.append("folderKey", folderKey);
      const res = await fetch(`/api/admin/${businessId}/media`, { method: "POST", body: fd });
      const data = (await res.json()) as { items?: PickedMedia[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      if (data.items?.length) {
        if (!multiple) onPick(data.items[0]);
        else await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal>
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <h3 className="text-base font-semibold">Media library</h3>
          <div className="flex items-center gap-2">
            <input className={cn(inputClass, "h-9 w-56")} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            <input ref={fileRef} type="file" className="hidden" multiple={multiple} accept={kind === "IMAGE" ? "image/*" : kind === "VIDEO" ? "video/*" : kind === "DOCUMENT" ? "application/pdf" : undefined} onChange={(e) => upload(e.target.files)} />
            <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          {loading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-neutral-500">No media yet. Upload your first file.</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {items.map((m) => (
                <button key={m.id} type="button" onClick={() => onPick(m)} className="group overflow-hidden rounded-md border border-neutral-200 text-left hover:border-neutral-900">
                  <div className="aspect-square bg-neutral-100">
                    {m.kind === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumb} alt={m.alt} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-neutral-500">{m.kind}</div>
                    )}
                  </div>
                  <div className="truncate px-2 py-1 text-[11px] text-neutral-600">{m.title ?? m.originalName}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
