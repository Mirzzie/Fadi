"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Bot,
  Eye,
  FileDown,
  History,
  Mail,
  MousePointerClick,
  RefreshCw,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  clearPortfolioTestEvents,
  loadPortfolioStats,
  syncPortfolioAudience,
} from "@/app/dashboard/portfolio/actions";
import type { FeedbackNote, PortfolioStats, TimelineEntry } from "@/lib/portfolio/analytics";

import { Modal } from "./modal";

/**
 * WHO'S LOOKING — the owner's own visitor numbers.
 *
 * Deliberately not a traffic dashboard. Sessions and bounce rates don't change
 * what anyone does next; "three people came for your safeguarding work and two of
 * them opened it" does. So the page leads with WHAT VISITORS SAID THEY CAME FOR —
 * the answer the welcome gate collects and, until now, threw away.
 *
 * Career-neutral throughout: every label here describes reading a page, and every
 * value shown is the owner's own vocabulary. A midwife sees midwifery terms and a
 * joiner sees joinery ones, because the words come from their content, not from us.
 */
export function AudienceModal({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackNote[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [showExcluded, setShowExcluded] = useState(false);
  const [handle, setHandle] = useState("");
  const [published, setPublished] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    loadPortfolioStats({ days: 30 }).then((res) => {
      if (!res.ok) return setError(res.message);
      setStats(res.stats);
      setFeedback(res.feedback);
      setTimeline(res.timeline);
      setHandle(res.handle);
      setPublished(res.isPublished);
    });
  }

  useEffect(refresh, []);

  // Your hosted copy reports to the public collector, not to this machine — Fadi is
  // usually off. This is the moment those events come home.
  function sync() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await syncPortfolioAudience();
      if (!res.ok) return setError(res.message);
      setNotice(
        res.imported > 0
          ? `Brought in ${res.imported} new event${res.imported === 1 ? "" : "s"}.`
          : "Already up to date.",
      );
      refresh();
    });
  }

  const quiet =
    stats && stats.views === 0 && stats.itemsOpened === 0 && stats.contactClicks === 0;

  return (
    <Modal title="Who's looking" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Anonymous, first-party, and stored in your own database — no cookies, no third party, no
          consent banner. Visitors are counted with a pseudonym that changes every day, so it can
          tell one reader from five but can&apos;t follow anyone around.
        </p>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            Hosting your site elsewhere (GitHub Pages)? Its visits wait in your collector until
            you pull them in.
          </p>
          <Button size="sm" variant="outline" onClick={sync} disabled={pending}>
            <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
            {pending ? "Syncing…" : "Sync"}
          </Button>
        </div>

        {notice ? (
          <p className="rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">{notice}</p>
        ) : null}

        {error ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">{error}</p>
        ) : null}

        {!published ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-2.5 text-sm">
            This site isn&apos;t published yet, so nobody can reach it.
          </p>
        ) : null}

        {stats ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat icon={Eye} label="Views" value={stats.views} />
              <Stat icon={Users} label="People" value={stats.visitors} />
              <Stat icon={MousePointerClick} label="Work opened" value={stats.itemsOpened} />
              <Stat icon={FileDown} label="CV downloads" value={stats.resumeDownloads} />
              <Stat icon={Mail} label="Contact clicks" value={stats.contactClicks} />
            </div>

            {quiet ? (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Nothing recorded since {stats.since}. That usually means the link hasn&apos;t been
                shared yet rather than that people came and left — views are counted on the server,
                so ad-blockers don&apos;t hide them.
              </p>
            ) : null}

            {/* What people WROTE comes before what they did. A sentence someone took
                the trouble to type outranks any count on this page. */}
            {feedback.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Feedback ({feedback.length})
                </p>
                <ul className="space-y-2">
                  {feedback.map((f, i) => (
                    <li key={i} className="rounded-md border border-border bg-background/40 p-3">
                      <p className="text-sm">{f.message}</p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {f.from || "Anonymous"}
                        {f.contact ? (
                          <>
                            {" · "}
                            <a href={`mailto:${f.contact}`} className="underline hover:text-primary">
                              {f.contact}
                            </a>
                          </>
                        ) : null}
                        {" · "}
                        {f.kind} · {f.at}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Breakdown
              title="What they came for"
              hint="Chosen by visitors themselves, in your words."
              rows={stats.focuses}
            />
            <Breakdown
              title="Who they said they were"
              hint="From the welcome prompt on your site."
              rows={stats.roles}
            />
            <Breakdown
              title="What got opened"
              hint="The work people actually clicked into."
              rows={stats.items}
            />

            {/* Your own visits are shown, never counted. A number that silently
                ignored you would look broken; one that counted you would invent an
                audience. */}
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                <span className="text-foreground">{stats.selfVisits}</span> of your own visits were
                excluded — you&apos;re not an audience, and counting yourself would read as
                interest that isn&apos;t there.
              </p>
              {stats.botVisits > 0 ? (
                <p className="mt-1.5">
                  <span className="text-foreground">{stats.botVisits}</span> automated
                  hits (crawlers, uptime monitors, scripted requests) were excluded too — a
                  search-engine spider is not a reader.
                </p>
              ) : null}
              <p className="mt-1.5">
                Viewing from another browser or phone? Open{" "}
                <span className="text-foreground">/p/{handle}?not-me=1</span> once there and that
                browser stops counting too.
              </p>
            </div>

            <Timeline
              entries={timeline}
              showExcluded={showExcluded}
              onToggle={() => setShowExcluded((v) => !v)}
              onClear={() =>
                startTransition(async () => {
                  const res = await clearPortfolioTestEvents();
                  if (!res.ok) return setError(res.message);
                  setNotice(
                    res.removed === 0
                      ? "Nothing to clear."
                      : `Cleared ${res.removed} of your own and automated events.`,
                  );
                  refresh();
                })
              }
              pending={pending}
            />

            <p className="text-xs text-muted-foreground">
              Last 30 days · your site is at <span className="text-foreground">/p/{handle}</span>
            </p>
          </>
        ) : !error ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : null}
      </div>
    </Modal>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 font-heading text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Breakdown({
  title,
  hint,
  rows,
}: {
  title: string;
  hint: string;
  rows: { value: string; total: number }[];
}) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} <span className="font-normal normal-case tracking-normal opacity-70">— {hint}</span>
      </p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.value} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
            <span className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-2">
              <span className="truncate">{r.value}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(r.total / max) * 100}%` }}
                />
              </span>
            </span>
            <span className="tabular-nums text-muted-foreground">{r.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** How each event reads in the log. The owner's own words wherever there are any. */
const VERB: Record<string, string> = {
  view: "opened your page",
  item_opened: "opened",
  persona_declared: "said who they are",
  resume_downloaded: "downloaded your CV",
  contact_clicked: "clicked contact",
  feedback: "left feedback",
};

/**
 * THE LOG.
 *
 * Counters cannot answer the question an owner actually asks when a number moves —
 * "was that real, or was that me testing?" Only a list can. So every event is here,
 * newest first, and the ones excluded from the counts are shown as excluded rather
 * than hidden: a row you can see and dismiss is worth more than a number you have to
 * trust.
 *
 * Clearing removes ONLY your own visits and automated hits. There is deliberately no
 * way to delete a genuine visitor's event from here — a record you can edit to taste
 * is not a record.
 */
function Timeline({
  entries,
  showExcluded,
  onToggle,
  onClear,
  pending,
}: {
  entries: TimelineEntry[];
  showExcluded: boolean;
  onToggle: () => void;
  onClear: () => void;
  pending: boolean;
}) {
  if (entries.length === 0) return null;
  const excluded = entries.filter((e) => !e.counted);
  const shown = showExcluded ? entries : entries.filter((e) => e.counted);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <History className="size-3.5" aria-hidden="true" />
          History
        </h4>
        <span className="text-[11px] text-muted-foreground">
          — every event, newest first.
        </span>
        <div className="ml-auto flex items-center gap-2">
          {excluded.length > 0 ? (
            <>
              <button type="button" onClick={onToggle} className="text-[11px] underline">
                {showExcluded ? "Hide" : "Show"} {excluded.length} excluded
              </button>
              <Button size="sm" variant="ghost" onClick={onClear} disabled={pending}>
                <Trash2 className="size-3.5" aria-hidden="true" />
                Clear mine
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No visitor events yet — only your own. Press “Show excluded” to see them.
        </p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {shown.map((e) => (
            <li
              key={e.id}
              className={`rounded-md border p-2 text-xs ${
                e.counted ? "border-border bg-background/40" : "border-dashed border-border bg-muted/20"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {e.reason === "you" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <UserCheck className="size-3" aria-hidden="true" /> you
                  </span>
                ) : e.reason === "automated" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <Bot className="size-3" aria-hidden="true" /> bot
                  </span>
                ) : null}
                <span className="text-foreground">
                  {VERB[e.type] ?? e.type}
                  {e.title ? ` “${e.title}”` : ""}
                  {e.kind === "booking" ? " (booking link)" : e.kind === "email" ? " (email)" : ""}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {new Date(e.at).toLocaleString()}
                </span>
              </div>
              {/* Only what the collector actually captured — no blanks, no guesses. */}
              {[
                e.where && `from ${e.where}`,
                e.org && e.org,
                e.device,
                e.ref && `via ${e.ref}`,
                e.role && `says: ${e.role}`,
                e.interest && `came for: ${e.interest}`,
              ].filter(Boolean).length > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {[
                    e.where && `from ${e.where}`,
                    e.org && e.org,
                    e.device,
                    e.ref && `via ${e.ref}`,
                    e.role && `says: ${e.role}`,
                    e.interest && `came for: ${e.interest}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
