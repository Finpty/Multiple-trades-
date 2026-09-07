"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, PointerSensor, closestCorners, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import type { LeadStatus } from "@prisma/client";
import { Alert, Badge, cn, statusTone } from "@/components/ui";
import { BOARD_STATUSES, leadStatusLabel } from "@/lib/crm/leads";
import { moveLead } from "@/app/admin/[businessId]/leads/actions";

export interface BoardLead {
  id: string;
  name: string;
  status: LeadStatus;
  service: string | null;
  value: string | null;
  assignee: string | null;
  createdAt: string;
  source: string | null;
}

/** Kanban view: one column per lead status; dropping a card into a column changes the status. */
export function LeadBoard({ businessId, leads, canManage }: { businessId: string; leads: BoardLead[]; canManage: boolean }) {
  const router = useRouter();
  const [items, setItems] = React.useState(leads);
  const [active, setActive] = React.useState<BoardLead | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  React.useEffect(() => setItems(leads), [leads]);

  function onDragStart(e: DragStartEvent) {
    setActive(items.find((l) => l.id === e.active.id) ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const leadId = String(e.active.id);
    const to = e.over ? (String(e.over.id).startsWith("col:") ? (String(e.over.id).slice(4) as LeadStatus) : items.find((l) => l.id === e.over!.id)?.status) : undefined;
    const lead = items.find((l) => l.id === leadId);
    if (!to || !lead || lead.status === to) return;
    const previous = items;
    setItems((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: to } : l)));
    startTransition(async () => {
      const res = await moveLead(businessId, leadId, to);
      if (!res.ok) {
        setItems(previous);
        setError(res.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <div>
      {error && (
        <Alert tone="danger" className="mb-3">
          {error}
        </Alert>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className={cn("grid gap-3 overflow-x-auto pb-2", "grid-cols-[repeat(6,minmax(14rem,1fr))]", pending && "opacity-80")}>
          {BOARD_STATUSES.map((status) => (
            <Column key={status} status={status} businessId={businessId} leads={items.filter((l) => l.status === status)} canManage={canManage} />
          ))}
        </div>
        <DragOverlay>{active ? <CardView lead={active} businessId={businessId} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ status, leads, businessId, canManage }: { status: LeadStatus; leads: BoardLead[]; businessId: string; canManage: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <div ref={setNodeRef} className={cn("flex min-h-[16rem] flex-col rounded-lg border bg-neutral-50 p-2", isOver ? "border-neutral-900" : "border-neutral-200")}>
      <div className="mb-2 flex items-center justify-between px-1">
        <Badge tone={statusTone(status)}>{leadStatusLabel(status)}</Badge>
        <span className="text-xs text-neutral-500">{leads.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {leads.map((l) => (
          <DraggableCard key={l.id} lead={l} businessId={businessId} disabled={!canManage} />
        ))}
        {leads.length === 0 && <div className="rounded-md border border-dashed border-neutral-200 p-3 text-center text-xs text-neutral-400">Drop leads here</div>}
      </div>
    </div>
  );
}

function DraggableCard({ lead, businessId, disabled }: { lead: BoardLead; businessId: string; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, disabled });
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <CardView lead={lead} businessId={businessId} handle={disabled ? null : { attributes, listeners }} />
    </div>
  );
}

function CardView({ lead, businessId, handle, overlay }: { lead: BoardLead; businessId: string; handle?: { attributes: React.HTMLAttributes<HTMLButtonElement>; listeners: Record<string, unknown> | undefined } | null; overlay?: boolean }) {
  return (
    <div className={cn("rounded-md border border-neutral-200 bg-white p-2 text-sm shadow-sm", overlay && "shadow-lg")}>
      <div className="flex items-start gap-1">
        {handle && (
          <button type="button" className="mt-0.5 cursor-grab touch-none text-neutral-400 hover:text-neutral-700" aria-label="Drag to change status" {...handle.attributes} {...(handle.listeners as React.HTMLAttributes<HTMLButtonElement>)}>
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <Link href={`/admin/${businessId}/leads/${lead.id}`} className="block truncate font-medium text-neutral-900 hover:underline">
            {lead.name}
          </Link>
          <div className="truncate text-xs text-neutral-500">{lead.service ?? "No service"}</div>
          <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
            <span>{lead.value ?? ""}</span>
            <span>{lead.assignee ?? "Unassigned"}</span>
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">{lead.createdAt}</div>
        </div>
      </div>
    </div>
  );
}
