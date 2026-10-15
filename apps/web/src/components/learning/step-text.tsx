"use client";

import { useState } from "react";
import { Check, Copy, Keyboard } from "lucide-react";

import { parseInstruction, type InlinePart } from "@/lib/learning/instruction-blocks";
import { typeIntoLab, useCanTypeIntoLab } from "@/lib/learning/lab-typing";

/**
 * A step's text with its commands pulled out into blocks you can copy in one click.
 * Everything renders as text nodes — see instruction-blocks.ts for why that matters.
 */
export function StepText({ text, className }: { text: string; className?: string }) {
  const blocks = parseInstruction(text);
  return (
    <div className={className ?? "space-y-3 text-sm leading-relaxed text-muted-foreground"}>
      {blocks.map((block, index) =>
        block.type === "code" ? (
          <CommandBlock key={index} code={block.code} lang={block.lang} />
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

export function CommandBlock({ code, lang }: { code: string; lang: string | null }) {
  const [copied, setCopied] = useState(false);
  const [typed, setTyped] = useState(false);
  const canType = useCanTypeIntoLab();

  function type() {
    if (!typeIntoLab(code)) return;
    setTyped(true);
    setTimeout(() => setTyped(false), 1500);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be refused (insecure origin, permissions); the text stays selectable.
    }
  }

  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          {lang ?? "command"}
        </span>
        <span className="flex items-center gap-1">
          {canType ? (
            <button
              type="button"
              onClick={type}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              title="Types it into the machine's window that has focus. It does not press Enter."
            >
              {typed ? (
                <>
                  <Check className="size-3 text-emerald-400" aria-hidden="true" /> Typed
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
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            aria-label={copied ? "Copied" : "Copy command"}
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-400" aria-hidden="true" /> Copied
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
    </div>
  );
}
