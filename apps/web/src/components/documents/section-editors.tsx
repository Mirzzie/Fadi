"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useResumeStore } from "./resume-store";
import { SortableSection } from "./sortable-section";

// Section editors for the Template Studio (ADR 0010, Phase 2b-ii). Each is a thin wrapper
// over the shared SortableSection (add/remove/drag-reorder) that supplies its own fields,
// bound to the generic store ops + live preview. Descriptions are plain textareas for now;
// tiptap rich text is the next slice.

export function ExperienceEditor() {
  const items = useResumeStore((s) => s.data.sections.experience.items);
  const update = useResumeStore((s) => s.updateItem);
  return (
    <SortableSection
      section="experience"
      title="Experience"
      items={items}
      titleOf={(i) => i.company}
      emptyHint="No experience yet — add your first role."
      renderFields={(it) => (
        <>
          <Grid>
            <Field label="Company" value={it.company} onChange={(v) => update("experience", it.id, { company: v })} />
            <Field label="Position" value={it.position} onChange={(v) => update("experience", it.id, { position: v })} />
            <Field label="Location" value={it.location} onChange={(v) => update("experience", it.id, { location: v })} />
            <Field label="Period" value={it.period} onChange={(v) => update("experience", it.id, { period: v })} />
          </Grid>
          <AreaField label="Description" value={it.description} onChange={(v) => update("experience", it.id, { description: v })} />
        </>
      )}
    />
  );
}

export function EducationEditor() {
  const items = useResumeStore((s) => s.data.sections.education.items);
  const update = useResumeStore((s) => s.updateItem);
  return (
    <SortableSection
      section="education"
      title="Education"
      items={items}
      titleOf={(i) => i.school}
      emptyHint="No education yet — add a school."
      renderFields={(it) => (
        <>
          <Grid>
            <Field label="School" value={it.school} onChange={(v) => update("education", it.id, { school: v })} />
            <Field label="Degree" value={it.degree} onChange={(v) => update("education", it.id, { degree: v })} />
            <Field label="Area" value={it.area} onChange={(v) => update("education", it.id, { area: v })} />
            <Field label="Period" value={it.period} onChange={(v) => update("education", it.id, { period: v })} />
          </Grid>
          <AreaField label="Description" value={it.description} onChange={(v) => update("education", it.id, { description: v })} />
        </>
      )}
    />
  );
}

export function SkillsEditor() {
  const items = useResumeStore((s) => s.data.sections.skills.items);
  const update = useResumeStore((s) => s.updateItem);
  return (
    <SortableSection
      section="skills"
      title="Skills"
      items={items}
      titleOf={(i) => i.name}
      emptyHint="No skills yet — add one."
      renderFields={(it) => (
        <Grid>
          <Field label="Name" value={it.name} onChange={(v) => update("skills", it.id, { name: v })} />
          <Field label="Proficiency" value={it.proficiency} onChange={(v) => update("skills", it.id, { proficiency: v })} />
          <Field
            label="Keywords (comma-separated)"
            value={it.keywords.join(", ")}
            onChange={(v) =>
              update("skills", it.id, {
                keywords: v.split(",").map((k) => k.trim()).filter(Boolean),
              })
            }
          />
          <NumberField
            label="Level (0–5)"
            value={it.level}
            onChange={(n) => update("skills", it.id, { level: n })}
          />
        </Grid>
      )}
    />
  );
}

/* ---------------------------------- field helpers ---------------------------------- */

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function Field({
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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={0}
        max={5}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(5, Number(e.target.value) || 0)))}
      />
    </div>
  );
}

function AreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
