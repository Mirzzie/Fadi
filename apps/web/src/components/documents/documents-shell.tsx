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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  createDocumentAction,
  deleteDocumentAction,
  importResumeFileAction,
} from "@/app/dashboard/documents/actions";
import type { DocumentKind } from "@careeros/database";

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
    <div className="mx-auto max-w-shell space-y-6">
      <section className="relative overflow-hidden rounded-xl border bg-card p-6">
        <div className="relative space-y-4">
          <div>
            <Badge variant="secondary">Document studio</Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Your{" "}
              <span className="bg-gradient-to-r from-primary to-[oklch(0.7_0.17_230)] bg-clip-text text-transparent">
                documents
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Resumes, cover letters, emails and value propositions — saved, editable, and tied to
              the roles you&apos;re chasing. Kai can draft any of these for you.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Button
                key={k.kind}
                variant="outline"
                size="sm"
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

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No documents yet. Create one above, or ask Kai to draft a resume for a specific role.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {documents.map((doc) => {
            const meta = KIND_META[doc.kind] ?? { label: doc.kind, icon: FileText };
            return (
              <Card key={doc.id} className="group relative">
                <CardContent className="p-4">
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
                        <meta.icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-2 font-medium leading-tight">{doc.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {doc.preview || "Empty — open to start writing."}
                    </p>
                    <p className="mt-2 text-[0.7rem] text-muted-foreground">
                      Updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label="Delete document"
                    onClick={() => remove(doc.id)}
                    disabled={pending}
                    className={cn(
                      "absolute right-2 top-2 grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100",
                    )}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
