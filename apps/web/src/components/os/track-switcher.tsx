"use client";

import { Check, ChevronDown, Compass, Loader2, Plus, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createTrackAction,
  listTracksAction,
  switchTrackAction,
  type TrackSummary,
} from "@/app/dashboard/tracks/actions";

const INTENTS: Array<{ value: string; label: string; hint: string }> = [
  { value: "career", label: "Career change / main goal", hint: "A direction you're committing to." },
  { value: "exploration", label: "Exploring — cast a wide net", hint: "Any role in a space (great for freshers)." },
  { value: "trial", label: "Trial — testing if it fits", hint: "Sample a field before committing." },
  { value: "part_time", label: "Part-time / gig / side income", hint: "Non-mainstream, student-abroad, freelance." },
];

// Domain-agnostic on purpose — FadiOS serves every industry, not just tech.
const DOMAINS = [
  "Information Technology", "Cybersecurity", "Software Development", "Data & Analytics",
  "Finance", "Accounting", "Banking", "Marketing", "Sales", "Healthcare", "Nursing",
  "Education", "Engineering", "Design / UX", "Legal", "Human Resources", "Operations",
  "Customer Support", "Hospitality", "Construction & Trades", "Logistics", "Science / Research",
];

const EXPERIENCE = ["student", "entry", "junior", "mid", "senior", "lead"];

function intentMeta(intent: string) {
  return INTENTS.find((i) => i.value === intent);
}

export function TrackSwitcher() {
  const router = useRouter();
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  const active = tracks.find((t) => t.isActive) ?? tracks[0] ?? null;

  async function reload() {
    setTracks(await listTracksAction());
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function switchTo(id: string) {
    if (id === active?.id) return setOpen(false);
    startTransition(async () => {
      const res = await switchTrackAction(id);
      if (res.ok) {
        await reload();
        router.refresh();
      }
      setOpen(false);
    });
  }

  // No tracks yet (pre-onboarding) → render nothing.
  if (tracks.length === 0 && !showNew) {
    return null;
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[12rem] items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-muted"
        title="Switch career track"
      >
        <Target className="size-3 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate">{active?.label ?? "Career track"}</span>
        {pending ? (
          <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-1 shadow-xl backdrop-blur-md duration-150 animate-in fade-in slide-in-from-top-1">
          <p className="px-2.5 py-1.5 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            Your career tracks
          </p>
          <ul className="max-h-72 overflow-y-auto">
            {tracks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => switchTo(t.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted",
                    t.isActive && "bg-primary/10",
                  )}
                >
                  <span className="mt-0.5 shrink-0">
                    {t.isActive ? (
                      <Check className="size-3.5 text-primary" aria-hidden="true" />
                    ) : (
                      <Compass className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.label}</span>
                    <span className="block truncate text-[0.7rem] text-muted-foreground">
                      {[t.domain, intentMeta(t.intent)?.label].filter(Boolean).join(" · ") ||
                        t.targetRole}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-border/60 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowNew(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              New direction…
            </button>
          </div>
        </div>
      ) : null}

      {showNew ? (
        <NewDirectionModal
          onClose={() => setShowNew(false)}
          onCreated={async () => {
            setShowNew(false);
            await reload();
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function NewDirectionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [intent, setIntent] = useState("career");
  const [label, setLabel] = useState("");
  const [domain, setDomain] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [roleCluster, setRoleCluster] = useState("");
  const [location, setLocation] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("mid");
  const [careerGoal, setCareerGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isExploration = intent === "exploration";

  function submit() {
    setError(null);
    startTransition(async () => {
      const cluster = isExploration
        ? roleCluster
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      const res = await createTrackAction({
        label,
        targetRole,
        domain: domain || undefined,
        intent: intent as "career" | "exploration" | "trial" | "part_time",
        careerGoal,
        location: location || undefined,
        experienceLevel,
        roleCluster: cluster,
      });
      if (!res.ok) {
        setError(res.message ?? "Couldn't create the track.");
        return;
      }
      await onCreated();
    });
  }

  // Portal to <body>: the menu bar's backdrop-blur creates a containing block, so
  // a `fixed` overlay rendered inside it would be positioned relative to the 36px
  // bar (pinned to the top, clipped) instead of the viewport.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm duration-150 animate-in fade-in"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-sm shadow-2xl duration-200 animate-in fade-in zoom-in-95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-border/60 bg-gradient-to-br from-primary/10 to-transparent px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight">Start a new direction</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tell me where you&apos;re headed — branch of your field or a whole new one — and I&apos;ll
            spin up a fresh track with its own jobs, documents, and plan.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <Label>What kind of move is this?</Label>
            <div className="grid gap-1.5">
              {INTENTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIntent(opt.value)}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                    intent === opt.value
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/60 hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1 size-2 shrink-0 rounded-full",
                      intent === opt.value ? "bg-primary" : "bg-muted-foreground/40",
                    )}
                  />
                  <span>
                    <span className="block font-medium">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="track-label">Name this track</Label>
              <Input
                id="track-label"
                placeholder="Break into Cybersecurity"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="track-domain">Field / industry</Label>
              <Input
                id="track-domain"
                list="track-domains"
                placeholder="Finance, Healthcare, IT…"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <datalist id="track-domains">
                {DOMAINS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="track-role">
              {isExploration ? "Primary role (the anchor)" : "Target role"}
            </Label>
            <Input
              id="track-role"
              placeholder={isExploration ? "Any entry-level IT role" : "Financial Analyst"}
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </div>

          {isExploration ? (
            <div className="space-y-1.5">
              <Label htmlFor="track-cluster">Roles to cast a net across</Label>
              <Textarea
                id="track-cluster"
                rows={2}
                placeholder="IT Support, SOC Analyst, Junior Security Engineer"
                value={roleCluster}
                onChange={(e) => setRoleCluster(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma or line separated. Fadi ranks across all of them.
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="track-location">Location preference</Label>
              <Input
                id="track-location"
                placeholder="Dublin, Ireland / Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="track-exp">Experience level</Label>
              <select
                id="track-exp"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {EXPERIENCE.map((x) => (
                  <option key={x} value={x} className="bg-background">
                    {x}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="track-goal">What do you want from this direction?</Label>
            <Textarea
              id="track-goal"
              rows={3}
              placeholder="Land a junior SOC role within 6 months while keeping my current job; build 2 home-lab projects and earn Security+."
              value={careerGoal}
              onChange={(e) => setCareerGoal(e.target.value)}
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 px-5 py-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Create track
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
