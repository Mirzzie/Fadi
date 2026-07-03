"use client";

import { Bell, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useFadi } from "./fadi-presence";

type Finding = {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  href: string | null;
  seen: boolean;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  new_role: "New role",
  expired_saved_role: "Heads up",
  market_signal: "Market signal",
  world_shift: "World shift",
  off_track: "A pattern Fadi noticed",
  learning_pending: "Your commitment",
};

/**
 * OS-native notification center — the auditable feed of what the background agency
 * actually did (agent_findings). The bell shows an unseen count; opening it marks
 * them seen. The freshest unseen finding also becomes the orb's proactive nudge,
 * so Fadi surfaces it without being asked.
 */
export function ActivityCenter() {
  const { showNudge, dismissNudge } = useFadi();
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [unseen, setUnseen] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const nudgedFor = useRef<string | null>(null);

  // Pull the feed; the freshest unseen finding becomes the orb nudge. The OS
  // shell persists across navigations, so we also refresh when the user returns
  // to the tab — otherwise the bell would freeze at its mount-time value while
  // the background agency keeps logging findings.
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fadi/activity");
      if (!res.ok) return;
      const data = (await res.json()) as { unseenCount: number; findings: Finding[] };
      setFindings(data.findings);
      setUnseen(data.unseenCount);

      const topUnseen = data.findings.find((f) => !f.seen);
      if (topUnseen && nudgedFor.current !== topUnseen.id) {
        nudgedFor.current = topUnseen.id;
        showNudge({
          label: KIND_LABEL[topUnseen.kind] ?? "While you were away",
          detail: topUnseen.title,
          href: topUnseen.href ?? "/dashboard",
        });
      }
    } catch {
      /* a quiet bell is fine on failure */
    }
  }, [showNudge]);

  useEffect(() => {
    void load();
    function onFocus() {
      if (document.visibilityState === "visible") void load();
    }
    window.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markSeen = useCallback(() => {
    if (unseen === 0) return;
    setUnseen(0);
    setFindings((prev) => prev.map((f) => ({ ...f, seen: true })));
    dismissNudge();
    nudgedFor.current = null;
    void fetch("/api/fadi/activity", { method: "POST" });
  }, [unseen, dismissNudge]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) markSeen();
  }

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unseen > 0 ? `Activity — ${unseen} new` : "Activity"}
        className={cn(
          "relative grid size-7 place-items-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground transition-colors hover:text-foreground",
          open && "text-foreground ring-1 ring-inset ring-primary/30",
        )}
      >
        <Bell className="size-3.5" aria-hidden="true" />
        {unseen > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[0.55rem] font-semibold leading-3.5 text-primary-foreground">
            {unseen > 9 ? "9+" : unseen}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-xl border border-border/70 bg-card/95 text-sm shadow-xl backdrop-blur-md duration-150 animate-in fade-in slide-in-from-top-1"
        >
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold">Fadi activity</span>
          </div>
          {findings.length > 0 ? (
            <ul className="max-h-80 divide-y divide-border/40 overflow-y-auto">
              {findings.map((f) => {
                const body = (
                  <>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                      {KIND_LABEL[f.kind] ?? f.kind}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-foreground">{f.title}</p>
                    {f.detail ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{f.detail}</p>
                    ) : null}
                    <p className="mt-1 text-[0.65rem] text-muted-foreground/70">{relativeTime(f.createdAt)}</p>
                  </>
                );
                return (
                  <li key={f.id}>
                    {f.href ? (
                      <Link
                        href={f.href}
                        onClick={() => setOpen(false)}
                        className="block px-3 py-2.5 transition-colors hover:bg-muted/50"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="px-3 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nothing yet. Fadi will log what it finds while you&apos;re away.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Compact relative time ("3h ago") — good enough for a glanceable feed. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
