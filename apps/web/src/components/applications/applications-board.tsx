"use client";

import { ExternalLink, FileText, Loader2, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageIntro } from "@/components/layout/page-intro";
import { cn } from "@/lib/utils";
import {
  createApplicationAction,
  generateApplicationDocumentAction,
  updateApplicationAction,
  updateApplicationStatusAction,
} from "@/app/dashboard/applications/board-actions";
import type { ApplicationStatus, DocKind } from "@/lib/jobs/application-types";

type AppView = {
  id: string;
  jobId: string | null;
  company: string;
  title: string;
  status: string;
  url: string | null;
  jobDescription: string | null;
  appliedAt: string | null;
  /** Which career direction this application belongs to (null = pre-tracks). */
  trackName?: string | null;
};
type DocView = {
  id: string;
  kind: string;
  title: string;
  applicationId: string | null;
  jobId: string | null;
};

const COLUMNS: { status: ApplicationStatus; label: string; tint: string }[] = [
  { status: "interested", label: "Interested", tint: "bg-muted/50" },
  { status: "applied", label: "Applied", tint: "bg-primary/10" },
  { status: "interviewing", label: "Interviewing", tint: "bg-warning/10" },
  { status: "offer", label: "Offer", tint: "bg-success/10" },
  { status: "rejected", label: "Rejected", tint: "bg-destructive/10" },
];

const DOC_ACTIONS: { kind: DocKind; label: string }[] = [
  { kind: "resume", label: "Build a resume" },
  { kind: "cover_letter", label: "Make a cover letter" },
  { kind: "email", label: "Write a cold email" },
  { kind: "value_proposition", label: "Create a value-prop doc" },
];

