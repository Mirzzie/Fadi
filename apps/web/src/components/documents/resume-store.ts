import { arrayMove } from "@dnd-kit/sortable";
import { create } from "zustand";

import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import type { Template } from "@reactive-resume/schema/templates";

// Client-side editing store for the Template Studio (ADR 0010, Phase 2b). Holds a working
// ResumeData that the editor mutates and the preview renders from — the interactive
// data-flow loop. Seeded from the sample for now; Phase 3 seeds it from the user's verified
// history and persists it. Immutable updates so the preview effect re-fires on change.

type BasicsPatch = Partial<ResumeData["basics"]>;
export type ExperienceItem = ResumeData["sections"]["experience"]["items"][number];

type ResumeStudioState = {
  data: ResumeData;
  setBasics: (patch: BasicsPatch) => void;
  setSummary: (content: string) => void;
  setTemplate: (template: Template) => void;
  updateExperience: (id: string, patch: Partial<ExperienceItem>) => void;
  addExperience: () => void;
  removeExperience: (id: string) => void;
  moveExperience: (activeId: string, overId: string) => void;
  reset: () => void;
};

const fresh = (): ResumeData => structuredClone(sampleResumeData);

function newExperience(): ExperienceItem {
  return {
    id: crypto.randomUUID(),
    hidden: false,
    company: "New role",
    position: "",
    location: "",
    period: "",
    website: { url: "", label: "", inlineLink: false },
    description: "",
    roles: [],
  };
}

/** Apply a transform to the experience items, returning the new ResumeData immutably. */
function withExperience(
  data: ResumeData,
  fn: (items: ExperienceItem[]) => ExperienceItem[],
): ResumeData {
  const experience = data.sections.experience;
  return {
    ...data,
    sections: {
      ...data.sections,
      experience: { ...experience, items: fn(experience.items) },
    },
  };
}

export const useResumeStore = create<ResumeStudioState>((set) => ({
  data: fresh(),
  setBasics: (patch) =>
    set((s) => ({ data: { ...s.data, basics: { ...s.data.basics, ...patch } } })),
  setSummary: (content) =>
    set((s) => ({ data: { ...s.data, summary: { ...s.data.summary, content } } })),
  setTemplate: (template) =>
    set((s) => ({ data: { ...s.data, metadata: { ...s.data.metadata, template } } })),
  updateExperience: (id, patch) =>
    set((s) => ({
      data: withExperience(s.data, (items) =>
        items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      ),
    })),
  addExperience: () =>
    set((s) => ({ data: withExperience(s.data, (items) => [...items, newExperience()]) })),
  removeExperience: (id) =>
    set((s) => ({ data: withExperience(s.data, (items) => items.filter((it) => it.id !== id)) })),
  moveExperience: (activeId, overId) =>
    set((s) => ({
      data: withExperience(s.data, (items) => {
        const from = items.findIndex((i) => i.id === activeId);
        const to = items.findIndex((i) => i.id === overId);
        return from < 0 || to < 0 ? items : arrayMove(items, from, to);
      }),
    })),
  reset: () => set({ data: fresh() }),
}));
