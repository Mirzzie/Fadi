"use client";

import {
  FileText,
  Mail,
  NotebookPen,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createDocumentAction,
  deleteDocumentAction,
  importResumeFileAction,
} from "@/app/dashboard/documents/actions";
import type { DocumentKind } from "@careeros/database";
import { formatDay } from "@/lib/format/date";

type DocView = { id: string; kind: string; title: string; updatedAt: string; preview: string };

const KINDS: { kind: DocumentKind; label: string; icon: LucideIcon }[] = [
  { kind: "resume", label: "Resume", icon: FileText },
  { kind: "cover_letter", label: "Cover letter", icon: NotebookPen },
  { kind: "email", label: "Email", icon: Mail },
  { kind: "value_proposition", label: "Value prop", icon: Sparkles },
];

const KIND_META: Record<string, { label: string; icon: LucideIcon }> = {
  resume: { label: "Resume", icon: FileText },
  cover_letter: { label: "Cover letter", icon: NotebookPen },
  email: { label: "Email", icon: Mail },
  value_proposition: { label: "Value proposition", icon: Sparkles },
  note: { label: "Note", icon: NotebookPen },
};

export function DocumentsShell({ documents }: { documents: DocView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    setError(null);
    const form = new FormData();
    form.append("file", file);
    startTransition(async () => {
      const res = await importResumeFileAction(form);
      if (res.ok && res.id) router.push(`/dashboard/documents/${res.id}`);
      else setError(res.message);
    });
  }

  function create(kind: DocumentKind) {
    setError(null);
    startTransition(async () => {
      const res = await createDocumentAction({ kind });
      if (res.ok && res.id) router.push(`/dashboard/documents/${res.id}`);
      else setError(res.message);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteDocumentAction(id);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-shell space-y-10 pb-12 pt-4">
      <section className="border-b border-border/70 pb-8">
        <div className="space-y-5">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Document studio</p>
            <h2 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Words ready to send.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Resumes, letters, emails and value propositions—editable, versioned, and connected to
              the opportunity they support.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-5">
            {KINDS.map((k) => (
              <Button
                key={k.kind}
                variant={k.kind === "resume" ? "default" : "outline"}
                size="sm"
                className="rounded-md"
                disabled={pending}
                onClick={() => create(k.kind)}
              >
                <Plus className="size-4" aria-hidden="true" />
                <k.icon className="size-4" aria-hidden="true" />
                {k.label}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="rounded-md"
              disabled={pending}
              onClick={() => fileInput.current?.click()}
              title="Import a CV from PDF, DOCX, DOC, TXT, or JSON Resume"
            >
              <Upload className="size-4" aria-hidden="true" />
              Import CV
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,application/json"
              className="hidden"
              onChange={onImportFile}
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h3 className="text-xl font-semibold tracking-tight">Library</h3>
          <span className="text-xs text-muted-foreground">{documents.length} saved</span>
        </div>
        <div className="divide-y border-y border-border/80">
        <button
          type="button"
          onClick={() => create("resume")}
          disabled={pending}
          className="group flex w-full items-center gap-4 py-5 text-left text-muted-foreground transition-colors hover:bg-muted/30 hover:text-primary sm:px-2"
        >
          <span className="grid size-9 place-items-center border border-border bg-muted/30 transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
            <Plus className="size-4" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-medium text-foreground">New resume</span>
            <span className="mt-0.5 block text-xs">Start from your career record</span>
          </span>
        </button>

        {documents.map((doc) => {
          const meta = KIND_META[doc.kind] ?? { label: doc.kind, icon: FileText };
          return (
            <div key={doc.id} className="group relative transition-colors hover:bg-muted/30">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-5 pr-12 text-left sm:px-2 sm:pr-14"
              >
                <span className="grid size-9 place-items-center bg-primary/10 text-primary">
                  <meta.icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="truncate text-sm font-semibold">{doc.title}</p>
                    <span className="shrink-0 text-[0.65rem] uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{doc.preview || "Empty — open to start writing."}</p>
                </div>
                <p className="hidden text-xs text-muted-foreground sm:block">Updated {formatDay(doc.updatedAt)}</p>
              </button>
              <button
                type="button"
                aria-label="Delete document"
                onClick={() => remove(doc.id)}
                disabled={pending}
                className={cn(
                  "absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100",
                )}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
        </div>
      </section>
    </div>
  );
}