export function ApplicationsBoard({
  applications,
  documents,
  scope = "all",
  activeTrackName = null,
  channelInsight = null,
}: {
  applications: AppView[];
  documents: DocView[];
  /** "active" = only the current direction's pipeline; "all" = every direction. */
  scope?: "active" | "all";
  activeTrackName?: string | null;
  /** Monoculture warning — null unless the pipeline is genuinely concentrated. */
  channelInsight?: { headline: string; action: string } | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<AppView | null>(null);
  const [adding, setAdding] = useState(false);
  // The URL still owns the view. A mounted inactive panel must not leave a portal over the library.
  const isActive = useSearchParams().get("view") !== "documents";

  return (
    <div className="mx-auto max-w-shell space-y-8 pb-12 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <PageIntro
            eyebrow="Opportunities"
            title="Your applications"
            description="Track each opportunity at the stage it has reached. Open one to prepare its documents and next action."
          />
          {/* A filtered board must SAY it's filtered — otherwise hidden rows read
              as data loss. Links to the setting rather than hiding the choice. */}
          <p className="mt-1 text-xs text-muted-foreground">
            {scope === "active" ? (
              <>
                Showing{" "}
                <span className="text-foreground">
                  {activeTrackName ?? "your active direction"}
                </span>{" "}
                only ·{" "}
                <Link href="/dashboard/settings" className="underline hover:text-primary">
                  show all directions
                </Link>
              </>
            ) : (
              <>
                Showing <span className="text-foreground">all directions</span> ·{" "}
                <Link href="/dashboard/settings" className="underline hover:text-primary">
                  show active only
                </Link>
              </>
            )}
          </p>
        </div>
        <Button className="rounded-md" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>

      {/* Monoculture warning. Deliberately NOT styled as an error: this is not the
          user failing, it's the market being correlated. It only renders when the
          data actually supports the claim. */}
      {channelInsight ? (
        <div className="border-y border-warning/40 bg-warning/5 px-1 py-4">
          <p className="text-sm text-foreground">{channelInsight.headline}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{channelInsight.action}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Source: Algorithmic Monocultures in Hiring — Stanford Digital Economy Lab, ACM FAccT
            2026 (3.4M applicants).
          </p>
        </div>
      ) : null}

      {/* Kanban */}
      <div className="flex gap-0 overflow-x-auto border-y border-border/80">
        {COLUMNS.map((col) => {
          const items = applications.filter((a) => a.status === col.status);
          return (
            <div
              key={col.status}
              className="w-64 shrink-0 border-r border-border/70 last:border-r-0"
            >
              <div
                className={cn(
                  "flex items-center justify-between border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]",
                  col.tint
                )}
              >
                <span>{col.label}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              {items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a)}
                  className="block w-full border-b border-border/60 bg-background p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <p className="line-clamp-2 text-sm font-medium leading-tight">{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.company}</p>
                  {documents.some(
                    (d) => d.applicationId === a.id || (a.jobId && d.jobId === a.jobId)
                  ) ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[0.7rem] text-primary">
                      <FileText className="size-3" aria-hidden="true" /> docs
                    </span>
                  ) : null}
                </button>
              ))}
              {items.length === 0 ? (
                <p className="p-5 text-center text-xs text-muted-foreground">Nothing here yet</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {adding ? (
        <AddDialog
          open={isActive}
          onClose={() => setAdding(false)}
          onDone={() => router.refresh()}
        />
      ) : null}
      {selected ? (
        <DetailDialog
          open={isActive}
          app={selected}
          docs={documents.filter(
            (d) => d.applicationId === selected.id || (selected.jobId && d.jobId === selected.jobId)
          )}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function Overlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="block p-5 sm:max-w-lg">{children}</DialogContent>
    </Dialog>
  );
}

function AddDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formId = useId();

  return (
    <Overlay open={open} onClose={onClose}>
      <DialogTitle className="mb-2 pr-8 text-xl">Add an opportunity</DialogTitle>
      <DialogDescription className="mb-5 text-sm leading-relaxed">
        Save the role and its description to your application tracker. You can prepare documents
        after reviewing it.
      </DialogDescription>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-role`}>Role / job title</Label>
          <Input
            id={`${formId}-role`}
            placeholder="Role / job title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-company`}>Company</Label>
          <Input
            id={`${formId}-company`}
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-description`}>Job description</Label>
          <Textarea
            id={`${formId}-description`}
            className="min-h-32 resize-y"
            placeholder="Paste the full job description here…"
            value={jd}
            onChange={(e) => setJd(e.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await createApplicationAction({ company, title, jobDescription: jd });
              if (res.ok) {
                onClose();
                router.refresh();
                onDone();
              } else setError(res.message);
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Add
        </Button>
      </div>
    </Overlay>
  );
}

function DetailDialog({
  open,
  app,
  docs,
  onClose,
}: {
  open: boolean;
  app: AppView;
  docs: DocView[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jd, setJd] = useState(app.jobDescription ?? "");
  const [jdSaved, setJdSaved] = useState(true);

  function setStatus(status: ApplicationStatus) {
    start(async () => {
      await updateApplicationStatusAction(app.id, status);
      router.refresh();
    });
  }

  function saveJd() {
    start(async () => {
      await updateApplicationAction(app.id, { jobDescription: jd });
      setJdSaved(true);
      router.refresh();
    });
  }

  function draft(kind: DocKind) {
    setError(null);
    setBusyKind(kind);
    start(async () => {
      // Persist any unsaved JD edits first so the draft tailors to the latest.
      if (!jdSaved) {
        await updateApplicationAction(app.id, { jobDescription: jd });
        setJdSaved(true);
      }
      const res = await generateApplicationDocumentAction(app.id, kind);
      setBusyKind(null);
      if (res.ok && res.id) router.push(`/dashboard/documents/${res.id}`);
      else setError(res.message);
    });
  }

  return (
    <Overlay open={open} onClose={onClose}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <DialogTitle className="pr-8 text-xl leading-tight">{app.title}</DialogTitle>
          <DialogDescription className="mt-1 text-sm">{app.company}</DialogDescription>
          {app.jobId ? (
            <Link
              href={`/dashboard/applications/${app.jobId}/workspace`}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open full workspace
              <ExternalLink className="size-3" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>

      {/* Status */}
      <div className="mb-4">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Status</p>
        <div className="flex flex-wrap gap-1.5">
          {COLUMNS.map((c) => (
            <button
              key={c.status}
              type="button"
              onClick={() => setStatus(c.status)}
              disabled={pending}
              aria-pressed={app.status === c.status}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                app.status === c.status
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Job description (paste-a-JD) */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Job description</p>
          {!jdSaved ? (
            <button
              type="button"
              onClick={saveJd}
              disabled={pending}
              className="text-xs font-medium text-primary hover:underline"
            >
              Save
            </button>
          ) : (
            <span className="text-[0.7rem] text-muted-foreground">
              Fadi tailors documents to this
            </span>
          )}
        </div>
        <textarea
          aria-label="Job description"
          value={jd}
          onChange={(e) => {
            setJd(e.target.value);
            setJdSaved(false);
          }}
          placeholder="Paste the job description so Fadi tailors to it…"
          className="min-h-24 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
        />
      </div>

      {/* Fadi document actions */}
      <div className="mb-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          {jd.trim() ? "Let Fadi draft — tailored to this JD" : "Let Fadi draft for this role"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DOC_ACTIONS.map((d) => (
            <Button
              key={d.kind}
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => draft(d.kind)}
            >
              {busyKind === d.kind ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              {d.label}
            </Button>
          ))}
        </div>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </div>

      {/* Linked documents */}
      {docs.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Documents</p>
          <div className="space-y-1.5">
            {docs.map((d) => (
              <a
                key={d.id}
                href={`/dashboard/documents/${d.id}`}
                className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm hover:border-primary/40"
              >
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" aria-hidden="true" />
                  {d.title}
                </span>
                <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {app.url ? (
        <a
          href={app.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Original posting <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      ) : null}
    </Overlay>
  );
}
