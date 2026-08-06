"use client";

import { ArrowLeft, BookmarkPlus, ChevronDown, ChevronUp, Check, Download, Loader2, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AiTellCheck } from "@/components/documents/ai-tell-check";
import { DictatableTextarea } from "@/components/documents/dictatable-textarea";
import {
  REACTIVE_TEMPLATES,
  ReactiveResumePreview,
  downloadReactiveResumePdf,
  isReactiveTemplate,
} from "@/components/documents/reactive-resume-preview";
import { ResumeAdvisor } from "@/components/documents/resume-advisor";
import { ResumePreview } from "@/components/documents/resume-preview";
import {
  deleteResumeTemplateAction,
  saveResumeTemplateAction,
  updateDocumentAction,
} from "@/app/dashboard/documents/actions";
import {
  newId,
  parseResume,
  RESUME_FONTS,
  RESUME_FONT_SIZES,
  RESUME_TEMPLATES,
  serializeResume,
  type ResumeAward,
  type ResumeCertification,
  type ResumeData,
  type ResumeEducation,
  type ResumeExperience,
  type ResumeInterest,
  type ResumeLanguage,
  type ResumePublication,
  type ResumeReference,
  type ResumeVolunteer,
  type ResumeFontId,
  type ResumeFontSizeId,
  type ResumeProject,
  type ResumeSectionKey,
  type ResumeTemplate,
} from "@/lib/documents/resume";

const field =
  "nice-scrollbar w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15";

const SECTION_TITLES: Record<ResumeSectionKey, string> = {
  summary: "Summary",
  experiences: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications & Licenses",
  skills: "Skills",
  languages: "Languages",
  awards: "Awards & Honours",
  volunteer: "Volunteer & Community",
  references: "References",
  interests: "Interests",
  publications: "Publications",
};
const ADDABLE = new Set<ResumeSectionKey>([
  "experiences",
  "projects",
  "education",
  "certifications",
  "languages",
  "awards",
  "volunteer",
  "references",
  "interests",
  "publications",
]);

