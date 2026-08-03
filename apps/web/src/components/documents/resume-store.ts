import { create } from "zustand";

import type { ResumeData } from "@reactive-resume/schema/resume/data";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import type { Template } from "@reactive-resume/schema/templates";

// Client-side editing store for the Template Studio (ADR 0010, Phase 2b). Holds a working
// ResumeData that the editor mutates and the preview renders from — the interactive
// data-flow loop. Seeded from the sample for now; Phase 3 seeds it from the user's verified
// history and persists it to the `resumes`/`documents` tables. Immutable updates so the
// preview effect re-fires on change.

type BasicsPatch = Partial<ResumeData["basics"]>;

type ResumeStudioState = {
  data: ResumeData;
  setBasics: (patch: BasicsPatch) => void;
  setSummary: (content: string) => void;
  setTemplate: (template: Template) => void;
  reset: () => void;
};

const fresh = (): ResumeData => structuredClone(sampleResumeData);

export const useResumeStore = create<ResumeStudioState>((set) => ({
  data: fresh(),
  setBasics: (patch) =>
    set((s) => ({ data: { ...s.data, basics: { ...s.data.basics, ...patch } } })),
  setSummary: (content) =>
    set((s) => ({ data: { ...s.data, summary: { ...s.data.summary, content } } })),
  setTemplate: (template) =>
    set((s) => ({ data: { ...s.data, metadata: { ...s.data.metadata, template } } })),
  reset: () => set({ data: fresh() }),
}));
