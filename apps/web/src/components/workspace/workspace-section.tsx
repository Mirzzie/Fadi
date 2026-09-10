"use client";

import { useState } from "react";
import {
  Building2,
  ChevronDown,
  ClipboardCheck,
  Flag,
  Gauge,
  ListOrdered,
  MessageSquareQuote,
  PenLine,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Icons are mapped from string keys INSIDE this client component — a component
 * (function) can't be passed across the server→client boundary as a prop.
 */
const ICONS: Record<string, LucideIcon> = {
  fit: Gauge,
  quality: ClipboardCheck,
  redpen: PenLine,
  interview: MessageSquareQuote,
  company: Building2,
  outcome: Flag,
  lead: ListOrdered,
};

export type WorkspaceSectionIcon = keyof typeof ICONS;

/**
 * Progressive disclosure for the workspace tools (Hick's law: every visible
 * option adds decision time). Each tool collapses to one self-describing row —
 * one click away, zero visual weight until asked for. Status/alerts and the
 * document list stay outside this wrapper: information isn't a choice.
 */
export function WorkspaceSection({
  icon,
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  icon: WorkspaceSectionIcon;
  title: string;
  /** One honest line on what this tool does — shown in the collapsed row. */
  hint: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = ICONS[icon] ?? Gauge;

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
