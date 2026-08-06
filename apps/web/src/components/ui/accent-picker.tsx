"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// Compact accent-colour picker matching Fadi's menu aesthetic: a trigger showing the current
// colour + a swatch popover (with a "default" option that keeps the template's own colour).
export function AccentPicker({
  value,
  onChange,
  presets,
  ariaLabel = "Accent colour",
}: {
  value?: string;
  onChange: (hex: string | undefined) => void;
  presets: { label: string; hex: string }[];
  ariaLabel?: string;
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

  const isSelected = (hex: string) => value?.toLowerCase() === hex.toLowerCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs outline-none transition-colors hover:border-primary/40"
      >
        <span
          className="size-3.5 rounded-full border border-black/20"
          style={
            value
              ? { backgroundColor: value }
              : { backgroundImage: "conic-gradient(#f87171,#fbbf24,#34d399,#60a5fa,#a78bfa,#f87171)" }
          }
        />
        Accent
      </button>
      {open ? (
        <div className="absolute left-0 top-9 z-50 w-40 rounded-xl border border-border/70 bg-card/95 p-2 shadow-xl backdrop-blur-md">
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              aria-label="Default (template colour)"
              title="Default"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className={cn(
                "grid size-7 place-items-center rounded-full border border-border bg-background text-[10px] font-semibold text-muted-foreground",
                !value && "ring-2 ring-primary ring-offset-1 ring-offset-card",
              )}
            >
              A
            </button>
            {presets.map((p) => (
              <button
                key={p.hex}
                type="button"
                aria-label={p.label}
                title={p.label}
                onClick={() => {
                  onChange(p.hex);
                  setOpen(false);
                }}
                className={cn(
                  "grid size-7 place-items-center rounded-full border border-black/10",
                  isSelected(p.hex) && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                )}
                style={{ backgroundColor: p.hex }}
              >
                {isSelected(p.hex) ? <Check className="size-3.5 text-white" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
