"use client";

import { useState, type ReactNode } from "react";
import { KanbanSquare, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Applications is now the single home for the whole apply flow: the pipeline board
 * AND the documents that belong to it. The Documents tab was merged in here because
 * the real workflow is one motion — paste a job description, create the application,
 * generate its documents — not a trip to a separate section.
 *
 * Slot pattern: the server page composes the two views (each a client component with
 * its own props) and passes them as `board` / `library`, so all the prop-threading
 * stays in the page and this only owns the toggle.
 */
export function ApplicationsTabs({ board, library }: { board: ReactNode; library: ReactNode }) {
  const [tab, setTab] = useState<"pipeline" | "documents">("pipeline");

  return (
    <div className="space-y-4">
      <div className="flex border-b border-border/80 text-sm">
        <TabButton active={tab === "pipeline"} onClick={() => setTab("pipeline")} icon={<KanbanSquare className="size-4" />}>
          Pipeline
        </TabButton>
        <TabButton active={tab === "documents"} onClick={() => setTab("documents")} icon={<FileText className="size-4" />}>
          Documents
        </TabButton>
      </div>

      <div className={tab === "pipeline" ? "block" : "hidden"}>{board}</div>
      <div className={tab === "documents" ? "block" : "hidden"}>{library}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-4 py-3 font-medium transition-colors",
        active
          ? "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
