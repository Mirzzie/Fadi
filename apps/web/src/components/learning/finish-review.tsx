"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Check, Circle, Clock, Loader2 } from "lucide-react";

import {
  addRecordToPortfolioAction,
  caseStudyAction,
  draftRecordStoryAction,
  projectFinishAction,
  saveProjectEvidenceAction,
  saveWalkthroughAction,
  type CaseStudyView,
  type FinishSource,
  type FinishView,
} from "@/app/dashboard/learning/project-finish-actions";
import { saveStory } from "@/app/dashboard/interview/actions";
import { PostComposer } from "@/components/learning/post-composer";
import { Button } from "@/components/ui/button";
import type { StoryDraft } from "@/lib/interview/story-bank";
import { ANGLE_LABEL, type PostAngle } from "@/lib/learning/case-study";
import { completionPackage, type PackageItem } from "@/lib/learning/project-review";

/**
 * THE FINISH LINE, AS ONE REVIEW.
 *
 * First one question — is this an accurate record of what you completed? — answered by
 * reading and editing what the steps can honestly say. Then, on the same screen, what that
 * record can become: portfolio, an interview story, a post. Each is a proposal with one
 * action. Nothing sends the person off to find the part of the app that does the next thing.
 */
export function FinishReview({ runId, stepsKey }: { runId: string; stepsKey: string }) {
  const [view, setView] = useState<FinishView | null>(null);
  const [summary, setSummary] = useState("");
  const [decision, setDecision] = useState("");
  const [wentWrong, setWentWrong] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    let alive = true;
    void projectFinishAction({ runId }).then((result) => {
      if (!alive || !result.ok) return;
      setView(result.view);
      setSummary((current) => current || result.view.review.summary);
    });
    return () => {
      alive = false;
    };
  }, [runId, stepsKey]);

  if (!view) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking the project…
      </p>
    );
  }

  if (view.savedEvidenceId && view.recordStatus) {
    return (
      <CompletionPackage
        source={{ runId }}
        recordStatus={view.recordStatus}
        onPortfolio={view.onPortfolio}
      />
    );
  }

  const { review } = view;
  return (
    <section className="rounded-2xl border border-primary/30 bg-card p-5">
      <p className="text-xs font-medium text-primary">Project complete</p>
      <h2 className="mt-0.5 text-lg font-semibold">
        Is this an accurate record of what you completed?
      </h2>

      <ul className="mt-3 space-y-1 text-sm">
        {review.lines.map((line) => (
          <li key={line.ordinal} className="flex gap-2">
            <span className="w-28 shrink-0 text-xs leading-5 text-muted-foreground">
              {line.proof}
            </span>
            <span className="min-w-0">
              {line.title}
              {line.result ? <span className="text-muted-foreground"> — {line.result}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      <label htmlFor="finish-summary" className="mt-4 block text-sm font-medium">
        In your words
      </label>
      <textarea
        id="finish-summary"
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        rows={6}
        className="mt-1 w-full rounded-md border border-border bg-background p-3 text-sm"
      />
      {review.shownCount === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          No step recorded a result, so add what you actually did before saving.
        </p>
      ) : null}

      {/* The two-minute test. A reviewer learns more from one real decision and one real
          mistake than from a list of steps — they are what separate doing from following. */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">A decision you made, and why</span>
          <span className="block text-xs text-muted-foreground">
            What you chose over what, and the trade-off. Optional, but it is what reviewers look
            for.
          </span>
          <textarea
            value={decision}
            onChange={(event) => setDecision(event.target.value)}
            rows={3}
            placeholder="e.g. Kept the database in a private subnet with no NAT gateway: harder to patch, but nothing can reach it from the internet."
            className="mt-1 w-full rounded-md border border-border bg-background p-2.5 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">What went wrong, and how you fixed it</span>
          <span className="block text-xs text-muted-foreground">
            Real work rarely works first time. How you found and fixed it says more than a clean
            run.
          </span>
          <textarea
            value={wentWrong}
            onChange={(event) => setWentWrong(event.target.value)}
            rows={3}
            placeholder="e.g. My first IAM policy allowed s3:* — the analyzer flagged it, so I scoped it to the one bucket."
            className="mt-1 w-full rounded-md border border-border bg-background p-2.5 text-sm"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={busy || summary.trim().length < 20}
          onClick={() =>
            start(async () => {
              const result = await saveProjectEvidenceAction({
                runId,
                summary,
                reflection: { decision, wentWrong },
              });
              setNote(result.ok ? null : result.message);
              if (result.ok && result.evidenceItemId && result.recordStatus) {
                setView({
                  ...view,
                  savedEvidenceId: result.evidenceItemId,
                  recordStatus: result.recordStatus,
                });
              }
            })
          }
        >
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          Yes, save it to my record
        </Button>
      </div>
      {note ? <p className="mt-2 text-xs text-destructive">{note}</p> : null}
    </section>
  );
}

/**
 * What a saved record can become. Shared by projects and by courses that never had a
 * project, so both finish the same way.
 */
export function CompletionPackage({
  source,
  recordStatus,
  onPortfolio: initiallyOnPortfolio,
  eyebrow = "Project complete",
}: {
  source: FinishSource;
  recordStatus: "saved" | "needs-review";
  onPortfolio: boolean;
  eyebrow?: string;
}) {
  const [onPortfolio, setOnPortfolio] = useState(initiallyOnPortfolio);
  const [storyAdded, setStoryAdded] = useState(false);
  const items = completionPackage({ recordStatus, onPortfolio, storyAdded });
  const state = (key: PackageItem["key"]) => items.find((item) => item.key === key)!.state;

  return (
    <section className="rounded-2xl border border-primary/30 bg-card p-5">
      <p className="text-xs font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-0.5 text-lg font-semibold">
        {recordStatus === "saved" ? "It's on your record" : "One thing to decide first"}
      </h2>

      <ol className="mt-4 divide-y divide-border/60">
        <Row
          state={state("record")}
          title="Career record"
          detail={
            recordStatus === "saved"
              ? "Saved. Your résumé and the documents Fadi drafts can draw on it."
              : "This may be work you already recorded. Decide in Your evidence whether it is new, then come back — nothing else is built on it until then."
          }
        >
          {recordStatus === "needs-review" ? (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard/evidence" />}
            >
              Decide in Your evidence
            </Button>
          ) : null}
        </Row>

        <Row
          state={state("portfolio")}
          title="Portfolio"
          detail={
            onPortfolio
              ? "On your portfolio. It goes public once you confirm it there."
              : "Add it to your portfolio. It stays private until you confirm it."
          }
        >
          {state("portfolio") === "ready" ? (
            <PortfolioAction source={source} onAdded={() => setOnPortfolio(true)} />
          ) : null}
        </Row>

        <Row
          state={state("story")}
          title="Interview story"
          detail={
            storyAdded
              ? "Added to your interview stories."
              : "Fadi drafts a STAR story from this record for you to keep or skip."
          }
        >
          {state("story") === "ready" ? (
            <StoryAction source={source} onAdded={() => setStoryAdded(true)} />
          ) : null}
        </Row>

        {state("post") === "ready" ? <ShowcaseRows source={source} /> : null}

        <Row
          state={state("post")}
          title="Posts about it"
          detail="One project, several true posts — each a different part of the same work, drafted from this record only. You post them yourself, a few days apart."
        >
          {state("post") === "ready" ? <PostAngles source={source} /> : null}
        </Row>
      </ol>
    </section>
  );
}

function Row({
  state,
  title,
  detail,
  children,
}: {
  state: PackageItem["state"];
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  const Icon = state === "done" ? Check : state === "waiting" ? Clock : Circle;
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${state === "done" ? "text-primary" : "text-muted-foreground"}`}
        aria-label={state}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    </li>
  );
}

function PortfolioAction({ source, onAdded }: { source: FinishSource; onAdded: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const result = await addRecordToPortfolioAction(source);
            if (result.ok) return onAdded();
            setNote(result.message);
          })
        }
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Add to portfolio
      </Button>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function StoryAction({ source, onAdded }: { source: FinishSource; onAdded: () => void }) {
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (skipped) return <p className="text-xs text-muted-foreground">Skipped.</p>;

  if (!draft) {
    return (
      <div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            start(async () => {
              setNote(null);
              const result = await draftRecordStoryAction(source);
              if (!result.ok) return setNote(result.message);
              setDraft(result.draft);
            })
          }
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {busy ? "Drafting…" : "Draft a story"}
        </Button>
        {note ? <p className="mt-1 text-xs text-destructive">{note}</p> : null}
      </div>
    );
  }

  const parts: Array<[string, string]> = [
    ["Situation", draft.situation],
    ["Task", draft.task],
    ["Action", draft.action],
    ["Result", draft.result],
    ["Reflection", draft.reflection],
  ];
  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <p className="text-sm font-medium">{draft.title}</p>
      <dl className="space-y-1 text-xs">
        {parts
          .filter(([, text]) => text)
          .map(([label, text]) => (
            <div key={label}>
              <dt className="inline font-medium">{label}: </dt>
              <dd className="inline text-muted-foreground">{text}</dd>
            </div>
          ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const result = await saveStory(draft);
              if (!result.ok) return setNote(result.message ?? "Couldn't save the story.");
              onAdded();
            })
          }
        >
          Keep it
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSkipped(true)}>
          Skip
        </Button>
      </div>
      {note ? <p className="text-xs text-destructive">{note}</p> : null}
    </div>
  );
}

/**
 * The README and the walkthrough: packaging that lets a reviewer understand the work in two
 * minutes, and hear the person explain it in five.
 */
function ShowcaseRows({ source }: { source: FinishSource }) {
  const [view, setView] = useState<CaseStudyView | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();
  const sourceKey = JSON.stringify(source);

  useEffect(() => {
    let alive = true;
    void caseStudyAction(JSON.parse(sourceKey) as FinishSource).then((result) => {
      if (alive && result.ok) setView(result.view);
    });
    return () => {
      alive = false;
    };
  }, [sourceKey]);

  if (!view) return null;

  const download = () => {
    const blob = new Blob([view.readme], { type: "text/markdown" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "README.md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
  };

  return (
    <>
      <Row
        state="ready"
        title="README for the repository"
        detail="The problem, what you did, what it shows, the decision and the fix — built from your record, nothing added. Put it at the top of the repo."
      >
        <details className="rounded-lg border border-border/60">
          <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
            Preview
          </summary>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-border/60 p-3 text-xs">
            {view.readme}
          </pre>
        </details>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={download}>
            Download README.md
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              void navigator.clipboard
                .writeText(view.readme)
                .then(() => setCopied(true))
                .catch(() => setCopied(false))
            }
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </Row>

      <Row
        state={view.walkthroughUrl ? "done" : "ready"}
        title="A five-minute walkthrough"
        detail={
          view.walkthroughUrl
            ? "Saved with this record. It shows on your portfolio and in the README."
            : "Record yourself explaining it — Loom, YouTube or your phone. Few candidates do this, and a reviewer can hear that you understand the work."
        }
      >
        {view.walkthroughUrl ? (
          <a
            href={view.walkthroughUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            {view.walkthroughUrl}
          </a>
        ) : (
          <div className="space-y-2">
            <ol className="space-y-1 text-xs">
              {view.outline.map((beat) => (
                <li key={beat.at} className="flex gap-2">
                  <span className="w-9 shrink-0 font-mono text-muted-foreground">{beat.at}</span>
                  <span>{beat.say}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.loom.com/share/…"
                aria-label="Walkthrough video link"
                className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-sm"
              />
              <Button
                size="sm"
                disabled={busy || !url.trim()}
                onClick={() =>
                  start(async () => {
                    const result = await saveWalkthroughAction({ ...source, url });
                    setNote(result.message);
                    if (!result.ok) return;
                    // The README names the walkthrough, so rebuild it now that there is one.
                    const fresh = await caseStudyAction(source);
                    setView(fresh.ok ? fresh.view : { ...view, walkthroughUrl: url.trim() });
                  })
                }
              >
                Save link
              </Button>
            </div>
            {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          </div>
        )}
      </Row>
    </>
  );
}

/** A post per angle the record can honestly support. */
function PostAngles({ source }: { source: FinishSource }) {
  const [angles, setAngles] = useState<PostAngle[] | null>(null);
  const sourceKey = JSON.stringify(source);
  useEffect(() => {
    let alive = true;
    void caseStudyAction(JSON.parse(sourceKey) as FinishSource).then((result) => {
      if (alive) setAngles(result.ok ? result.view.angles : ["result"]);
    });
    return () => {
      alive = false;
    };
  }, [sourceKey]);
  if (!angles) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {angles.map((angle) => (
        <div key={angle} className="rounded-lg border border-border/60 p-3">
          <p className="mb-2 text-xs font-medium">{ANGLE_LABEL[angle]}</p>
          <PostComposer source={source} angle={angle} label="Draft this post" />
        </div>
      ))}
    </div>
  );
}