export function ResumeEditor({
  id,
  initialTitle,
  initialContent,
  initialTemplate,
  experienceLevel,
  customTemplates = [],
}: {
  id: string;
  initialTitle: string;
  initialContent: string;
  initialTemplate?: string | null;
  experienceLevel?: string | null;
  customTemplates?: { id: string; name: string; config: Record<string, unknown> }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [data, setData] = useState<ResumeData>(() => parseResume(initialContent));
  // A template id is either one of Fadi's (ResumeTemplate) or a Reactive Resume one — a
  // plain string covers both; the renderer branches on isReactiveTemplate().
  const [template, setTemplate] = useState<string>(initialTemplate || "classic");
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

  // ── Custom (user-saved) templates: apply / save / delete ──
  const [templateName, setTemplateName] = useState<string | null>(null); // non-null = naming
  const [tplBusy, setTplBusy] = useState(false);

  function applyCustomTemplate(config: Record<string, unknown>) {
    dirty.current = true;
    setStatus("idle");
    if (typeof config.baseTemplate === "string") setTemplate(config.baseTemplate as ResumeTemplate);
    setData((d) => ({
      ...d,
      font: (config.font as ResumeFontId | undefined) ?? undefined,
      fontSize: (config.fontSize as ResumeFontSizeId | undefined) ?? undefined,
      order: Array.isArray(config.order) ? (config.order as ResumeSectionKey[]) : d.order,
    }));
  }

  async function saveCurrentAsTemplate() {
    const name = (templateName ?? "").trim();
    if (!name) return;
    setTplBusy(true);
    const res = await saveResumeTemplateAction(name, {
      baseTemplate: template,
      font: data.font,
      fontSize: data.fontSize,
      order: data.order,
    });
    setTplBusy(false);
    if (res.ok) {
      setTemplateName(null);
      router.refresh(); // reload the saved-templates list
    }
  }

  async function removeTemplate(tid: string) {
    setTplBusy(true);
    await deleteResumeTemplateAction(tid);
    setTplBusy(false);
    router.refresh();
  }

  // Scan the prose-heavy fields (summary, bullets, project descriptions) for AI
  // clichés — skills are just keyword lists, so they're not worth flagging.
  const proseText = useMemo(
    () =>
      [
        data.summary,
        ...data.experiences.map((e) => e.bullets),
        ...data.projects.map((p) => p.description),
      ]
        .filter(Boolean)
        .join("\n"),
    [data.summary, data.experiences, data.projects],
  );

  function exportPdf() {
    // Reactive Resume templates export via their own client-side PDF engine (mapped from
    // the user's real data); Fadi templates keep the existing print route.
    if (isReactiveTemplate(template)) {
      void downloadReactiveResumePdf(data, template, title);
      return;
    }
    window.open(`/dashboard/documents/${id}/print`, "_blank");
  }
  function exportDocx() {
    window.open(`/api/documents/${id}/docx`, "_blank");
  }
  function exportJson() {
    window.open(`/api/documents/${id}/json`, "_blank");
  }

  function addSectionItem(key: ResumeSectionKey) {
    if (key === "experiences")
      patch({ experiences: [...data.experiences, { id: newId(), title: "", company: "", location: "", period: "", bullets: "" }] });
    else if (key === "projects")
      patch({ projects: [...data.projects, { id: newId(), title: "", url: "", description: "" }] });
    else if (key === "education")
      patch({ education: [...data.education, { id: newId(), degree: "", school: "", location: "", period: "" }] });
    else if (key === "certifications")
      patch({ certifications: [...data.certifications, { id: newId(), name: "", issuer: "", date: "" }] });
    else if (key === "languages")
      patch({ languages: [...data.languages, { id: newId(), name: "", level: "" }] });
    else if (key === "awards")
      patch({ awards: [...data.awards, { id: newId(), title: "", awarder: "", date: "" }] });
    else if (key === "volunteer")
      patch({ volunteer: [...data.volunteer, { id: newId(), organization: "", role: "", period: "", summary: "" }] });
    else if (key === "references")
      patch({ references: [...data.references, { id: newId(), name: "", reference: "" }] });
    else if (key === "interests")
      patch({ interests: [...data.interests, { id: newId(), name: "", keywords: "" }] });
    else if (key === "publications")
      patch({ publications: [...data.publications, { id: newId(), name: "", publisher: "", date: "" }] });
  }

  function renderSectionForm(key: ResumeSectionKey): React.ReactNode {
    switch (key) {
      case "summary":
        return (
          <DictatableTextarea
            className={`${field} min-h-24`}
            value={data.summary}
            onChange={(summary) => patch({ summary })}
            placeholder="A sharp 2–3 line professional summary."
            label="your summary"
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
            {/* Bullets are where under-claiming happens: people TYPE "helped with
                support" but SAY the three specific things they actually did. Select a
                bullet to rewrite it; speak with nothing selected to add one. */}
            <DictatableTextarea
              className={`${field} mt-2 min-h-20`}
              placeholder="Achievements — one per line"
              value={exp.bullets}
              onChange={(bullets) => updateList(data, patch, "experiences", i, { bullets })}
              separator={"\n"}
              label="an achievement"
            />
          </RepeatItem>
        ));
      case "projects":
        return data.projects.map((p, i) => (
          <RepeatItem key={p.id} onRemove={() => patch({ projects: data.projects.filter((_, j) => j !== i) })}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Project title" value={p.title} onChange={(e) => updateList(data, patch, "projects", i, { title: e.target.value })} />
              <input className={field} placeholder="URL" value={p.url} onChange={(e) => updateList(data, patch, "projects", i, { url: e.target.value })} />
            </div>
            <DictatableTextarea
              className={`${field} mt-2 min-h-16`}
              placeholder="What you built and the impact"
              value={p.description}
              onChange={(description) => updateList(data, patch, "projects", i, { description })}
              label="what you built"
            />
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
      case "certifications":
        return data.certifications.map((c, i) => (
          <RepeatItem key={c.id} onRemove={() => patch({ certifications: data.certifications.filter((_, j) => j !== i) })}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Certification / license (e.g. RN, CPA, AWS SAA)" value={c.name} onChange={(e) => updateList(data, patch, "certifications", i, { name: e.target.value })} />
              <input className={field} placeholder="Issuer (e.g. NMBI, AWS)" value={c.issuer} onChange={(e) => updateList(data, patch, "certifications", i, { issuer: e.target.value })} />
              <input className={field} placeholder="Date (e.g. 2024)" value={c.date} onChange={(e) => updateList(data, patch, "certifications", i, { date: e.target.value })} />
            </div>
          </RepeatItem>
        ));
      case "languages":
        return data.languages.map((l, i) => (
          <RepeatItem key={l.id} onRemove={() => patch({ languages: data.languages.filter((_, j) => j !== i) })}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Language (e.g. English)" value={l.name} onChange={(e) => updateList(data, patch, "languages", i, { name: e.target.value })} />
              <input className={field} placeholder="Level (e.g. Native, Fluent)" value={l.level} onChange={(e) => updateList(data, patch, "languages", i, { level: e.target.value })} />
            </div>
          </RepeatItem>
        ));
      case "awards":
        return data.awards.map((a, i) => (
          <RepeatItem key={a.id} onRemove={() => patch({ awards: data.awards.filter((_, j) => j !== i) })}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Award / honour" value={a.title} onChange={(e) => updateList(data, patch, "awards", i, { title: e.target.value })} />
              <input className={field} placeholder="Awarded by" value={a.awarder} onChange={(e) => updateList(data, patch, "awards", i, { awarder: e.target.value })} />
              <input className={field} placeholder="Date (e.g. 2024)" value={a.date} onChange={(e) => updateList(data, patch, "awards", i, { date: e.target.value })} />
            </div>
          </RepeatItem>
        ));
      case "volunteer":
        return data.volunteer.map((v, i) => (
          <RepeatItem key={v.id} onRemove={() => patch({ volunteer: data.volunteer.filter((_, j) => j !== i) })}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Organisation" value={v.organization} onChange={(e) => updateList(data, patch, "volunteer", i, { organization: e.target.value })} />
              <input className={field} placeholder="Role" value={v.role} onChange={(e) => updateList(data, patch, "volunteer", i, { role: e.target.value })} />
              <input className={field} placeholder="Period" value={v.period} onChange={(e) => updateList(data, patch, "volunteer", i, { period: e.target.value })} />
              <input className={field} placeholder="What you did" value={v.summary} onChange={(e) => updateList(data, patch, "volunteer", i, { summary: e.target.value })} />
            </div>
          </RepeatItem>
        ));
      case "references":
        return data.references.map((r, i) => (
          <RepeatItem key={r.id} onRemove={() => patch({ references: data.references.filter((_, j) => j !== i) })}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Name" value={r.name} onChange={(e) => updateList(data, patch, "references", i, { name: e.target.value })} />
              <input className={field} placeholder="Relationship & contact" value={r.reference} onChange={(e) => updateList(data, patch, "references", i, { reference: e.target.value })} />
            </div>
          </RepeatItem>
        ));
      case "publications":
        return data.publications.map((p, i) => (
          <RepeatItem key={p.id} onRemove={() => patch({ publications: data.publications.filter((_, j) => j !== i) })}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Title" value={p.name} onChange={(e) => updateList(data, patch, "publications", i, { name: e.target.value })} />
              <input className={field} placeholder="Publisher / journal" value={p.publisher} onChange={(e) => updateList(data, patch, "publications", i, { publisher: e.target.value })} />
              <input className={field} placeholder="Date (e.g. 2024)" value={p.date} onChange={(e) => updateList(data, patch, "publications", i, { date: e.target.value })} />
            </div>
          </RepeatItem>
        ));
      case "interests":
        return data.interests.map((it, i) => (
          <RepeatItem key={it.id} onRemove={() => patch({ interests: data.interests.filter((_, j) => j !== i) })}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={field} placeholder="Interest (e.g. Photography)" value={it.name} onChange={(e) => updateList(data, patch, "interests", i, { name: e.target.value })} />
              <input className={field} placeholder="Keywords (comma-separated)" value={it.keywords} onChange={(e) => updateList(data, patch, "interests", i, { keywords: e.target.value })} />
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
              setTemplate(e.target.value);
            }}
            aria-label="Resume template"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/40"
          >
            <optgroup label="Fadi">
              {RESUME_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Reactive Resume">
              {REACTIVE_TEMPLATES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </optgroup>
          </select>
          <select
            value={data.font ?? ""}
            onChange={(e) => patch({ font: (e.target.value || undefined) as ResumeFontId | undefined })}
            aria-label="Resume font"
            title="Font (ATS-safe options)"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/40"
          >
            <option value="">Font: default</option>
            {RESUME_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={data.fontSize ?? ""}
            onChange={(e) => patch({ fontSize: (e.target.value || undefined) as ResumeFontSizeId | undefined })}
            aria-label="Resume text size"
            title="Body text size"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/40"
          >
            <option value="">Size: default</option>
            {RESUME_FONT_SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTemplateName((n) => (n === null ? "" : null))}
            title="Save the current template + font + size + section order as a reusable template"
          >
            <BookmarkPlus className="size-4" aria-hidden="true" />
            Save style
          </Button>
          <Button variant="outline" size="sm" onClick={exportDocx}>
            <Download className="size-4" aria-hidden="true" />
            DOCX
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <Download className="size-4" aria-hidden="true" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson} title="Export as JSON Resume (open standard)">
            <Download className="size-4" aria-hidden="true" />
            JSON
          </Button>
          <Button size="sm" onClick={save}>
            Save
          </Button>
        </div>
      </div>

      {/* Save-as-template: name input when saving, plus apply/delete for saved styles */}
      {templateName !== null ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <input
            autoFocus
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveCurrentAsTemplate();
              if (e.key === "Escape") setTemplateName(null);
            }}
            placeholder="Name this template (e.g. My clean serif)"
            className="h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
          />
          <Button size="sm" disabled={tplBusy || !templateName.trim()} onClick={saveCurrentAsTemplate}>
            {tplBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Save template
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setTemplateName(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      {customTemplates.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-muted-foreground">My templates:</span>
          {customTemplates.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card py-0.5 pl-2.5 pr-1"
            >
              <button
                type="button"
                onClick={() => applyCustomTemplate(t.config)}
                className="font-medium hover:text-primary"
                title="Apply this saved style"
              >
                {t.name}
              </button>
              <button
                type="button"
                onClick={() => removeTemplate(t.id)}
                disabled={tplBusy}
                aria-label={`Delete ${t.name}`}
                className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* Recruiter-backed formatting guidance (font/size/length) */}
      <ResumeAdvisor experienceLevel={experienceLevel} />

      {/* Honest reads-human check across the resume's prose */}
      <AiTellCheck text={proseText} />

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-2">
        {/* Live preview — Reactive Resume templates render via their PDF engine (real data
            mapped through the JSON-Resume bridge); Fadi templates use the HTML preview. */}
        {isReactiveTemplate(template) ? (
          <ReactiveResumePreview data={data} template={template} />
        ) : (
          <div className="nice-scrollbar min-h-0 overflow-y-auto rounded-xl border border-border/60 bg-white p-8 text-[13px] text-zinc-800 shadow-sm lg:p-10">
            <ResumePreview data={data} template={template as ResumeTemplate} />
          </div>
        )}

        {/* Form */}
        <div className="nice-scrollbar min-h-0 space-y-4 overflow-y-auto pr-2">
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
              <Labeled label="Photo URL (optional)">
                <input className={field} value={data.personal.photo ?? ""} onChange={(e) => patchPersonal({ photo: e.target.value })} placeholder="https://…/headshot.jpg — shows on templates that support a photo" />
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

type ListKey =
  | "experiences"
  | "education"
  | "projects"
  | "certifications"
  | "languages"
  | "awards"
  | "volunteer"
  | "references"
  | "interests"
  | "publications";
function updateList(
  data: ResumeData,
  patch: (n: Partial<ResumeData>) => void,
  key: ListKey,
  index: number,
  changes: Partial<
    ResumeExperience &
      ResumeEducation &
      ResumeProject &
      ResumeCertification &
      ResumeLanguage &
      ResumeAward &
      ResumeVolunteer &
      ResumeReference &
      ResumeInterest &
      ResumePublication
  >,
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

