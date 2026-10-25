"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ExternalLink,
  ImagePlus,
  Loader2,
  MessageSquareQuote,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/layout/page-intro";
import { useGuideTarget } from "@/components/os/use-guide-target";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  buildEvidencePool,
  deleteEvidence,
  removeEvidenceArtifact,
  saveEvidence,
} from "@/app/dashboard/evidence/actions";
import { RenderingsPanel } from "./renderings-panel";
import { SameThingPanel } from "./same-thing-panel";
import { HistoryCapture } from "@/components/evidence/history-capture";
import type { EvidenceView, RankedEvidence } from "@/lib/evidence/pool";
import { mediaUploadConfigured, uploadPortfolioMedia } from "@/lib/portfolio/upload";

// Certification became a first-class kind when imports started classifying it; leaving it out
// here meant an imported certificate worked and a hand-added one could not be classified at all.
const KINDS = [
  "experience",
  "project",
  "achievement",
  "skill",
  "education",
  "certification",
] as const;

export function EvidencePool({
  track,
  ranked,
  hasStoredHistory = false,
}: {
  track: { role: string; domain: string | null } | null;
  ranked: RankedEvidence[];
  /** A CV or LinkedIn text is already on file — so the screen can say what is missing. */
  hasStoredHistory?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reviewVersion, setReviewVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [capturing, setCapturing] = useState(false);

  function build() {
    setError(null);
    startTransition(async () => {
      const r = await buildEvidencePool();
      if (!r.ok) setError(r.message);
      else {
        // TWO NUMBERS THAT MEANT DIFFERENT THINGS read as one that disagreed with itself: this
        // counted imports held for a decision, while the panel below counts every pair it
        // raises, including ones between records already accepted. Say which is which.
        setNotice(
          r.pendingReview > 0
            ? `${r.items.length} new records saved. ${r.pendingReview} ${r.pendingReview === 1 ? "import is" : "imports are"} waiting on your decision below.`
            : `${r.items.length} new records saved.`
        );
        setReviewVersion((v) => v + 1);
        router.refresh();
      }
    });
  }

  const recordGuide = useGuideTarget<HTMLButtonElement>(
    "record.add",
    "Keep your record current",
    "Use this to add new work or outcomes. Review proposed facts before accepting them into your record."
  );

  function remove(id: string) {
    startTransition(async () => {
      await deleteEvidence({ id });
      router.refresh();
    });
  }

  function removeArtifact(id: string) {
    startTransition(async () => {
      const result = await removeEvidenceArtifact({ id });
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-12 lg:pt-5">
      <PageIntro
        eyebrow="My career"
        title="Your working record"
        description={
          <>
            <p>
              Keep your experience, completed work and outcomes together. Review the facts you use
              in documents, your portfolio and interview preparation.
            </p>
            <p className="text-xs text-muted-foreground">
              Current direction:{" "}
              {track ? <span className="text-foreground">{track.role}</span> : "not set"}.
              {track
                ? " Relevance changes with direction; your record does not."
                : " Add a direction when you want tailored ordering."}
            </p>
          </>
        }
      />

      {ranked.length > 0 ? (
        <section className="border-y border-border py-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="max-w-xl">
            <h2 className="font-medium">Keep your record current</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add new work, learning or outcomes. Fadi will compare them with what is already here
              before anything becomes career evidence.
            </p>
          </div>
          <Button
            ref={recordGuide}
            className="mt-4 shrink-0 sm:mt-0"
            onClick={() => setCapturing((v) => !v)}
            disabled={pending}
          >
            <Wand2 className="size-4" aria-hidden="true" />
            {capturing ? "Close intake" : "Add to my record"}
          </Button>
        </section>
      ) : null}

      {capturing && ranked.length > 0 ? (
        <HistoryCapture
          title="Add to your career record"
          onSaved={() => {
            setCapturing(false);
            setError(null);
            build();
          }}
        />
      ) : null}

      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">{error}</p>
      ) : null}

      {/* Duplicates are caught HERE because the pool is what every other surface
          projects from — one reality stored twice becomes a duplicate in the résumé,
          the portfolio and Fadi's prompt block simultaneously. */}
      <SameThingPanel key={reviewVersion} onChanged={() => router.refresh()} />

      {editing === "new" ? (
        <EvidenceEditor
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReviewVersion((v) => v + 1);
            router.refresh();
          }}
        />
      ) : null}

      {ranked.length === 0 ? (
        editing !== "new" ? (
          <div className="space-y-3">
            {hasStoredHistory ? (
              /* A CV saved with nothing built from it was the commonest broken state: the text was
               on file, the record was empty, and every other screen quietly had nothing to work
               with. Say that plainly, and make the fix one button. */
              <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                <p className="text-sm font-medium">
                  Your CV is saved — Fadi hasn&apos;t read it yet.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reading it turns it into records you can check and correct. Everything else —
                  documents, your portfolio, interview prep — works from those records, not from the
                  CV text.
                </p>
                <Button size="sm" className="mt-3" onClick={build} disabled={pending}>
                  <Wand2 className="size-4" aria-hidden="true" />
                  {pending ? "Reading your CV…" : "Read it and build my record"}
                </Button>
              </div>
            ) : (
              <HistoryCapture
                onSaved={() => {
                  setError(null);
                  build();
                }}
              />
            )}
          </div>
        ) : null
      ) : (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Career record</h2>
              <p className="text-xs text-muted-foreground">
                {ranked.length} {ranked.length === 1 ? "record" : "records"} · ordered for{" "}
                {track?.role ?? "your next direction"}
              </p>
            </div>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
            {ranked.map((r) =>
              editing === r.item.id ? (
                <li key={r.item.id} className="p-4 sm:p-5">
                  <EvidenceEditor
                    item={r.item}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                      setEditing(null);
                      setReviewVersion((v) => v + 1);
                      router.refresh();
                    }}
                  />
                </li>
              ) : (
                <EvidenceCard
                  key={r.item.id}
                  ranked={r}
                  hasTrack={Boolean(track)}
                  trackRole={track?.role ?? ""}
                  onEdit={() => setEditing(r.item.id)}
                  onRemove={() => remove(r.item.id)}
                  onRemoveArtifact={removeArtifact}
                />
              )
            )}
          </ul>
        </section>
      )}

      <details className="group text-sm text-muted-foreground">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 hover:text-foreground">
          Other ways to use this record
          <ChevronDown
            className="size-4 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-l border-border pl-4">
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 hover:text-foreground"
            disabled={pending}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add one item manually
          </button>
          <Link
            href="/dashboard/evidence/stories"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <MessageSquareQuote className="size-4" aria-hidden="true" />
            Review interview stories
          </Link>
        </div>
      </details>
    </div>
  );
}

