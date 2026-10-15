"use client";

import { ClipboardPaste, ExternalLink, Keyboard, Maximize2 } from "lucide-react";
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
      const data = event.data as { type?: string; width?: number; height?: number };
      if (data?.type === "fadi-screen-size" && data.width && data.height) {
        setRatio(data.height / data.width);
      }
    };
    window.addEventListener("message", onMessage);
    registerLabTyper((text) => {
      const target = frame.current;
      target?.focus();
      target?.contentWindow?.postMessage({ type: "fadi-type", text }, window.location.origin);
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
      post({ type: "fadi-type", text });
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
        <a href={src} target="_blank" rel="noreferrer" className={`${button} ml-auto`}>
          <ExternalLink className="size-3.5" aria-hidden="true" /> Open in a tab
        </a>
        {note ? <p className="w-full px-2 text-xs text-amber-600">{note}</p> : null}
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
