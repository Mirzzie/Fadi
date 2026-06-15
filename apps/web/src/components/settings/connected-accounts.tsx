"use client";

import { Check, Link2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

type Provider = "google" | "linkedin";

const META: Record<Provider, { label: string; icon: React.ReactNode }> = {
  google: {
    label: "Google",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.44.35-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
      </svg>
    ),
  },
  linkedin: {
    label: "LinkedIn",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="#0A66C2" aria-hidden="true">
        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45z" />
      </svg>
    ),
  },
};

/**
 * Connect a social login to the signed-in account (e.g. an email signup later
 * linking LinkedIn). Honest: this is for SIGN-IN only — LinkedIn OAuth returns
 * just name/email/picture, so a user's career history still comes from the
 * LinkedIn paste / "Save to PDF" import on the Profile page.
 */
export function ConnectedAccounts({ providers }: { providers: Provider[] }) {
  const [linked, setLinked] = useState<Set<string> | null>(null);
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authClient.listAccounts();
        const items = (res?.data ?? []) as Array<{ providerId?: string; provider?: string }>;
        if (!cancelled) {
          setLinked(new Set(items.map((a) => a.providerId ?? a.provider ?? "").filter(Boolean)));
        }
      } catch {
        if (!cancelled) setLinked(new Set()); // degrade to "Connect" rather than block
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function connect(provider: Provider) {
    setPending(provider);
    setError(null);
    try {
      // Navigates to the provider; on return the page reloads with the new link.
      await authClient.linkSocial({ provider, callbackURL: "/dashboard/settings" });
    } catch {
      setError(`Couldn't start the ${META[provider].label} connection. Try again.`);
      setPending(null);
    }
  }

  async function disconnect(provider: Provider) {
    setPending(provider);
    setError(null);
    try {
      await authClient.unlinkAccount({ providerId: provider });
      setLinked((prev) => {
        const next = new Set(prev);
        next.delete(provider);
        return next;
      });
    } catch {
      setError(`Couldn't disconnect ${META[provider].label}. You may need another sign-in method first.`);
    }
    setPending(null);
  }

  if (providers.length === 0) return null;

  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Link2 className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Connected accounts</h2>
          <p className="text-xs text-muted-foreground">Sign in faster with a linked provider.</p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-border/60">
        {providers.map((provider) => {
          const isLinked = linked?.has(provider) ?? false;
          const busy = pending === provider;
          return (
            <li key={provider} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-md border border-border/60 bg-background">
                  {META[provider].icon}
                </span>
                <div>
                  <p className="text-sm font-medium">{META[provider].label}</p>
                  <p className="text-xs text-muted-foreground">
                    {linked === null ? "Checking…" : isLinked ? "Connected" : "Not connected"}
                  </p>
                </div>
              </div>
              {isLinked ? (
                <button
                  type="button"
                  onClick={() => disconnect(provider)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5 text-emerald-500" aria-hidden="true" />}
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => connect(provider)}
                  disabled={busy || linked === null}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50",
                  )}
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                  Connect
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {providers.includes("linkedin") ? (
        <p className="mt-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Connecting LinkedIn is for sign-in only — it shares your name, email, and photo, not your
          work history. Your career source of truth still comes from the LinkedIn paste / PDF import
          on your <span className="font-medium text-foreground">Profile</span>.
        </p>
      ) : null}
    </section>
  );
}
