"use client";

import { useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Progressive disclosure for the workspace tools (Hick's law: every visible
 * option adds decision time). Each tool collapses to one self-describing row —
 * one click away, zero visual weight until asked for. Status/alerts and the
 * document list stay outside this wrapper: information isn't a choice.
 */
export function WorkspaceSection({
  icon: Icon,
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** One honest line on what this tool does — shown in the collapsed row. */
  hint: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
      >
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="text-sm font-semibold">{title}</span>
          {!open ? (
            <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{hint}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open ? <div className="border-t px-1 pb-1 pt-0 [&>div]:border-0">{children}</div> : null}
    </div>
  );
}
