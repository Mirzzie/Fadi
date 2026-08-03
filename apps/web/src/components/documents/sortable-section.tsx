"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useResumeStore, type ListSectionKey } from "./resume-store";

// Reusable editor for a list-style résumé section (ADR 0010, Phase 2b-ii): add / remove /
// drag-reorder rows, with each row's fields supplied via `renderFields`. Shared by the
// Experience / Education / Skills editors so each stays tiny.
export function SortableSection<T extends { id: string }>({
  section,
  title,
  items,
  titleOf,
  renderFields,
  emptyHint,
}: {
  section: ListSectionKey;
  title: string;
  items: readonly T[];
  titleOf: (item: T) => string;
  renderFields: (item: T) => ReactNode;
  emptyHint: string;
}) {
  const addItem = useResumeStore((s) => s.addItem);
  const moveItem = useResumeStore((s) => s.moveItem);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) moveItem(section, String(active.id), String(over.id));
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button variant="outline" size="sm" onClick={() => addItem(section)}>
          <Plus className="size-4" aria-hidden="true" /> Add
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((item) => (
                <SortableRow
                  key={item.id}
                  id={item.id}
                  section={section}
                  heading={titleOf(item) || "Untitled"}
                >
                  {renderFields(item)}
                </SortableRow>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableRow({
  id,
  section,
  heading,
  children,
}: {
  id: string;
  section: ListSectionKey;
  heading: string;
  children: ReactNode;
}) {
  const removeItem = useResumeStore((s) => s.removeItem);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`space-y-2 rounded-lg border bg-background p-3 ${isDragging ? "opacity-60 shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <span className="flex-1 truncate text-xs font-medium">{heading}</span>
        <button
          type="button"
          onClick={() => removeItem(section, id)}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Remove"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
      {children}
    </div>
  );
}
