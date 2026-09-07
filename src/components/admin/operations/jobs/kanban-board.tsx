"use client";

import * as React from "react";
import Link from "next/link";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { GripVertical, CalendarDays } from "lucide-react";
import { Alert, Badge, cn } from "@/components/ui";
import type { ActionResult } from "@/lib/actions";

export interface KanbanColumn {
  key: string;
  name: string;
  color: string;
  isTerminal: boolean;
  description?: string;
}

export interface KanbanCard {
  id: string;
  number: string;
  title: string;
  customer: string | null;
  value: string | null;
  valueCents: number;
  schedule: string | null;
  assignee: { initials: string; name: string } | null;
  priority: number;
  stageKey: string;
  href: string;
}

export function KanbanBoard({ columns, cards: initial, onMove, formatTotal }: {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  onMove: (jobId: string, toStage: string) => Promise<ActionResult<unknown>>;
  formatTotal: (cents: number) => string;
}) {
  const [cards, setCards] = React.useState(initial);
  const [active, setActive] = React.useState<KanbanCard | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  React.useEffect(() => setCards(initial), [initial]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  function onDragStart(e: DragStartEvent) {
    setActive(cards.find((c) => c.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const jobId = String(e.active.id);
    const toStage = e.over ? String(e.over.id) : null;
    const card = cards.find((c) => c.id === jobId);
    if (!card || !toStage || toStage === card.stageKey) return;
    const previous = cards;
    setCards((cs) => cs.map((c) => (c.id === jobId ? { ...c, stageKey: toStage } : c)));
    setError(null);
    startTransition(async () => {
      const result = await onMove(jobId, toStage);
      if (!result.ok) {
        setCards(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div>
      {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className={cn("flex gap-3 overflow-x-auto pb-4", pending && "opacity-80")}>
          {columns.map((col) => {
            const items = cards.filter((c) => c.stageKey === col.key);
            const total = items.reduce((a, c) => a + c.valueCents, 0);
            return <Column key={col.key} column={col} count={items.length} total={formatTotal(total)}>{items.map((c) => <DraggableCard key={c.id} card={c} />)}</Column>;
          })}
        </div>
        <DragOverlay>{active ? <CardBody card={active} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ column, count, total, children }: { column: KanbanColumn; count: number; total: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.key });
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-xl border bg-neutral-50 transition", isOver ? "border-neutral-900 bg-neutral-100" : "border-neutral-200")}>
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />
        <span className="truncate text-sm font-medium text-neutral-900">{column.name}</span>
        {column.isTerminal && <Badge tone="green">Final</Badge>}
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-neutral-600 ring-1 ring-neutral-200">{count}</span>
      </div>
      <div className="px-3 py-1 text-xs text-neutral-500">{total}</div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
        {children}
        {count === 0 && <div className="rounded-lg border border-dashed border-neutral-200 p-3 text-center text-xs text-neutral-400">Drop a job here</div>}
      </div>
    </div>
  );
}

function DraggableCard({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-30")}>
      <CardBody card={card} handle={<button ref={setActivatorNodeRef} type="button" aria-label="Drag job" className="cursor-grab rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>} />
    </div>
  );
}

function CardBody({ card, handle, dragging }: { card: KanbanCard; handle?: React.ReactNode; dragging?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm", dragging && "rotate-1 shadow-lg")}>
      <div className="flex items-start gap-1">
        {handle}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-neutral-500">{card.number}</span>
            {card.priority === 2 && <Badge tone="red">Urgent</Badge>}
            {card.priority === 1 && <Badge tone="amber">High</Badge>}
          </div>
          <Link href={card.href} className="mt-0.5 block truncate text-sm font-medium text-neutral-900 hover:underline">{card.title}</Link>
          {card.customer && <div className="truncate text-xs text-neutral-600">{card.customer}</div>}
          <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
            {card.value && <span className="font-medium text-neutral-800">{card.value}</span>}
            {card.schedule && <span className="flex items-center gap-1 truncate"><CalendarDays className="h-3 w-3" />{card.schedule}</span>}
            {card.assignee && <span title={card.assignee.name} className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">{card.assignee.initials}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
