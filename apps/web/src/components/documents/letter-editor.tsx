"use client";

import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AiTellCheck } from "@/components/documents/ai-tell-check";
import { ImproveBox } from "@/components/documents/improve-box";
import { DocAdvisor } from "@/components/documents/doc-advisor";
import { DocTemplatePicker } from "@/components/documents/doc-template-picker";
import { LetterPreview } from "@/components/documents/letter-preview";
import {
  DocumentHistoryLink,
  DocumentSaveIndicator,
  useVersionedDocumentSave,
} from "@/components/documents/versioned-save";
import type { DocKind } from "@/lib/jobs/application-types";
import type { DocTemplate } from "@/lib/documents/doc-templates";
import {
  LETTER_FIELDS,
  parseLetter,
  serializeLetter,
  type LetterData,
  type ProseKind,
} from "@/lib/documents/letter";
import {
  RESUME_FONTS,
  RESUME_FONT_SIZES,
  type ResumeFontId,
  type ResumeFontSizeId,
} from "@/lib/documents/resume";

const field =
  "nice-scrollbar min-h-10 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15";

/**
 * Structured editor for the prose document kinds (cover letter / cold email /
 * value proposition). Same split-pane shape as the resume editor — a live page
 * preview beside a block form — driven by the per-kind LETTER_FIELDS config.
 */
