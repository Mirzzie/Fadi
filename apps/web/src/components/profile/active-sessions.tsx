"use client";

import { Loader2, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

type SessionRow = {
  id: string;
  token: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** Pull a friendly device/browser label out of a raw user-agent string. */
function deviceLabel(ua?: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Firefox/.test(ua)
        ? "Firefox"
        : /Safari/.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iOS/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

/**
 * Active sessions — see every device signed into this account and revoke them.
 * Lets a user kill a forgotten or compromised session without changing their
 * password. The current session is marked and never individually revoked here.
 */
export function ActiveSessions() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [list, current] = await Promise.all([
      authClient.listSessions(),
      authClient.getSession(),
    ]);
    if (list.error) {
      setError("Couldn't load your sessions.");
      setSessions([]);
      return;
    }
    setCurrentToken(current.data?.session?.token ?? null);
    setSessions((list.data ?? []) as SessionRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revokeOne(token: string) {
    setBusy(token);
    await authClient.revokeSession({ token });
    setBusy(null);
    await load();
  }

  async function revokeOthers() {
    setBusy("others");
    await authClient.revokeOtherSessions();
    setBusy(null);
    await load();
  }

  const others = (sessions ?? []).filter((s) => s.token !== currentToken);

  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
          <ShieldCheck className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold tracking-tight">Active sessions</h3>
            {others.length > 0 ? (
              <Button variant="outline" size="sm" onClick={revokeOthers} disabled={busy === "others"}>
                {busy === "others" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Sign out other devices
              </Button>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Devices currently signed into your account. Revoke any you don&apos;t recognize.
          </p>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <ul className="mt-4 space-y-2">
            {sessions === null ? (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading…
              </li>
            ) : sessions.length === 0 ? (
              <li className="text-sm text-muted-foreground">No active sessions found.</li>
            ) : (
              sessions.map((s) => {
                const isCurrent = s.token === currentToken;
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <MonitorSmartphone className="size-4 text-muted-foreground" aria-hidden="true" />
                      <div className="text-sm">
                        <p className="font-medium">
                          {deviceLabel(s.userAgent)}
                          {isCurrent ? (
                            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                              This device
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.ipAddress ? `${s.ipAddress} · ` : ""}
                          since {new Date(s.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {!isCurrent ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeOne(s.token)}
                        disabled={busy === s.token}
                      >
                        {busy === s.token ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Revoke"}
                      </Button>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
