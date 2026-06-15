"use client";

import { ExternalLink, FileText, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
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
};
type DocView = { id: string; kind: string; title: string; applicationId: string | null; jobId: string | null };

const COLUMNS: { status: ApplicationStatus; label: string; tint: string }[] = [
  { status: "interested", label: "Interested", tint: "bg-muted/50" },
  { status: "applied", label: "Applied", tint: "bg-primary/10" },
  { status: "interviewing", label: "Interviewing", tint: "bg-amber-500/10" },
  { status: "offer", label: "Offer", tint: "bg-emerald-500/10" },
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
}: {
  applications: AppView[];
  documents: DocView[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<AppView | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="mx-auto max-w-shell space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Application{" "}
            <span className="bg-gradient-to-r from-primary to-[oklch(0.7_0.17_230)] bg-clip-text text-transparent">
              tracker
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Every role you&apos;re chasing, by stage. Open one to let Fadi draft a tailored resume,
            cover letter or cold email for it.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const items = applications.filter((a) => a.status === col.status);
          return (
            <div key={col.status} className="w-64 shrink-0 space-y-2">
              <div className={cn("flex items-center justify-between rounded-md px-3 py-1.5 text-sm font-medium", col.tint)}>
                <span>{col.label}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              {items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a)}
                  className="block w-full rounded-lg border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/40"
                >
                  <p className="line-clamp-2 text-sm font-medium leading-tight">{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.company}</p>
                  {documents.some((d) => d.applicationId === a.id || (a.jobId && d.jobId === a.jobId)) ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[0.7rem] text-primary">
                      <FileText className="size-3" aria-hidden="true" /> docs
                    </span>
                  ) : null}
                </button>
              ))}
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/50 p-3 text-center text-xs text-muted-foreground">
                  Nothing here yet
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {adding ? <AddDialog onClose={() => setAdding(false)} onDone={() => router.refresh()} /> : null}
      {selected ? (
        <DetailDialog
          app={selected}
          docs={documents.filter(
            (d) => d.applicationId === selected.id || (selected.jobId && d.jobId === selected.jobId),
          )}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border/60 bg-card p-5 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function AddDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [jd, setJd] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15";

  return (
    <Overlay onClose={onClose}>
      <h3 className="mb-1 font-semibold">Paste a job</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Drop in a job from anywhere — Fadi tailors your documents to its exact description.
      </p>
      <div className="space-y-2">
        <input className={input} placeholder="Role / job title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={input} placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <textarea
          className={`${input} min-h-32 resize-none`}
          placeholder="Paste the full job description here…"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
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

function DetailDialog({ app, docs, onClose }: { app: AppView; docs: DocView[]; onClose: () => void }) {
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
    <Overlay onClose={onClose}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold leading-tight">{app.title}</h3>
          <p className="text-sm text-muted-foreground">{app.company}</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent">
          <X className="size-4" aria-hidden="true" />
        </button>
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
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                app.status === c.status
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
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
            <button type="button" onClick={saveJd} disabled={pending} className="text-xs font-medium text-primary hover:underline">
              Save
            </button>
          ) : (
            <span className="text-[0.7rem] text-muted-foreground">Fadi tailors documents to this</span>
          )}
        </div>
        <textarea
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
            <Button key={d.kind} variant="outline" size="sm" disabled={pending} onClick={() => draft(d.kind)}>
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
        <a href={app.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Original posting <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      ) : null}
    </Overlay>
  );
}
