"use client";

import { Loader2, Play, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { resolveIntentAction, startPlanAction } from "@/app/dashboard/work-actions";
import { NAV_TARGETS } from "./navigation";
import { useFadi } from "./fadi-presence";

/**
 * The OS command spotlight (⌘K / Ctrl+K). Three lanes, in the order they matter:
 *
 * 1. START — when the words name work Fadi knows how to do AND the thing to do it on ("apply
 *    to the Deerfoot role"), it offers to start the plan, with the target named back first. A
 *    bar that says "starting…" and picks the wrong posting is worse than one that asks which.
 * 2. GO — jump to any area.
 * 3. ASK — hand it to Fadi, because a question is still a question.
 *
 * Lane 1 is what makes this an orchestrator rather than a search box: work begins by saying
 * what you want, not by finding the button someone filed it under.
 *
 * Built on the cmdk `command` primitive (via CommandDialog): keyboard nav, focus
 * management, Esc and the portal come for free — this was all hand-rolled before.
 * We keep our own filtering (`shouldFilter={false}`) so the "Ask Fadi" lane always
 * stays visible while a query narrows the app list.
 */
export function CommandBar() {
  const router = useRouter();
  const { openWithQuery } = useFadi();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState<{
    label: string;
    template: string;
    refs: { type: string; id: string }[];
  } | null>(null);
  const [starting, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  // Open on ⌘K / Ctrl+K, or the menu-bar trigger event. (Esc is handled by the dialog.)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onTrigger() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("fadi:command", onTrigger);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("fadi:command", onTrigger);
    };
  }, []);

  // Fresh query each time it opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setIntent(null);
      setNotice(null);
    }
  }, [open]);

  // Ask the server what these words would start, as they are typed. Read-only — it resolves and
  // names a target, and nothing happens until the person presses.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 4) {
      setIntent(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      void resolveIntentAction(text)
        .then((found) => {
          if (live) setIntent(found);
        })
        .catch(() => {
          if (live) setIntent(null);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const q = query.trim().toLowerCase();
  const apps = useMemo(
    () =>
      q
        ? NAV_TARGETS.filter(
            (target) =>
              target.label.toLowerCase().includes(q) || target.within.toLowerCase().includes(q)
          )
        : NAV_TARGETS,
    [q]
  );
  const hasQuery = query.trim().length > 0;

  function askFadi() {
    openWithQuery(query);
    setOpen(false);
  }
  function goApp(href: string) {
    router.push(href);
    setOpen(false);
  }
  function start() {
    if (!intent) return;
    setNotice(null);
    startTransition(async () => {
      const started = await startPlanAction(intent.template, intent.refs);
      if (!started.ok) {
        setNotice(started.error);
        return;
      }
      setOpen(false);
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command bar"
      description="Search Fadi, or ask it anything"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search Fadi, or ask it anything…"
        />
        <CommandList>
          {intent ? (
            <CommandGroup heading="Start this">
              <CommandItem value="__start-plan" onSelect={start} disabled={starting}>
                {starting ? (
                  <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                ) : (
                  <Play className="size-4 text-primary" aria-hidden="true" />
                )}
                <span className="font-medium">{intent.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  Fadi plans it, you approve each step
                </span>
              </CommandItem>
            </CommandGroup>
          ) : null}

          {notice ? (
            <p className="px-3 py-2 text-sm text-destructive" role="status">
              {notice}
            </p>
          ) : null}

          {hasQuery ? (
            <CommandGroup heading="Ask Fadi">
              <CommandItem value="__ask-fadi" onSelect={askFadi}>
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                <span className="font-medium">Ask Fadi: “{query.trim()}”</span>
              </CommandItem>
            </CommandGroup>
          ) : null}

          <CommandGroup heading="Go to">
            {apps.map((app) => (
              <CommandItem key={app.href} value={app.href} onSelect={() => goApp(app.href)}>
                <app.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                {app.label}
                <span className="ml-auto text-xs text-muted-foreground">{app.within}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {hasQuery && apps.length === 0 ? (
            <CommandEmpty>Nothing matches — press Enter to ask Fadi.</CommandEmpty>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
