"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ExternalLink, MapPin } from "lucide-react";
import type { ServiceAreaType } from "@prisma/client";
import { Badge, cn } from "@/components/ui";
import { AREA_TYPE_LABELS } from "@/lib/content/areas";
import { DragHandle, SortableList } from "@/components/admin/content/services/sortable-list";
import { reorderAreasAction, toggleAreaFlagAction } from "@/app/admin/[businessId]/areas/actions";

export interface AreaTreeRowView {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  type: ServiceAreaType;
  postcode: string | null;
  state: string | null;
  isPrimary: boolean;
  isEnabled: boolean;
  generatePage: boolean;
  servicesCount: number;
  projectsCount: number;
  completeness: number;
  thin: boolean;
  archived: boolean;
  previewUrl: string;
  children: AreaTreeRowView[];
}

/**
 * Indented, collapsible tree of service areas. Siblings are reorderable with
 * @dnd-kit (explicit handle); enabled / page toggles save inline.
 */
export function AreasTree({ businessId, tree, sortable }: { businessId: string; tree: AreaTreeRowView[]; sortable: boolean }) {
  const [nodes, setNodes] = React.useState(tree);
  React.useEffect(() => setNodes(tree), [tree]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  const reorder = (parentId: string | null, ordered: AreaTreeRowView[]) => {
    const apply = (list: AreaTreeRowView[]): AreaTreeRowView[] => list.map((n) => ({ ...n, children: n.id === parentId ? ordered : apply(n.children) }));
    setNodes(parentId === null ? ordered : apply(nodes));
    startTransition(async () => {
      const res = await reorderAreasAction(businessId, ordered.map((n, i) => ({ id: n.id, sortOrder: i })));
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  const toggle = (id: string, flag: "isEnabled" | "generatePage", value: boolean) => {
    const apply = (list: AreaTreeRowView[]): AreaTreeRowView[] => list.map((n) => ({ ...n, [flag]: n.id === id ? value : n[flag], children: apply(n.children) }));
    setNodes(apply(nodes));
    startTransition(async () => {
      const res = await toggleAreaFlagAction(businessId, id, flag, value);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className={cn("rounded-xl border border-neutral-200 bg-white", pending && "opacity-80")}>
      {error && <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <div className="hidden grid-cols-[2.25rem_minmax(0,1fr)_7rem_5rem_5rem_6rem_6rem_6rem] items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 md:grid">
        <span />
        <span>Area</span>
        <span>Type</span>
        <span className="text-center">Services</span>
        <span className="text-center">Projects</span>
        <span className="text-center">Content</span>
        <span className="text-center">Enabled</span>
        <span className="text-center">Page</span>
      </div>
      <Level businessId={businessId} nodes={nodes} parentId={null} depth={0} sortable={sortable} onReorder={reorder} onToggle={toggle} />
    </div>
  );
}

function Level({ businessId, nodes, parentId, depth, sortable, onReorder, onToggle }: { businessId: string; nodes: AreaTreeRowView[]; parentId: string | null; depth: number; sortable: boolean; onReorder: (parentId: string | null, ordered: AreaTreeRowView[]) => void; onToggle: (id: string, flag: "isEnabled" | "generatePage", value: boolean) => void }) {
  return (
    <SortableList
      items={nodes}
      getId={(n) => n.id}
      disabled={!sortable}
      onReorder={(ordered) => onReorder(parentId, ordered)}
      renderItem={(node, _i, handle) => <Row key={node.id} businessId={businessId} node={node} depth={depth} handle={handle} sortable={sortable} onReorder={onReorder} onToggle={onToggle} />}
    />
  );
}

function Row({ businessId, node, depth, handle, sortable, onReorder, onToggle }: { businessId: string; node: AreaTreeRowView; depth: number; handle: React.ComponentProps<typeof DragHandle>; sortable: boolean; onReorder: (parentId: string | null, ordered: AreaTreeRowView[]) => void; onToggle: (id: string, flag: "isEnabled" | "generatePage", value: boolean) => void }) {
  const [open, setOpen] = React.useState(true);
  const hasChildren = node.children.length > 0;
  const tone = node.completeness >= 70 ? "green" : node.completeness >= 30 ? "amber" : "red";
  return (
    <div>
      <div className={cn("grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 border-b border-neutral-100 px-3 py-2 md:grid-cols-[2.25rem_minmax(0,1fr)_7rem_5rem_5rem_6rem_6rem_6rem]", !node.isEnabled && "bg-neutral-50/60")}>
        <div className="flex items-center">{sortable ? <DragHandle {...handle} /> : <span className="inline-block h-8 w-8" />}</div>
        <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${depth * 1.25}rem` }}>
          <button type="button" onClick={() => setOpen((o) => !o)} className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700", !hasChildren && "invisible")} aria-label={open ? "Collapse" : "Expand"}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <MapPin className="h-4 w-4 shrink-0 text-neutral-400" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href={`/admin/${businessId}/areas/${node.id}`} className={cn("truncate text-sm font-medium text-neutral-900 hover:underline", !node.isEnabled && "text-neutral-500")}>{node.name}</Link>
              {node.isPrimary && <Badge tone="blue">Primary</Badge>}
              {node.archived && <Badge tone="neutral">Archived</Badge>}
              {node.thin && node.generatePage && !node.archived && <Badge tone="amber" className="hidden sm:inline-flex">Thin · noindex</Badge>}
              {hasChildren && <span className="text-xs text-neutral-400">{node.children.length} sub-area{node.children.length === 1 ? "" : "s"}</span>}
            </div>
            <div className="truncate text-xs text-neutral-500">
              /{node.slug}
              {node.postcode && ` · ${node.postcode}`}
              {node.state && ` · ${node.state}`}
              <span className="md:hidden"> · {AREA_TYPE_LABELS[node.type]} · {node.servicesCount} services · {node.projectsCount} projects</span>
            </div>
          </div>
        </div>
        <div className="hidden text-xs text-neutral-600 md:block">{AREA_TYPE_LABELS[node.type]}</div>
        <div className="hidden text-center text-sm text-neutral-700 md:block">{node.servicesCount}</div>
        <div className="hidden text-center text-sm text-neutral-700 md:block">{node.projectsCount}</div>
        <div className="hidden justify-center md:flex" title={`Content completeness ${node.completeness}%`}>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-10 overflow-hidden rounded-full bg-neutral-200"><span className={cn("block h-full", tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-red-500")} style={{ width: `${node.completeness}%` }} /></span>
            <span className="text-xs text-neutral-500">{node.completeness}%</span>
          </span>
        </div>
        <div className="col-span-2 flex items-center justify-end gap-3 md:col-span-1 md:justify-center">
          <InlineToggle label="Enabled" checked={node.isEnabled} disabled={node.archived} onChange={(v) => onToggle(node.id, "isEnabled", v)} />
          <span className="md:hidden"><InlineToggle label="Page" checked={node.generatePage} disabled={node.archived} onChange={(v) => onToggle(node.id, "generatePage", v)} /></span>
        </div>
        <div className="hidden items-center justify-center gap-2 md:flex">
          <InlineToggle label="Page" checked={node.generatePage} disabled={node.archived} onChange={(v) => onToggle(node.id, "generatePage", v)} />
          {node.generatePage && !node.archived && (
            <a href={node.previewUrl} target="_blank" rel="noreferrer" title="Preview page" className="text-neutral-400 hover:text-neutral-900"><ExternalLink className="h-3.5 w-3.5" /></a>
          )}
        </div>
      </div>
      {hasChildren && open && <Level businessId={businessId} nodes={node.children} parentId={node.id} depth={depth + 1} sortable={sortable} onReorder={onReorder} onToggle={onToggle} />}
    </div>
  );
}

export function InlineToggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} disabled={disabled} onClick={() => onChange(!checked)} className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-40", checked ? "bg-emerald-500" : "bg-neutral-300")}>
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition", checked ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}
