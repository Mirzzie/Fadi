"use client";

import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AiTellCheck } from "@/components/documents/ai-tell-check";
import { DocAdvisor } from "@/components/documents/doc-advisor";
import { DocTemplatePicker } from "@/components/documents/doc-template-picker";
import {
  DocumentHistoryLink,
  DocumentSaveIndicator,
  useVersionedDocumentSave,
} from "@/components/documents/versioned-save";
import type { DocKind } from "@/lib/jobs/application-types";
import type { DocTemplate } from "@/lib/documents/doc-templates";

const KIND_LABELS: Record<string, string> = {
  resume: "Resume",
  cover_letter: "Cover letter",
  email: "Email",
  value_proposition: "Value proposition",
  note: "Note",
};

/**
 * Phase-1 editor: title + body with debounced autosave and a plain-text export.
 * Phase 2 swaps the textarea for a rich editor with fonts + switchable templates;
 * Phase 3 lets Fadi generate straight into it; Phase 4 adds PDF/DOCX export.
 */
export function DocumentEditor({
  id,
  kind,
  initialTitle,
  initialContent,
  initialVersion,
}: {
  id: string;
  kind: string;
  initialTitle: string;
  initialContent: string;
  initialVersion: number;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [templateToApply, setTemplateToApply] = useState<DocTemplate | null>(null);
  const templateTrigger = useRef<HTMLButtonElement>(null);
  const [content, setContent] = useState(initialContent);
  const { status, markDirty, save: saveVersion } = useVersionedDocumentSave(id, initialVersion);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    await saveVersion({ title, content });
  }, [saveVersion, title, content]);

  // Debounced autosave after edits settle.
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, 1200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [title, content, save]);

  function onChange(next: { title?: string; content?: string }) {
    dirtyRef.current = true;
    markDirty();
    if (next.title !== undefined) setTitle(next.title);
    if (next.content !== undefined) setContent(next.content);
  }

  function exportPdf() {
    window.open(`/dashboard/documents/${id}/print`, "_blank");
  }
  function exportDocx() {
    window.open(`/api/documents/${id}/docx`, "_blank");
  }
  function applyTemplate(t: DocTemplate) {
    if (content.trim()) return setTemplateToApply(t);
    onChange({ content: t.content });
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full min-w-0 max-w-4xl flex-col gap-3 lg:h-[calc(100dvh-9rem)]">
      <h1 className="sr-only">{title || "Document editor"}</h1>
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href="/dashboard/documents"
            className="grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Back to documents"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {KIND_LABELS[kind] ?? kind}
          </span>
          <DocumentSaveIndicator status={status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DocumentHistoryLink id={id} />
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

      {/* Page */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-card">
        <input
          aria-label="Document title"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Document title"
          className="border-b border-border/60 bg-transparent px-5 py-3 text-lg font-semibold outline-none"
        />
        <textarea
          aria-label="Document content"
          value={content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Start writing, or ask Fadi to draft this for a specific role…"
          className="min-h-0 flex-1 resize-none bg-transparent px-5 py-4 font-mono text-sm leading-relaxed outline-none"
        />
      </div>

      {/* Recruiter-backed, document-specific guidance + live length meter */}
      <DocAdvisor kind={kind as DocKind} text={content} />

      {/* Honest reads-human check */}
      <AiTellCheck text={content} />
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
          if (templateToApply) onChange({ content: templateToApply.content });
          setTemplateToApply(null);
        }}
      />
    </div>
  );
}
