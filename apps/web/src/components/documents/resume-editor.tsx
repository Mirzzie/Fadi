"use client";

import { ArrowLeft, ChevronDown, ChevronUp, Check, Download, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ResumePreview } from "@/components/documents/resume-preview";
import { updateDocumentAction } from "@/app/dashboard/documents/actions";
import {
  newId,
  parseResume,
  RESUME_TEMPLATES,
  serializeResume,
  type ResumeData,
  type ResumeEducation,
  type ResumeExperience,
  type ResumeProject,
  type ResumeSectionKey,
  type ResumeTemplate,
} from "@/lib/documents/resume";

const field =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15";

const SECTION_TITLES: Record<ResumeSectionKey, string> = {
  summary: "Summary",
  experiences: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
};
const ADDABLE = new Set<ResumeSectionKey>(["experiences", "projects", "education"]);

export function ResumeEditor({
  id,
  initialTitle,
  initialContent,
  initialTemplate,
}: {
  id: string;
  initialTitle: string;
  initialContent: string;
  initialTemplate?: string | null;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [data, setData] = useState<ResumeData>(() => parseResume(initialContent));
  const [template, setTemplate] = useState<ResumeTemplate>(
    (initialTemplate as ResumeTemplate) || "classic",
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    setStatus("saving");
    const res = await updateDocumentAction({ id, title, content: serializeResume(data), template });
    setStatus(res.ok ? "saved" : "idle");
    dirty.current = false;
  }, [id, title, data, template]);

  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, data, template, save]);

  function patch(next: Partial<ResumeData>) {
    dirty.current = true;
    setStatus("idle");
    setData((d) => ({ ...d, ...next }));
  }
  function patchPersonal(next: Partial<ResumeData["personal"]>) {
    patch({ personal: { ...data.personal, ...next } });
  }
  function moveSection(key: ResumeSectionKey, dir: -1 | 1) {
    const order = [...data.order];
    const i = order.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    patch({ order });
  }

  function exportPdf() {
    window.open(`/dashboard/documents/${id}/print`, "_blank");
  }
  function exportDocx() {
    window.open(`/api/documents/${id}/docx`, "_blank");
  }

  function addSectionItem(key: ResumeSectionKey) {
    if (key === "experiences")
      patch({ experiences: [...data.experiences, { id: newId(), title: "", company: "", location: "", period: "", bullets: "" }] });
    else if (key === "projects")
      patch({ projects: [...data.projects, { id: newId(), title: "", url: "", description: "" }] });
    else if (key === "education")
      patch({ education: [...data.education, { id: newId(), degree: "", school: "", location: "", period: "" }] });
  }

  function renderSectionForm(key: ResumeSectionKey): React.ReactNode {
    switch (key) {
      case "summary":
        return (
          <textarea
            className={`${field} min-h-20`}
            value={data.summary}
            onChange={(e) => patch({ summary: e.target.value })}
            placeholder="A sharp 2–3 line professional summary."
          />
        );
      case "experiences":
        return data.experiences.map((exp, i) => (
          <RepeatItem key={exp.id} onRemove={() => patch({ experiences: data.experiences.filter((_, j) => j !== i) })}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Title" value={exp.title} onChange={(e) => updateList(data, patch, "experiences", i, { title: e.target.value })} />
              <input className={field} placeholder="Company" value={exp.company} onChange={(e) => updateList(data, patch, "experiences", i, { company: e.target.value })} />
              <input className={field} placeholder="Location" value={exp.location} onChange={(e) => updateList(data, patch, "experiences", i, { location: e.target.value })} />
              <input className={field} placeholder="Period (e.g. Jan 2024 – Present)" value={exp.period} onChange={(e) => updateList(data, patch, "experiences", i, { period: e.target.value })} />
            </div>
            <textarea className={`${field} mt-2 min-h-16`} placeholder="Achievements — one per line" value={exp.bullets} onChange={(e) => updateList(data, patch, "experiences", i, { bullets: e.target.value })} />
          </RepeatItem>
        ));
      case "projects":
        return data.projects.map((p, i) => (
          <RepeatItem key={p.id} onRemove={() => patch({ projects: data.projects.filter((_, j) => j !== i) })}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Project title" value={p.title} onChange={(e) => updateList(data, patch, "projects", i, { title: e.target.value })} />
              <input className={field} placeholder="URL" value={p.url} onChange={(e) => updateList(data, patch, "projects", i, { url: e.target.value })} />
            </div>
            <textarea className={`${field} mt-2 min-h-14`} placeholder="What you built and the impact" value={p.description} onChange={(e) => updateList(data, patch, "projects", i, { description: e.target.value })} />
          </RepeatItem>
        ));
      case "education":
        return data.education.map((ed, i) => (
          <RepeatItem key={ed.id} onRemove={() => patch({ education: data.education.filter((_, j) => j !== i) })}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Degree" value={ed.degree} onChange={(e) => updateList(data, patch, "education", i, { degree: e.target.value })} />
              <input className={field} placeholder="School" value={ed.school} onChange={(e) => updateList(data, patch, "education", i, { school: e.target.value })} />
              <input className={field} placeholder="Location" value={ed.location} onChange={(e) => updateList(data, patch, "education", i, { location: e.target.value })} />
              <input className={field} placeholder="Period" value={ed.period} onChange={(e) => updateList(data, patch, "education", i, { period: e.target.value })} />
            </div>
          </RepeatItem>
        ));
      case "skills":
        return (
          <textarea
            className={`${field} min-h-16`}
            value={data.skills}
            onChange={(e) => patch({ skills: e.target.value })}
            placeholder={"One group per line, e.g.\nCloud: AWS, Azure, Docker\nLanguages: Python, JavaScript"}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-6xl flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/documents"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Back to documents"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <input
            value={title}
            onChange={(e) => {
              dirty.current = true;
              setStatus("idle");
              setTitle(e.target.value);
            }}
            className="rounded-md bg-transparent px-1 text-sm font-semibold outline-none focus:bg-accent/40"
          />
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {status === "saving" ? (
              <>
                <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Saving…
              </>
            ) : status === "saved" ? (
              <>
                <Check className="size-3 text-emerald-400" aria-hidden="true" /> Saved
              </>
            ) : (
              "Autosaves"
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={template}
            onChange={(e) => {
              dirty.current = true;
              setStatus("idle");
              setTemplate(e.target.value as ResumeTemplate);
            }}
            aria-label="Resume template"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/40"
          >
            {RESUME_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={exportDocx}>
            <Download className="size-4" aria-hidden="true" />
            DOCX
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <Download className="size-4" aria-hidden="true" />
            PDF
          </Button>
          <Button size="sm" onClick={save}>
            Save
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        {/* Live preview */}
        <div className="min-h-0 overflow-y-auto rounded-xl border border-border/60 bg-white p-8 text-[13px] text-zinc-800 shadow-sm">
          <ResumePreview data={data} template={template} />
        </div>

        {/* Form */}
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <Section title="Personal details">
            <div className="grid gap-2 sm:grid-cols-2">
              <Labeled label="Full name">
                <input className={field} value={data.personal.name} onChange={(e) => patchPersonal({ name: e.target.value })} />
              </Labeled>
              <Labeled label="Headline">
                <input className={field} value={data.personal.headline} onChange={(e) => patchPersonal({ headline: e.target.value })} placeholder="IT Support Engineer" />
              </Labeled>
              <Labeled label="Email">
                <input className={field} value={data.personal.email} onChange={(e) => patchPersonal({ email: e.target.value })} />
              </Labeled>
              <Labeled label="Phone">
                <input className={field} value={data.personal.phone} onChange={(e) => patchPersonal({ phone: e.target.value })} />
              </Labeled>
              <Labeled label="Location">
                <input className={field} value={data.personal.location} onChange={(e) => patchPersonal({ location: e.target.value })} placeholder="Dublin, Ireland" />
              </Labeled>
              <Labeled label="Links">
                <input className={field} value={data.personal.links} onChange={(e) => patchPersonal({ links: e.target.value })} placeholder="LinkedIn · GitHub · Portfolio" />
              </Labeled>
            </div>
          </Section>

          {data.order.map((key, idx) => (
            <Section
              key={key}
              title={SECTION_TITLES[key]}
              onAdd={ADDABLE.has(key) ? () => addSectionItem(key) : undefined}
              onMoveUp={idx > 0 ? () => moveSection(key, -1) : undefined}
              onMoveDown={idx < data.order.length - 1 ? () => moveSection(key, 1) : undefined}
            >
              {renderSectionForm(key)}
            </Section>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

type ListKey = "experiences" | "education" | "projects";
function updateList(
  data: ResumeData,
  patch: (n: Partial<ResumeData>) => void,
  key: ListKey,
  index: number,
  changes: Partial<ResumeExperience & ResumeEducation & ResumeProject>,
) {
  const list = (data[key] as Array<Record<string, unknown>>).map((item, j) =>
    j === index ? { ...item, ...changes } : item,
  );
  patch({ [key]: list } as Partial<ResumeData>);
}

function Section({
  title,
  children,
  onAdd,
  onMoveUp,
  onMoveDown,
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!onMoveUp}
            aria-label={`Move ${title} up`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
          >
            <ChevronUp className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!onMoveDown}
            aria-label={`Move ${title} down`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
          {onAdd ? (
            <Button variant="ghost" size="sm" onClick={onAdd}>
              <Plus className="size-3.5" aria-hidden="true" />
              Add
            </Button>
          ) : null}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function RepeatItem({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="relative rounded-lg border border-border/50 bg-background/40 p-3">
      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

