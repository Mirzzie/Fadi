"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DOCK_APPS } from "./dock";
import { useFadi } from "./fadi-presence";

/**
 * The OS command spotlight (⌘K / Ctrl+K). Two lanes: jump to any app, or just
 * say what you want in plain language and hand it to Fadi — the same tool-calling
 * agent answers, so there's no second brain to maintain. Opened by the shortcut
 * or the menu-bar affordance (which fires the `fadi:command` event).
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
    if (open) setQuery("");
  }, [open]);

  const q = query.trim().toLowerCase();
  const apps = useMemo(
    () => (q ? DOCK_APPS.filter((a) => a.label.toLowerCase().includes(q)) : DOCK_APPS),
    [q],
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

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command bar"
      description="Search apps, or ask Fadi anything"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search apps, or ask Fadi anything…"
        />
        <CommandList>
          {hasQuery ? (
            <CommandGroup heading="Ask Fadi">
              <CommandItem value="__ask-fadi" onSelect={askFadi}>
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                <span className="font-medium">Ask Fadi: “{query.trim()}”</span>
              </CommandItem>
            </CommandGroup>
          ) : null}

          <CommandGroup heading="Apps">
            {apps.map((app) => (
              <CommandItem key={app.href} value={app.href} onSelect={() => goApp(app.href)}>
                <app.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                {app.label}
              </CommandItem>
            ))}
          </CommandGroup>

          {hasQuery && apps.length === 0 ? (
            <CommandEmpty>No apps match — press Enter to ask Fadi.</CommandEmpty>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
