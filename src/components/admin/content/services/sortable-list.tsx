"use client";

import * as React from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/components/ui";

export type DragHandleProps = React.HTMLAttributes<HTMLButtonElement> & { ref: (el: HTMLElement | null) => void };

/**
 * Generic sortable list built on @dnd-kit with an explicit drag handle.
 * `renderItem` receives the handle props to spread onto a <DragHandle>.
 */
export function SortableList<T>({ items, getId, onReorder, renderItem, layout = "list", className, disabled }: {
  items: T[];
  getId: (item: T) => string;
  onReorder: (items: T[], moved: { from: number; to: number }) => void;
  renderItem: (item: T, index: number, handle: DragHandleProps, dragging: boolean) => React.ReactNode;
  layout?: "list" | "grid";
  className?: string;
  disabled?: boolean;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = React.useMemo(() => items.map(getId), [items, getId]);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to), { from, to });
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy} disabled={disabled}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableRow key={getId(item)} id={getId(item)} disabled={disabled}>
              {(handle, dragging) => renderItem(item, index, handle, dragging)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children, disabled }: { id: string; disabled?: boolean; children: (handle: DragHandleProps, dragging: boolean) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, position: "relative", zIndex: isDragging ? 10 : undefined };
  const handle = { ...attributes, ...listeners, ref: setActivatorNodeRef } as unknown as DragHandleProps;
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle, isDragging)}
    </div>
  );
}

export function DragHandle({ className, ...props }: DragHandleProps & { className?: string }) {
  const { ref, ...rest } = props;
  return (
    <button type="button" ref={ref} aria-label="Drag to reorder" title="Drag to reorder" className={cn("inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing", className)} {...rest}>
      <GripVertical className="h-4 w-4" />
    </button>
  );
}
