"use client";

import { Loader2, Wand2 } from "lucide-react";
import { useState, useTransition } from "react";

import { setAutoPrepAction } from "@/app/dashboard/settings/actions";
import { cn } from "@/lib/utils";

/**
 * Opt-in switch for Kai auto-prep. When on, opening a role's workspace makes
 * Kai immediately draft the full packet (CV, cover letter, cold email, value
 * proposition). Off = the user drafts manually. Honest by default: off.
 */
export function AutoPrepToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    setMsg(null);
    startTransition(async () => {
      const res = await setAutoPrepAction(next);
      if (!res.ok) {
        setOn(!next); // revert on failure
      }
      setMsg(res.message);
    });
  }

  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)]">
          <Wand2 className="size-5 text-primary-foreground" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Kai auto-prep</h2>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label="Toggle Kai auto-prep"
              disabled={pending}
              onClick={toggle}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
                on ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "inline-block size-5 transform rounded-full bg-background shadow transition-transform",
                  on ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            When you open a role, Kai immediately drafts your full packet — tailored CV, cover
            letter, cold email, and value proposition — grounded in your real experience. Leave it
            off to draft each document yourself, when you want.
          </p>
          {msg ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              {pending ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
              {msg}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
