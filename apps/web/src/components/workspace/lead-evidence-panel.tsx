"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArrowDown, Languages, ListOrdered, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { chooseLeadEvidenceForJob } from "@/app/dashboard/applications/actions";
import type { LeadDecision, LeadPick } from "@/lib/evidence/lead";

/**
 * "What should lead for this role?"
 *
 * Deliberately NOT another score. The fit gate above already answers go/no-go;
 * repeating that number here would be the exact thing this panel exists to avoid.
 * What a candidate actually needs once they've decided to apply is an ORDER — and
 * the nerve to hold something back — so this renders a running order and the
 * reason for each position, in plain language.
 */
export function LeadEvidencePanel({
  jobTitle,
  jobDescription,
}: {
  jobTitle: string;
  jobDescription?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [decision, setDecision] = useState<LeadDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasJd = Boolean(jobDescription && jobDescription.trim());

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await chooseLeadEvidenceForJob({
        jobTitle,
        jobDescription: jobDescription ?? "",
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDecision(res.decision);
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="size-4 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-sm font-semibold">What should lead here?</h2>
        </div>
        <Button
          size="sm"
          variant={decision ? "outline" : "default"}
          onClick={run}
          disabled={pending || !hasJd}
        >
          {pending ? "Choosing…" : decision ? "Re-check" : "Choose"}
        </Button>
      </div>

      {!hasJd ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Add the job description below and I&apos;ll pick which of your evidence goes first for
          this specific role.
        </p>
      ) : !decision && !error ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Not another fit score — a running order. Which of your real evidence leads, what supports
          it, and what to hold back so the claim stays sharp.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">{error}</p>
      ) : null}

      {decision ? (
        <div className="mt-3 space-y-4">
          {/* The spine — what this application actually claims. */}
          {decision.spine.length > 0 ? (
            <p className="text-sm">
              <span className="text-muted-foreground">The spine of this application: </span>
              <span className="font-medium text-foreground">{decision.spine.join(" · ")}</span>
            </p>
          ) : null}

          {/* The dilution warning: the reviewer's complaint, measured. */}
          {decision.spread.diluted ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-2.5 text-sm">
              <AlertTriangle className="mr-1.5 inline size-3.5 text-warning" aria-hidden="true" />
              {decision.spread.note}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{decision.spread.note}</p>
          )}

          <Group
            icon={Star}
            tone="text-primary"
            title="Lead with"
            hint="First thing they read."
            picks={decision.lead}
          />
          <Group
            icon={ArrowDown}
            tone="text-muted-foreground"
            title="Support"
            hint="Include, but don't let it lead."
            picks={decision.support}
          />
          <Group
            icon={ArrowDown}
            tone="text-warning"
            title="Hold back for this one"
            hint="Still yours — just not this application's story."
            picks={decision.holdBack}
          />
          {/* Never framed as "weak": a zero score means untranslated, which is the
              single most valuable thing this platform can tell a thin-CV candidate. */}
          <Group
            icon={Languages}
            tone="text-primary"
            title="Translate before you send"
            hint="Real evidence this posting can't see yet — name it in their words if that's genuinely accurate."
            picks={decision.untranslated}
          />

          <p className="text-xs text-muted-foreground">
            Nothing here is deleted from your history — this is the running order for this one
            application.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Group({
  icon: Icon,
  tone,
  title,
  hint,
  picks,
}: {
  icon: typeof Star;
  tone: string;
  title: string;
  hint: string;
  picks: LeadPick[];
}) {
  if (picks.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={`size-3.5 ${tone}`} aria-hidden="true" />
        {title}
        <span className="font-normal normal-case tracking-normal opacity-70">— {hint}</span>
      </p>
      <ul className="space-y-1.5">
        {picks.map((p) => (
          <li key={p.item.id} className="rounded-md border border-border/60 bg-background/40 p-2.5">
            <p className="text-sm font-medium leading-tight">
              {p.item.title}
              {p.item.organization ? (
                <span className="text-muted-foreground"> · {p.item.organization}</span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{p.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
