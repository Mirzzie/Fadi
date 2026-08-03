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

/** The list-style sections the Studio can currently edit (each is `{ items: {id}[] }`). */
export type ListSectionKey = "experience" | "education" | "skills";
type Item = { id: string };

type ResumeStudioState = {
  data: ResumeData;
  setBasics: (patch: BasicsPatch) => void;
  setSummary: (content: string) => void;
  setTemplate: (template: Template) => void;
  updateItem: (section: ListSectionKey, id: string, patch: Record<string, unknown>) => void;
  addItem: (section: ListSectionKey) => void;
  removeItem: (section: ListSectionKey, id: string) => void;
  moveItem: (section: ListSectionKey, activeId: string, overId: string) => void;
  reset: () => void;
};

const fresh = (): ResumeData => structuredClone(sampleResumeData);
const website = () => ({ url: "", label: "", inlineLink: false });

// New-item factories per section. Required (`min(1)`) fields get a non-empty placeholder so
// the schema still parses; everything else starts blank.
const factories: Record<ListSectionKey, () => Item> = {
  experience: () => ({
    id: crypto.randomUUID(), hidden: false, company: "New role", position: "",
    location: "", period: "", website: website(), description: "", roles: [],
  }),
  education: () => ({
    id: crypto.randomUUID(), hidden: false, school: "New school", degree: "", area: "",
    grade: "", location: "", period: "", website: website(), description: "",
  }),
  skills: () => ({
    id: crypto.randomUUID(), hidden: false, icon: "", iconColor: "", name: "New skill",
    proficiency: "", level: 0, keywords: [],
  }),
};

/** Immutably transform one section's items array. */
function mutateItems(
  data: ResumeData,
  section: ListSectionKey,
  fn: (items: Item[]) => Item[],
): ResumeData {
  const current = data.sections[section] as { items: Item[] };
  return {
    ...data,
    sections: {
      ...data.sections,
      [section]: { ...data.sections[section], items: fn(current.items) },
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
  updateItem: (section, id, patch) =>
    set((s) => ({
      data: mutateItems(s.data, section, (items) =>
        items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      ),
    })),
  addItem: (section) =>
    set((s) => ({ data: mutateItems(s.data, section, (items) => [...items, factories[section]()]) })),
  removeItem: (section, id) =>
    set((s) => ({ data: mutateItems(s.data, section, (items) => items.filter((it) => it.id !== id)) })),
  moveItem: (section, activeId, overId) =>
    set((s) => ({
      data: mutateItems(s.data, section, (items) => {
        const from = items.findIndex((i) => i.id === activeId);
        const to = items.findIndex((i) => i.id === overId);
        return from < 0 || to < 0 ? items : arrayMove(items, from, to);
      }),
    })),
  reset: () => set({ data: fresh() }),
}));
