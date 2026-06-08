"use client";

import { ChevronDown, FileStack } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { templatesForKind, type DocTemplate } from "@/lib/documents/doc-templates";
import type { DocKind } from "@/lib/jobs/application-types";

/**
 * Insert a ready-made, recruiter-grounded starter template into a prose
 * document so the user begins from a proven structure, not a blank page.
 */
export function DocTemplatePicker({
  kind,
  onPick,
}: {
  kind: DocKind;
  onPick: (template: DocTemplate) => void;
}) {
  const templates = templatesForKind(kind);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (templates.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <FileStack className="size-4" aria-hidden="true" />
        Templates
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-9 z-50 w-72 overflow-hidden rounded-xl border border-border/70 bg-card/95 p-1 text-sm shadow-xl backdrop-blur-md"
        >
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onPick(t);
                setOpen(false);
              }}
              className="block w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
            >
              <span className="font-medium">{t.name}</span>
              <span className="block text-xs text-muted-foreground">{t.description}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
