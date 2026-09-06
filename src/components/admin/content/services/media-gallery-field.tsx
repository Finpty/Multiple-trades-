"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { MediaBrowserDialog, type PickedMedia } from "@/components/admin/media-picker";
import { DragHandle, SortableList } from "./sortable-list";

export interface GalleryItem {
  id: string;
  thumb: string;
  alt: string;
  kind: string;
  title?: string | null;
}

/**
 * Ordered multi-image gallery: pick several from the library (or upload),
 * drag to reorder, remove. Submits ordered media ids as `<name>:json`.
 */
export function MediaGalleryField({ businessId, name, items, onChange, kind = "IMAGE", max = 100 }: { businessId: string; name: string; items: GalleryItem[]; onChange: (items: GalleryItem[]) => void; kind?: "IMAGE" | "VIDEO" | "ANY"; max?: number }) {
  const [open, setOpen] = React.useState(false);
  const add = (m: PickedMedia) => {
    if (items.some((i) => i.id === m.id) || items.length >= max) return;
    onChange([...items, { id: m.id, thumb: m.thumb, alt: m.alt, kind: m.kind, title: m.title }]);
  };
  return (
    <div className="space-y-3">
      <input type="hidden" name={`${name}:json`} value={JSON.stringify(items.map((i) => i.id))} />
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">No images yet. Add from the library or upload new ones.</p>
      ) : (
        <SortableList
          items={items}
          getId={(i) => i.id}
          onReorder={onChange}
          layout="grid"
          className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6"
          renderItem={(item, index, handle) => (
            <div className="group relative overflow-hidden rounded-md border border-neutral-200 bg-white">
              <div className="aspect-square bg-neutral-100">
                {item.kind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumb} alt={item.alt} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-500">{item.kind}</div>
                )}
              </div>
              <div className="flex items-center justify-between px-1 py-0.5">
                <DragHandle {...handle} className="h-6 w-6" />
                <span className="text-[11px] text-neutral-500">#{index + 1}</span>
                <button type="button" aria-label="Remove" className="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600" onClick={() => onChange(items.filter((i) => i.id !== item.id))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        />
      )}
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} disabled={items.length >= max}>Add images</Button>
      {open && <MediaBrowserDialog businessId={businessId} kind={kind} multiple onClose={() => setOpen(false)} onPick={add} />}
    </div>
  );
}
