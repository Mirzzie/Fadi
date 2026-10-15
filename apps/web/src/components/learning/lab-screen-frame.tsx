"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { registerLabTyper } from "@/lib/learning/lab-typing";

/**
 * A VMware machine's screen (public/lab-screen.html) in the project page.
 *
 * Sized to the machine's own shape — the screen page reports its resolution — so a 4:3 guest
 * fills the panel instead of sitting between grey bars. While it shows, step commands can be
 * typed into it (lib/learning/lab-typing.ts).
 */
export function LabScreenFrame({ src, title }: { src: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);

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
    registerLabTyper((text) =>
      frame.current?.contentWindow?.postMessage({ type: "fadi-type", text }, window.location.origin)
    );
    return () => {
      window.removeEventListener("message", onMessage);
      registerLabTyper(null);
    };
  }, []);

  return (
    <div className="relative bg-black">
      <iframe
        ref={frame}
        src={src}
        title={title}
        // The machine's shape, capped so it never pushes the page past the screen.
        style={
          ratio ? { aspectRatio: `${1 / ratio}`, maxHeight: "calc(100vh - 12rem)" } : undefined
        }
        className={`w-full border-0 bg-black ${ratio ? "" : "h-[calc(100vh-22rem)] min-h-96"}`}
        allow="clipboard-read; clipboard-write; fullscreen"
        sandbox="allow-forms allow-pointer-lock allow-same-origin allow-scripts"
      />
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs text-white hover:bg-black"
      >
        <ExternalLink className="size-3" aria-hidden="true" /> Open
      </a>
    </div>
  );
}
