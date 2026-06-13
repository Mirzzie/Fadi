"use client";

import { CornerDownLeft, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { DOCK_APPS } from "./dock";
import { useScout } from "./scout-presence";

/**
 * The OS command spotlight (⌘K / Ctrl+K). Two lanes: jump to any app, or just
 * say what you want in plain language and hand it to Scout — the same tool-calling
 * agent answers, so there's no second brain to maintain. Opened by the shortcut
 * or the menu-bar affordance (which fires the `scout:command` event).
 */
export function CommandBar() {
  const router = useRouter();
  const { openWithQuery } = useScout();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open on ⌘K / Ctrl+K, or the menu-bar trigger event. Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function onTrigger() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("scout:command", onTrigger);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scout:command", onTrigger);
    };
  }, []);

  // Reset + focus each time it opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Focus after the overlay paints.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const apps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOCK_APPS;
    return DOCK_APPS.filter((a) => a.label.toLowerCase().includes(q));
  }, [query]);

  const hasQuery = query.trim().length > 0;
  // Row 0 is always "Ask Scout" when there's a query; app rows follow.
  const rows = hasQuery ? 1 + apps.length : apps.length;

  function run(index: number) {
    if (hasQuery && index === 0) {
      openWithQuery(query);
      setOpen(false);
      return;
    }
    const app = apps[hasQuery ? index - 1 : index];
    if (app) {
      router.push(app.href);
      setOpen(false);
    }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % Math.max(rows, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + Math.max(rows, 1)) % Math.max(rows, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(active);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center px-4 pt-[14vh]">
      <button
        type="button"
        aria-label="Close command bar"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border/60 bg-popover/95 shadow-2xl backdrop-blur-xl duration-200 animate-in fade-in slide-in-from-top-2">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Search apps, or ask Scout anything…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[0.65rem] text-muted-foreground sm:inline">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {hasQuery ? (
            <Row
              active={active === 0}
              onMouseEnter={() => setActive(0)}
              onClick={() => run(0)}
              icon={<Sparkles className="size-4 text-primary" aria-hidden="true" />}
              title={`Ask Scout: “${query.trim()}”`}
              hint="Enter"
              emphasis
            />
          ) : (
            <p className="px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Apps
            </p>
          )}

          {apps.map((app, i) => {
            const index = hasQuery ? i + 1 : i;
            return (
              <Row
                key={app.href}
                active={active === index}
                onMouseEnter={() => setActive(index)}
                onClick={() => run(index)}
                icon={<app.icon className="size-4 text-muted-foreground" aria-hidden="true" />}
                title={app.label}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({
  active,
  onClick,
  onMouseEnter,
  icon,
  title,
  hint,
  emphasis,
}: {
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  icon: React.ReactNode;
  title: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-foreground",
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border/60 bg-muted/40">
        {icon}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", emphasis && "font-medium")}>{title}</span>
      {hint ? (
        <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
          <CornerDownLeft className="size-3" aria-hidden="true" />
          {hint}
        </span>
      ) : null}
    </button>
  );
}
