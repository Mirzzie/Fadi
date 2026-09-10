"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  grantCapability,
  listPermissions,
  revokeAllCapabilities,
  revokeCapability,
  type ActionView,
  type CapabilityView,
} from "@/app/dashboard/learning/permission-actions";

/**
 * MACHINE ACCESS — what Fadi may do here, and what it actually did.
 *
 * The user's position was right: refusing local access is not a security posture, it is
 * an unfinished feature. So access is permitted, scoped and WATCHED, and this panel is
 * the watching half.
 *
 * It leads with denials rather than successes. Successes are mostly the user's own work
 * coming back at them; a cluster of blocked attempts nobody initiated is the shape of a
 * model that read something it should not have believed. A monitor that buries that
 * under a chronological feed is decoration.
 */

function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const mins = Math.round(ms / 60_000);
  return mins >= 60 ? Math.round(mins / 60) + "h left" : mins + "m left";
}

const ACTOR_LABEL: Record<string, string> = {
  user: "you",
  model: "the AI model",
  mcp: "an MCP client",
  agent: "a background agent",
};

export function MachineAccess() {
  const [caps, setCaps] = useState<CapabilityView[] | null>(null);
  const [recent, setRecent] = useState<ActionView[]>([]);
  const [pending, start] = useTransition();

  const refresh = useCallback(() => {
    start(async () => {
      const res = await listPermissions();
      if (res.ok) {
        setCaps(res.capabilities ?? []);
        setRecent(res.recent ?? []);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
    // Real-time enough to matter: a grant that expired or an attempt made while the page
    // was open should not need a reload to become visible. Polling, not a socket — the
    // truth lives in Postgres and this is a single-user machine.
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!caps) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> loading machine access…
      </p>
    );
  }

  const live = caps.filter((c) => c.grantedUntil);
  const denials = recent.filter((a) => a.decision === "denied");

  return (
    <section className="space-y-4 rounded-lg border border-border/60 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Machine access
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {live.length === 0
            ? "Nothing is allowed right now."
            : live.length + " capability" + (live.length === 1 ? "" : " capabilities") + " allowed"}
        </span>
        {live.length > 0 ? (
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto"
            disabled={pending}
            onClick={() => start(async () => { await revokeAllCapabilities(); refresh(); })}
          >
            <ShieldOff className="size-3.5" aria-hidden="true" />
            Revoke everything
          </Button>
        ) : null}
      </header>

      {/*
        Denials first. If something asked for what it was never given, that is the one
        thing on this page worth reading, and it should not require scrolling a log to
        find.
      */}
      {denials.length > 0 ? (
        <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <AlertTriangle className="size-3.5 text-amber-600" aria-hidden="true" />
            {denials.length} blocked attempt{denials.length === 1 ? "" : "s"}
          </p>
          {denials.slice(0, 5).map((d) => (
            <p key={d.id} className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{ACTOR_LABEL[d.actor] ?? d.actor}</span> asked
              for <code className="text-[10px]">{d.capability}</code>
              {d.origin ? " via " + d.origin : ""} — {d.detail ?? "denied"}
            </p>
          ))}
          <p className="text-[10px] text-muted-foreground">
            Blocked means nothing ran. If you did not start these, revoke everything and look at what
            Fadi last read.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        {caps.map((c) => {
          const left = timeLeft(c.grantedUntil);
          return (
            <div key={c.capability} className="flex flex-wrap items-start gap-2 rounded-md border border-border/60 p-2.5">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-medium">{c.summary}</p>
                <p className="text-[11px] text-muted-foreground">{c.limit}</p>
              </div>
              {left ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-emerald-600">Allowed · {left}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await revokeCapability({ capability: c.capability });
                        refresh();
                      })
                    }
                  >
                    Revoke
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await grantCapability({ capability: c.capability });
                      refresh();
                    })
                  }
                >
                  Allow
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <details className="text-[11px]">
        <summary className="cursor-pointer text-muted-foreground">
          Everything Fadi tried on this machine ({recent.length})
        </summary>
        <ul className="mt-2 space-y-1">
          {recent.length === 0 ? (
            <li className="text-muted-foreground">Nothing yet.</li>
          ) : (
            recent.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-1.5">
                <span
                  className={
                    a.decision === "denied"
                      ? "text-amber-600"
                      : a.decision === "error"
                        ? "text-muted-foreground"
                        : "text-emerald-600"
                  }
                >
                  {a.decision}
                </span>
                <span className="text-muted-foreground">{ACTOR_LABEL[a.actor] ?? a.actor}</span>
                {/* The exact argv, so "what did it actually run" is answerable, not inferred. */}
                <code className="text-[10px]">{a.command ?? a.capability}</code>
                <span className="ml-auto text-muted-foreground">
                  {new Date(a.at).toLocaleTimeString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </details>
    </section>
  );
}
