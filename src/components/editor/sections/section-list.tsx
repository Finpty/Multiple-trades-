"use client";

import { Copy, Eye, EyeOff, Trash2, AlertCircle } from "lucide-react";
import { Badge, cn } from "@/components/ui";
import { BLOCK_META, type BlockType } from "@/lib/blocks/schema";
import { sectionSummary } from "@/lib/website/pages";
import type { SectionView } from "@/lib/website/section-types";
import { SortableRows } from "@/components/editor/schema-form/sortable-rows";

export interface SectionListProps {
  sections: SectionView[];
  selectedId: string | null;
  dirtyIds: Set<string>;
  errorIds: Set<string>;
  busy?: boolean;
  onSelect: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onDuplicate: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Ordered, sortable list of the page's sections with row actions. */
export function SectionList({ sections, selectedId, dirtyIds, errorIds, busy, onSelect, onReorder, onDuplicate, onToggleHidden, onDelete }: SectionListProps) {
  return (
    <SortableRows
      items={sections}
      getId={(s) => s.id}
      disabled={busy}
      onReorder={(next) => onReorder(next.map((s) => s.id))}
      renderRow={(s, i, handle) => {
        const meta = BLOCK_META[s.type as BlockType];
        const selected = s.id === selectedId;
        const summary = sectionSummary(s.type, s.props);
        return (
          <div className={cn("flex items-center gap-1 rounded-lg border bg-white pr-1", selected ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200 hover:border-neutral-400", s.isHidden && "opacity-70")}>
            {handle}
            <button type="button" onClick={() => onSelect(s.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left">
              <span className="w-5 shrink-0 text-center text-[11px] text-neutral-400">{i + 1}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-neutral-900">{meta?.label ?? s.type}</span>
                  {s.isHidden && <Badge tone="neutral">Hidden</Badge>}
                  {dirtyIds.has(s.id) && <Badge tone="amber">Unsaved</Badge>}
                  {errorIds.has(s.id) && <AlertCircle className="h-3.5 w-3.5 text-red-600" aria-label="Has errors" />}
                </span>
                {summary && <span className="block truncate text-xs text-neutral-500">{summary}</span>}
              </span>
            </button>
            <div className="flex shrink-0 items-center">
              <IconButton title="Duplicate" onClick={() => onDuplicate(s.id)} disabled={busy}><Copy className="h-3.5 w-3.5" /></IconButton>
              <IconButton title={s.isHidden ? "Show section" : "Hide section"} onClick={() => onToggleHidden(s.id)} disabled={busy}>{s.isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</IconButton>
              <IconButton title="Delete" onClick={() => onDelete(s.id)} disabled={busy} danger><Trash2 className="h-3.5 w-3.5" /></IconButton>
            </div>
          </div>
        );
      }}
    />
  );
}

function IconButton({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className={cn("flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-40", danger ? "hover:text-red-600" : "hover:text-neutral-900")}>
      {children}
    </button>
  );
}
