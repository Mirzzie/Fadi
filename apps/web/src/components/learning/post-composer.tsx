"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Copy, Download, ExternalLink, Loader2 } from "lucide-react";

import { draftProjectPostAction, type PostDraft } from "@/app/dashboard/learning/project-finish-actions";
import { Button } from "@/components/ui/button";

/**
 * A post about a finished project, drafted on request from the saved evidence. Fadi never posts:
 * the person copies the text, downloads the card, and posts it themselves on LinkedIn. Opening
 * LinkedIn does not pre-fill anything reliably, so the page says to paste rather than pretending.
 */
export function PostComposer({ runId }: { runId: string }) {
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const make = () =>
    start(async () => {
      setNote(null);
      const result = await draftProjectPostAction({ runId });
      if (!result.ok) return setNote(result.message);
      setDraft(result.draft);
      setText(result.draft.text);
    });

  useEffect(() => {
    if (draft && canvasRef.current) drawCard(canvasRef.current, draft.card);
  }, [draft]);

  if (!draft) {
    return (
      <div>
        <Button variant="outline" size="sm" disabled={busy} onClick={make}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {busy ? "Drafting…" : "Draft a LinkedIn post"}
        </Button>
        {note ? <p className="mt-2 text-xs text-destructive">{note}</p> : null}
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNote("Copied. Paste it into LinkedIn.");
    } catch {
      setNote("Couldn't copy automatically — select the text and copy it.");
    }
  };

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return setNote("Couldn't create the image.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "project-card.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }, "image/png");
  };

  return (
    <div className="space-y-3 border-t border-border/70 pt-4">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={9}
        aria-label="Post text"
        className="w-full rounded-md border border-border bg-background p-3 text-sm leading-relaxed"
      />
      {draft.warnings.length > 0 ? (
        <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-500">
          {draft.warnings.map((warning) => (
            <li key={warning}>Check before posting: {warning}</li>
          ))}
        </ul>
      ) : null}
      <canvas
        ref={canvasRef}
        width={1200}
        height={627}
        className="w-full max-w-md rounded-lg border border-border"
        aria-label="Project card image"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={copy}>
          <Copy aria-hidden="true" /> Copy text
        </Button>
        <Button size="sm" variant="outline" onClick={download}>
          <Download aria-hidden="true" /> Download image
        </Button>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<a href="https://www.linkedin.com/feed/?shareActive=true" target="_blank" rel="noreferrer" />}
        >
          <ExternalLink aria-hidden="true" /> Open LinkedIn
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={make}>
          Draft again
        </Button>
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** A plain card: the project, up to three things done, and where. Deterministic — no image model. */
function drawCard(canvas: HTMLCanvasElement, card: PostDraft["card"]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.fillStyle = "#0b1416";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#14b8a6";
  ctx.fillRect(0, 0, 12, height);

  ctx.fillStyle = "#5eead4";
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.fillText("PROJECT COMPLETE", 80, 110);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 56px system-ui, sans-serif";
  let y = 190;
  for (const line of wrap(ctx, card.title, width - 160).slice(0, 3)) {
    ctx.fillText(line, 80, y);
    y += 68;
  }

  ctx.font = "400 32px system-ui, sans-serif";
  y += 20;
  for (const item of card.lines) {
    ctx.fillStyle = "#5eead4";
    ctx.fillText("✓", 80, y);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(wrap(ctx, item, width - 220)[0] ?? item, 124, y);
    y += 50;
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "400 24px system-ui, sans-serif";
  ctx.fillText("Built in a local lab", 80, height - 60);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}