export function LetterEditor({
  id,
  kind,
  initialTitle,
  initialContent,
  initialVersion,
  hasJob = false,
  freshnessAsk = null,
}: {
  id: string;
  kind: ProseKind;
  initialTitle: string;
  initialContent: string;
  initialVersion: number;
  /** Whether this letter belongs to a posting — Fadi tailors to it when asked to change things. */
  hasJob?: boolean;
  /** When the person's record has moved on, the one-click way to act on it. */
  freshnessAsk?: string | null;
}) {
  const fields = LETTER_FIELDS[kind];
  const [title, setTitle] = useState(initialTitle);
  const [templateToApply, setTemplateToApply] = useState<DocTemplate | null>(null);
  const templateTrigger = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<LetterData>(() => parseLetter(initialContent, kind));
  const { status, markDirty, save: saveVersion } = useVersionedDocumentSave(id, initialVersion);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    await saveVersion({ title, content: serializeLetter(data) });
  }, [saveVersion, title, data]);

  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, data, save]);

  function patch(next: Partial<LetterData>) {
    dirty.current = true;
    markDirty();
    setData((d) => ({ ...d, ...next }));
  }
  function patchSender(next: Partial<LetterData["sender"]>) {
    patch({ sender: { ...data.sender, ...next } });
  }
  function patchRecipient(next: Partial<LetterData["recipient"]>) {
    patch({ recipient: { ...data.recipient, ...next } });
  }

  function applyTemplate(t: DocTemplate) {
    if (data.body.trim()) return setTemplateToApply(t);
    patch({ body: t.content });
  }

  function exportPdf() {
    window.open(`/dashboard/documents/${id}/print`, "_blank");
  }
  function exportDocx() {
    window.open(`/api/documents/${id}/docx`, "_blank");
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 lg:h-[calc(100dvh-9rem)]">
      <h1 className="sr-only">{title || "Letter editor"}</h1>
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard/documents"
            className="grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Back to documents"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <input
            aria-label="Document title"
            value={title}
            onChange={(e) => {
              dirty.current = true;
              markDirty();
              setTitle(e.target.value);
            }}
            className="h-10 min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm font-semibold outline-none focus:bg-accent/40"
          />
          <DocumentSaveIndicator status={status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DocumentHistoryLink id={id} />
          <select
            value={data.font ?? ""}
            onChange={(e) =>
              patch({ font: (e.target.value || undefined) as ResumeFontId | undefined })
            }
            aria-label="Font"
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
            onChange={(e) =>
              patch({ fontSize: (e.target.value || undefined) as ResumeFontSizeId | undefined })
            }
            aria-label="Text size"
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
          <DocTemplatePicker
            kind={kind as DocKind}
            onPick={applyTemplate}
            triggerRef={templateTrigger}
          />
          <Button variant="outline" size="sm" onClick={exportDocx}>
            <Download className="size-4" aria-hidden="true" />
            DOCX
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <Download className="size-4" aria-hidden="true" />
            PDF
          </Button>
          <Button size="sm" onClick={save} disabled={status === "saving" || status === "conflict"}>
            Save
          </Button>
        </div>
      </div>

      {/* Recruiter-backed length guidance + honest reads-human check (body prose) */}
      <DocAdvisor kind={kind as DocKind} text={data.body} />
      <AiTellCheck text={data.body} />

      {/* Ask for a change and get the change — applied here, autosaved as a new version. */}
      <ImproveBox
        documentId={id}
        hasJob={hasJob}
        currentContent={() => serializeLetter(data)}
        onApply={(content) => {
          dirty.current = true;
          markDirty();
          setData(parseLetter(content, kind));
        }}
        quick={[
          ...(freshnessAsk ? [freshnessAsk] : []),
          hasJob ? "Tailor it to this posting" : "Make it specific to the role",
          "Shorter — cut it by a third",
          "Open with something concrete, not a stock line",
          "Plainer language, fewer adjectives",
        ]}
      />

      <div className="grid min-h-0 min-w-0 flex-1 gap-5 lg:grid-cols-2">
        {/* Live preview */}
        <div className="nice-scrollbar min-h-0 min-w-0 overflow-auto rounded-xl border border-border/60 bg-white p-5 text-[13px] text-zinc-800 shadow-sm sm:p-8 lg:p-10">
          <LetterPreview data={data} kind={kind} />
        </div>

        {/* Form */}
        <div className="nice-scrollbar min-h-0 space-y-4 overflow-y-auto pr-2">
          {fields.sender ? (
            <Section title="Your details">
              <div className="grid gap-2 sm:grid-cols-2">
                <Labeled label="Full name">
                  <input
                    className={field}
                    value={data.sender.name}
                    onChange={(e) => patchSender({ name: e.target.value })}
                  />
                </Labeled>
                <Labeled label="Email">
                  <input
                    className={field}
                    value={data.sender.email}
                    onChange={(e) => patchSender({ email: e.target.value })}
                  />
                </Labeled>
                <Labeled label="Phone">
                  <input
                    className={field}
                    value={data.sender.phone}
                    onChange={(e) => patchSender({ phone: e.target.value })}
                  />
                </Labeled>
                <Labeled label="Location">
                  <input
                    className={field}
                    value={data.sender.location}
                    onChange={(e) => patchSender({ location: e.target.value })}
                    placeholder="Dublin, Ireland"
                  />
                </Labeled>
                <Labeled label="Links">
                  <input
                    className={field}
                    value={data.sender.links}
                    onChange={(e) => patchSender({ links: e.target.value })}
                    placeholder="LinkedIn · Portfolio"
                  />
                </Labeled>
              </div>
            </Section>
          ) : null}

          {fields.date ? (
            <Section title="Date">
              <input
                className={field}
                aria-label="Date"
                value={data.date}
                onChange={(e) => patch({ date: e.target.value })}
                placeholder="13 June 2026"
              />
            </Section>
          ) : null}

          {fields.recipient ? (
            <Section title="Recipient">
              <div className="grid gap-2 sm:grid-cols-2">
                <Labeled label="Name">
                  <input
                    className={field}
                    value={data.recipient.name}
                    onChange={(e) => patchRecipient({ name: e.target.value })}
                    placeholder="Hiring Manager"
                  />
                </Labeled>
                <Labeled label="Title">
                  <input
                    className={field}
                    value={data.recipient.title}
                    onChange={(e) => patchRecipient({ title: e.target.value })}
                  />
                </Labeled>
                <Labeled label="Company">
                  <input
                    className={field}
                    value={data.recipient.company}
                    onChange={(e) => patchRecipient({ company: e.target.value })}
                  />
                </Labeled>
                <Labeled label="Location">
                  <input
                    className={field}
                    value={data.recipient.location}
                    onChange={(e) => patchRecipient({ location: e.target.value })}
                  />
                </Labeled>
              </div>
            </Section>
          ) : null}

          {fields.subject ? (
            <Section title={fields.subjectLabel}>
              <input
                className={field}
                aria-label={fields.subjectLabel}
                value={data.subject}
                onChange={(e) => patch({ subject: e.target.value })}
              />
            </Section>
          ) : null}

          {fields.greeting ? (
            <Section title="Greeting">
              <input
                className={field}
                aria-label="Greeting"
                value={data.greeting}
                onChange={(e) => patch({ greeting: e.target.value })}
                placeholder="Dear Hiring Manager,"
              />
            </Section>
          ) : null}

          <Section title={fields.bodyLabel}>
            <textarea
              aria-label={fields.bodyLabel}
              className={`${field} min-h-60`}
              value={data.body}
              onChange={(e) => patch({ body: e.target.value })}
              placeholder={fields.bodyPlaceholder}
            />
          </Section>

          {fields.signOff ? (
            <Section title="Sign-off">
              <input
                className={field}
                aria-label="Sign-off"
                value={data.signOff}
                onChange={(e) => patch({ signOff: e.target.value })}
                placeholder="Sincerely,"
              />
            </Section>
          ) : null}

          {fields.signature ? (
            <Section title="Signature">
              <input
                className={field}
                aria-label="Signature"
                value={data.signature}
                onChange={(e) => patch({ signature: e.target.value })}
                placeholder={data.sender.name || "Your name"}
              />
            </Section>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(templateToApply)}
        onOpenChange={(open) => {
          if (!open) setTemplateToApply(null);
        }}
        title="Replace document text?"
        description={`Use “${templateToApply?.name ?? ""}” in place of the current text. Existing saved revisions remain in History.`}
        confirmLabel="Use template"
        finalFocus={templateTrigger}
        onConfirm={() => {
          if (templateToApply) patch({ body: templateToApply.content });
          setTemplateToApply(null);
        }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
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
