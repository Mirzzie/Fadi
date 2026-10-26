"use client";

import { ChevronDown, FileStack } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { templatesForKind, type DocTemplate } from "@/lib/documents/doc-templates";
import type { DocKind } from "@/lib/jobs/application-types";

/** Keyboard, Escape, collision placement and focus use the shared menu primitive. */
export function DocTemplatePicker({
  kind,
  onPick,
  triggerRef,
}: {
  kind: DocKind;
  onPick: (template: DocTemplate) => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const templates = templatesForKind(kind);
  if (templates.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger ref={triggerRef} render={<Button variant="outline" size="sm" />}>
        <FileStack className="size-4" aria-hidden="true" /> Templates
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
        {templates.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => onPick(t)}
            className="flex-col items-start gap-1 py-2.5"
          >
            <span className="font-medium">{t.name}</span>
            <span className="text-xs text-muted-foreground">{t.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
