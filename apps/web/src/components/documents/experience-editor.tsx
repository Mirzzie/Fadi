"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useResumeStore, type ExperienceItem } from "./resume-store";

// Phase 2b-ii (ADR 0010): editing the Experience section — add / remove / edit fields and
// drag-to-reorder (dnd-kit), all on the same store + live-preview loop. Additive.
export function ExperienceEditor() {
  const items = useResumeStore((s) => s.data.sections.experience.items);
  const addExperience = useResumeStore((s) => s.addExperience);
  const moveExperience = useResumeStore((s) => s.moveExperience);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) moveExperience(String(active.id), String(over.id));
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Experience</h3>
        <Button variant="outline" size="sm" onClick={addExperience}>
          <Plus className="size-4" aria-hidden="true" /> Add
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No experience yet — add your first role.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((item) => (
                <SortableExperienceRow key={item.id} item={item} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableExperienceRow({ item }: { item: ExperienceItem }) {
  const updateExperience = useResumeStore((s) => s.updateExperience);
  const removeExperience = useResumeStore((s) => s.removeExperience);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

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
        <span className="flex-1 truncate text-xs font-medium">
          {item.company || "Untitled role"}
        </span>
        <button
          type="button"
          onClick={() => removeExperience(item.id)}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Remove"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Row label="Company" value={item.company} onChange={(v) => updateExperience(item.id, { company: v })} />
        <Row label="Position" value={item.position} onChange={(v) => updateExperience(item.id, { position: v })} />
        <Row label="Location" value={item.location} onChange={(v) => updateExperience(item.id, { location: v })} />
        <Row label="Period" value={item.period} onChange={(v) => updateExperience(item.id, { period: v })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`exp-desc-${item.id}`} className="text-xs">
          Description
        </Label>
        <Textarea
          id={`exp-desc-${item.id}`}
          rows={3}
          value={item.description}
          onChange={(e) => updateExperience(item.id, { description: e.target.value })}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
