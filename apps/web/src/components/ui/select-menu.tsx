"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };
export type SelectGroup = { label?: string; options: SelectOption[] };

// A Fadi-styled dropdown to replace bare native <select> (which renders with OS chrome that
// breaks the dark theme). Matches the app's menu aesthetic (rounded-xl, bg-card/95,
// backdrop-blur) and supports option groups. Closes on outside-click and Escape.
export function SelectMenu({
  value,
  onChange,
  groups,
  ariaLabel,
  title,
  className,
  menuClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  groups: SelectGroup[];
  ariaLabel: string;
  title?: string;
  className?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = groups.flatMap((g) => g.options).find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={title}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 items-center justify-between gap-1.5 rounded-md border border-border bg-background px-2 text-xs outline-none transition-colors hover:border-primary/40 focus:border-primary/40",
          className,
        )}
      >
        <span className="truncate">{current?.label ?? ""}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "absolute left-0 top-9 z-50 max-h-72 w-44 overflow-y-auto rounded-xl border border-border/70 bg-card/95 p-1 text-xs shadow-xl backdrop-blur-md",
            menuClassName,
          )}
        >
          {groups.map((g, gi) => (
            <div key={g.label ?? gi}>
              {g.label ? (
                <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </div>
              ) : null}
              {g.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-muted",
                    o.value === value && "bg-primary/10 font-medium text-primary",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
