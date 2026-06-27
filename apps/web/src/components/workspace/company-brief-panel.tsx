"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Building2, HelpCircle, Info, MessageCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCompanyBrief } from "@/app/dashboard/applications/actions";
import type { CompanyBrief } from "@/lib/interview/company-brief";

export function CompanyBriefPanel({
  jobTitle,
  jobCompany,
  jobDescription,
}: {
  jobTitle: string;
  jobCompany: string;
  jobDescription?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [brief, setBrief] = useState<CompanyBrief | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await getCompanyBrief({ company: jobCompany, role: jobTitle, jobDescription });
      if (!res.ok) return setError(res.message);
      setBrief(res.brief);
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Research {jobCompany}</h2>
        </div>
        <Button size="sm" variant={brief ? "outline" : "default"} onClick={run} disabled={pending}>
          {pending ? "Researching…" : brief ? "Refresh" : "Prep brief"}
        </Button>
      </div>

      {!brief && !error ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Walk in able to have a real conversation: what they do, what this role owns, smart questions
          to ask, and how your real experience connects. Understanding beats memorizing facts.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">{error}</p>
      ) : null}

      {brief ? (
        <div className="mt-3 space-y-3 text-sm">
          <Block label="What they do" value={brief.whatTheyDo} />
          <Block label="This role" value={brief.roleFocus} />
          <Block label="Industry" value={brief.industryContext} />

          {brief.smartQuestions.length > 0 ? (
            <List icon={HelpCircle} title="Smart questions to ask them" items={brief.smartQuestions} />
          ) : null}
          {brief.talkingPoints.length > 0 ? (
            <List icon={MessageCircle} title="Your talking points (from your real experience)" items={brief.talkingPoints} />
          ) : null}

          {/* Due diligence — scam/red-flag signals from the posting + where to verify. */}
          {brief.redFlags.length > 0 ? (
            <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-200/90">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                Red flags to watch (from this posting)
              </p>
              <ul className="space-y-0.5">
                {brief.redFlags.map((f, i) => (
                  <li key={i} className="text-foreground/90">• {f}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {brief.whereToVerify.length > 0 ? (
            <List icon={ShieldCheck} title="Verify the real story (work-life, reputation, legitimacy)" items={brief.whereToVerify} />
          ) : null}

          {/* Honesty: never present stale facts as current. */}
          <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
            <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
            {brief.recencyCaveat}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <p className="text-foreground/90">
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

function List({ icon: Icon, title, items }: { icon: typeof HelpCircle; title: string; items: string[] }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-foreground/90">• {it}</li>
        ))}
      </ul>
    </div>
  );
}
