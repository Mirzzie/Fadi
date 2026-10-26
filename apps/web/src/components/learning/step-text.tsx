"use client";

import { useState } from "react";
import { Check, Copy, Keyboard } from "lucide-react";

import { parseInstruction, type InlinePart } from "@/lib/learning/instruction-blocks";
import { typeIntoLab, useCanTypeIntoLab } from "@/lib/learning/lab-typing";

/**
 * A step's text with its commands pulled out into blocks you can copy in one click.
 * Everything renders as text nodes — see instruction-blocks.ts for why that matters.
 */
export function StepText({
  text,
  className,
  typeable = true,
  hideCommands = false,
  commandsOnly = false,
}: {
  text: string;
  className?: string;
  /** False for steps that happen outside the lab: their commands are not typed into it. */
  typeable?: boolean;
  /** The words only: Fadi runs this step's commands, so they aren't the person's to relay. */
  hideCommands?: boolean;
  /** The commands only — the manual mode under "Other ways". */
  commandsOnly?: boolean;
}) {
  const blocks = parseInstruction(text).filter((block) =>
    hideCommands ? block.type !== "code" : commandsOnly ? block.type === "code" : true
  );
  return (
    <div className={className ?? "space-y-3 text-sm leading-relaxed text-muted-foreground"}>
      {blocks.map((block, index) =>
        block.type === "code" ? (
          <CommandBlock key={index} code={block.code} lang={block.lang} typeable={typeable} />
        ) : (
          <p key={index} className="whitespace-pre-line">
            <Inline parts={block.parts} />
          </p>
        )
      )}
    </div>
  );
}

function Inline({ parts }: { parts: InlinePart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.type === "code" ? (
          <code
            key={index}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
          >
            {part.value}
          </code>
        ) : part.type === "bold" ? (
          <strong key={index} className="font-semibold text-foreground">
            {part.value}
          </strong>
        ) : (
          <span key={index}>{part.value}</span>
        )
      )}
    </>
  );
}

export function CommandBlock({
  code,
  lang,
  typeable = true,
}: {
  code: string;
  lang: string | null;
  typeable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [typed, setTyped] = useState(false);
  const canType = useCanTypeIntoLab() && typeable;

  function type() {
    if (!typeIntoLab(code)) return;
    setTyped(true);
    setTimeout(() => setTyped(false), 1500);
  }

  async function copy() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-muted text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-1">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {lang ?? "command"}
        </span>
        <span className="flex items-center gap-1">
          {canType ? (
            <button
              type="button"
              onClick={type}
              className="flex min-h-10 items-center gap-1 rounded px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              title="Types it into the machine's window that has focus. It does not press Enter."
            >
              {typed ? (
                <>
                  <Check className="size-3 text-success" aria-hidden="true" /> Typed
                </>
              ) : (
                <>
                  <Keyboard className="size-3" aria-hidden="true" /> Type into lab
                </>
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={copy}
            className="flex min-h-10 items-center gap-1 rounded px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={copied ? "Copied" : "Copy command"}
          >
            {copied ? (
              <>
                <Check className="size-3 text-success" aria-hidden="true" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-3" aria-hidden="true" /> Copy
              </>
            )}
          </button>
        </span>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
      {copyError ? (
        <p role="status" className="px-3 pb-3 text-sm text-destructive">
          Clipboard access was refused. Select the command text and copy it manually.
        </p>
      ) : null}
    </div>
  );
}
