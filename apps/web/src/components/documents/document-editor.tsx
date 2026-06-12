"use client";

import { ArrowLeft, Check, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AiTellCheck } from "@/components/documents/ai-tell-check";
import { DocAdvisor } from "@/components/documents/doc-advisor";
import { DocTemplatePicker } from "@/components/documents/doc-template-picker";
import { updateDocumentAction } from "@/app/dashboard/documents/actions";
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
 * Phase 3 lets Scout generate straight into it; Phase 4 adds PDF/DOCX export.
 */
export function DocumentEditor({
  id,
  kind,
  initialTitle,
  initialContent,
}: {
  id: string;
  kind: string;
  initialTitle: string;
  initialContent: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    setStatus("saving");
    const res = await updateDocumentAction({ id, title, content });
    setStatus(res.ok ? "saved" : "idle");
    dirtyRef.current = false;
  }, [id, title, content]);

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
    setStatus("idle");
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
    if (content.trim() && !window.confirm("Replace the current content with this template?")) return;
    onChange({ content: t.content });
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-3xl flex-col gap-3">
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
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {KIND_LABELS[kind] ?? kind}
          </span>
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
              "Edits autosave"
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DocTemplatePicker kind={kind as DocKind} onPick={applyTemplate} />
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

      {/* Page */}
      <div className="scout-glow-sm flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card">
        <input
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Document title"
          className="border-b border-border/60 bg-transparent px-5 py-3 text-lg font-semibold outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Start writing, or ask Scout to draft this for a specific role…"
          className="min-h-0 flex-1 resize-none bg-transparent px-5 py-4 font-mono text-sm leading-relaxed outline-none"
        />
      </div>

      {/* Recruiter-backed, document-specific guidance + live length meter */}
      <DocAdvisor kind={kind as DocKind} text={content} />

      {/* Honest reads-human check */}
      <AiTellCheck text={content} />
    </div>
  );
}