function EvidenceCard({
  ranked,
  hasTrack,
  trackRole,
  onEdit,
  onRemove,
  onRemoveArtifact,
}: {
  ranked: RankedEvidence;
  hasTrack: boolean;
  trackRole: string;
  onEdit: () => void;
  onRemove: () => void;
  onRemoveArtifact: (id: string) => void;
}) {
  const { item, score, matched } = ranked;
  return (
    <li className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[0.6rem] capitalize">
              {item.kind}
            </Badge>
            <span className="font-medium">{item.title}</span>
            {item.origin === "ai" ? (
              <Sparkles className="size-3 text-muted-foreground" aria-hidden="true" />
            ) : null}
          </div>
          {item.organization || item.period ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[item.organization, item.period].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-foreground/70 hover:text-foreground"
            title="Edit"
            aria-label="Edit"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {item.detail ? <p className="mt-2 text-sm text-foreground/90">{item.detail}</p> : null}
      {item.metrics ? <p className="mt-1 text-sm text-primary">{item.metrics}</p> : null}

      {(item.artifacts ?? []).length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(item.artifacts ?? []).map((artifact) => (
            <span
              key={artifact.id}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
            >
              <a
                href={artifact.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {artifact.label || artifact.kind}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => onRemoveArtifact(artifact.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={"Remove " + (artifact.label || artifact.kind)}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {item.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tags.map((t) => (
            <span
              key={t}
              className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {/* Per-track framing — the graph in action. */}
      {hasTrack ? (
        score > 0 ? (
          <p className="mt-2 text-xs text-success">
            Strong evidence for {trackRole}
            {matched.length ? ` (matches: ${matched.join(", ")})` : ""}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Not central to {trackRole} — kept in your pool for your other directions.
          </p>
        )
      ) : null}

      {/* The other wordings of this same fact, if any — the payoff of separating a
          real thing from the words used to describe it. */}
      <RenderingsPanel itemId={item.id} />

      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">Record options</summary>
        <button
          type="button"
          onClick={onRemove}
          className="mt-2 inline-flex items-center gap-1.5 text-destructive/80 hover:text-destructive"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Remove from my record
        </button>
      </details>
    </li>
  );
}

function EvidenceEditor({
  item,
  onClose,
  onSaved,
}: {
  item?: EvidenceView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    kind: String(item?.kind ?? "experience"),
    title: item?.title ?? "",
    organization: item?.organization ?? "",
    period: item?.period ?? "",
    detail: item?.detail ?? "",
    metrics: item?.metrics ?? "",
    tags: (item?.tags ?? []).join(", "),
    artifactUrls: (item?.artifacts ?? []).map((artifact) => artifact.url).join("\n"),
  });

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveEvidence({
        id: item?.id,
        kind: form.kind,
        title: form.title,
        organization: form.organization,
        period: form.period,
        detail: form.detail,
        metrics: form.metrics,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        artifactUrls: form.artifactUrls
          .split("\n")
          .map((url) => url.trim())
          .filter(Boolean),
      });
      if (!res.ok) return setError(res.message);
      onSaved();
    });
  }

  async function uploadMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await Promise.all(files.map((file) => uploadPortfolioMedia(file)));
      setForm((current) => ({
        ...current,
        artifactUrls: [current.artifactUrls, ...urls].filter(Boolean).join("\n"),
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Kind</span>
          <select
            aria-label="Kind"
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm capitalize"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <Field label="Title">
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
          />
        </Field>
        <Field label="Organization">
          <Input
            value={form.organization}
            onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
          />
        </Field>
        <Field label="Period">
          <Input
            value={form.period}
            onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
            placeholder="2021–2023"
          />
        </Field>
      </div>
      <Field label="What you did">
        <Textarea
          rows={2}
          value={form.detail}
          onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
        />
      </Field>
      <Field label="Real metrics / outcome (optional)">
        <Input
          value={form.metrics}
          onChange={(e) => setForm((f) => ({ ...f, metrics: e.target.value }))}
        />
      </Field>
      <Field label="Tags (skills/domains, comma-separated — these power per-track relevance)">
        <Input
          value={form.tags}
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          placeholder="e.g. patient care, triage, leadership"
        />
      </Field>
      <Field label="Media or source links (optional, one URL per line)">
        <Textarea
          rows={2}
          value={form.artifactUrls}
          onChange={(e) => setForm((f) => ({ ...f, artifactUrls: e.target.value }))}
          placeholder="Repository, write-up, screenshot or video URL"
        />
      </Field>
      {mediaUploadConfigured() ? (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-xs hover:bg-muted">
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          {uploading ? "Uploading…" : "Upload images or video"}
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            onChange={uploadMedia}
            disabled={uploading}
          />
        </label>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Media strengthens a public project but is never required. It stays attached to this Evidence
        record when the portfolio changes.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending || uploading || !form.title.trim()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
