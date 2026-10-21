"use client";

import { ClipboardPaste, Keyboard, Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { registerLabTyper } from "@/lib/learning/lab-typing";

/**
 * A VMware machine's screen (public/lab-screen.html) in the project page.
 *
 * Sized to the machine's own shape — the screen page reports its resolution — so a 4:3 guest
 * fills the panel instead of sitting between grey bars. Its controls sit in a bar ABOVE the
 * screen, never on it, and none of them keeps the keyboard: a focused "Paste" button inside the
 * screen turned every Enter into another paste (15 Oct 2026). After each control, the keyboard
 * goes back to the machine.
 */
export function LabScreenFrame({ src, title }: { src: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Text the screen wants shown to the person before it types it (more than one short line).
  const [confirm, setConfirm] = useState<string | null>(null);
  const [typing, setTyping] = useState<{ done: number; total: number } | null>(null);

  const post = (message: object) => {
    const target = frame.current;
    if (!target?.contentWindow) return;
    target.focus();
    target.contentWindow.postMessage(message, window.location.origin);
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow)
        return;
      const data = event.data as {
        type?: string;
        width?: number;
        height?: number;
        text?: string;
        done?: number;
        total?: number;
        finished?: boolean;
        refused?: string;
      };
      if (data?.type === "fadi-screen-size" && data.width && data.height) {
        setRatio(data.height / data.width);
      } else if (data?.type === "fadi-confirm-type" && typeof data.text === "string") {
        setConfirm(data.text);
      } else if (data?.type === "fadi-typing") {
        if (data.refused) {
          setTyping(null);
          setNote(
            `That's ${(data.total ?? 0).toLocaleString()} characters — too long to type into the machine.`
          );
        } else if (data.finished) setTyping(null);
        else setTyping({ done: data.done ?? 0, total: data.total ?? 0 });
      }
    };
    window.addEventListener("message", onMessage);
    registerLabTyper((text) => {
      const target = frame.current;
      target?.focus();
      // A command the person chose on a step: shown there already, so typed without asking.
      target?.contentWindow?.postMessage(
        { type: "fadi-type", text, confirmed: true },
        window.location.origin
      );
    });
    return () => {
      window.removeEventListener("message", onMessage);
      registerLabTyper(null);
    };
  }, []);

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return setNote("The clipboard is empty.");
      setNote(null);
      // The screen decides whether to ask first (more than one short line) — same as Ctrl+V.
      post({ type: "fadi-type", text, confirmed: false });
    } catch {
      setNote("The browser didn't allow reading the clipboard. Use “Type into lab” on the step.");
    }
  };

  // Buttons never take focus: the keyboard stays with (or returns to) the machine.
  const keep = (event: React.MouseEvent) => event.preventDefault();
  const button =
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 border-b border-border/70 px-3 py-1.5">
        <button type="button" onMouseDown={keep} onClick={paste} className={button}>
          <ClipboardPaste className="size-3.5" aria-hidden="true" /> Paste as typing
        </button>
        <button
          type="button"
          onMouseDown={keep}
          onClick={() => post({ type: "fadi-ctrl-alt-del" })}
          className={button}
        >
          <Keyboard className="size-3.5" aria-hidden="true" /> Ctrl+Alt+Del
        </button>
        <button
          type="button"
          onMouseDown={keep}
          onClick={() => {
            void frame.current?.requestFullscreen?.();
            post({ type: "fadi-focus" });
          }}
          className={button}
        >
          <Maximize2 className="size-3.5" aria-hidden="true" /> Full screen
        </button>
        {note ? <p className="w-full px-2 text-xs text-warning">{note}</p> : null}
        {typing ? (
          <div className="flex w-full items-center gap-2 px-2 text-xs text-muted-foreground">
            Typing into the machine… {typing.done.toLocaleString()} of{" "}
            {typing.total.toLocaleString()}
            <button
              type="button"
              onMouseDown={keep}
              onClick={() => post({ type: "fadi-stop-typing" })}
              className="rounded-md bg-destructive/10 px-2 py-0.5 font-medium text-destructive hover:bg-destructive/20"
            >
              Stop (Esc)
            </button>
          </div>
        ) : null}
        {confirm !== null ? (
          <TypeConfirm
            text={confirm}
            onType={() => {
              post({ type: "fadi-type", text: confirm, confirmed: true });
              setConfirm(null);
            }}
            onCancel={() => {
              setConfirm(null);
              post({ type: "fadi-focus" });
            }}
          />
        ) : null}
      </div>
      <div className="bg-black">
        <iframe
          ref={frame}
          src={src}
          title={title}
          // The machine's shape, capped so it never pushes the page past the screen.
          style={
            ratio ? { aspectRatio: `${1 / ratio}`, maxHeight: "calc(100vh - 12rem)" } : undefined
          }
          className={`mx-auto block w-full border-0 bg-black ${ratio ? "" : "h-[calc(100vh-22rem)] min-h-96"}`}
          allow="clipboard-read; clipboard-write; fullscreen"
          sandbox="allow-forms allow-pointer-lock allow-same-origin allow-scripts"
        />
      </div>
    </div>
  );
}

/**
 * Before typing more than one short line: what will be typed, and what that means. Every line
 * break is an Enter in the machine, so each line runs as it is typed.
 */
function TypeConfirm({
  text,
  onType,
  onCancel,
}: {
  text: string;
  onType: () => void;
  onCancel: () => void;
}) {
  const lines = text.split("\n");
  const preview = lines.slice(0, 6).join("\n");
  return (
    <div className="w-full space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
      <p className="font-medium text-foreground">
        Type {lines.length === 1 ? "this" : `these ${lines.length} lines`} into the machine?
      </p>
      <p className="text-muted-foreground">
        {lines.length > 1
          ? "Every line break presses Enter there, so each line runs as soon as it is typed."
          : `${text.length.toLocaleString()} characters.`}{" "}
        Make sure it&apos;s the command you meant — not something else left in your clipboard.
      </p>
      <pre className="max-h-32 overflow-auto rounded bg-muted px-2 py-1.5 font-mono text-[11px] whitespace-pre-wrap text-foreground">
        {preview}
        {lines.length > 6 ? `\n… and ${lines.length - 6} more lines` : ""}
      </pre>
      <div className="flex gap-2">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onType}
          className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground"
        >
          Type it
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCancel}
          className="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
