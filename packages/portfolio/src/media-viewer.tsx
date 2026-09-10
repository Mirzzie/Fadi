"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Play, X } from "lucide-react";

import { isVideoUrl } from "./media";

/**
 * CLICK ANY ARTEFACT TO SEE IT PROPERLY.
 *
 * Two bugs this fixes, both of which made the evidence useless:
 *
 *   1. CROPPING. Artefacts were drawn with `object-cover` inside a fixed aspect
 *      ratio, which crops. That is fine for a decorative photo and destructive for
 *      the things a portfolio actually shows — an architecture diagram loses its
 *      edges, a dashboard loses its numbers. Everything here is `object-contain` on
 *      a neutral ground: the whole artefact, always, letterboxed if it must be.
 *
 *   2. NO WAY IN. The image was inert, so a reader who wanted a closer look had
 *      nowhere to click. Diagrams are exactly the thing people want to enlarge.
 *
 * The affordance is visible at rest — a small "expand" chip rather than a
 * hover-only cue — because a hover cue does not exist on a phone, and half the
 * people reading a portfolio are on one.
 *
 *   3. VIDEO RENDERED AS A BROKEN IMAGE. The editor accepts video/* uploads and the
 *      admin previews them correctly, so a screen recording looked fine right up until
 *      it was published — this component drew every media URL as an <img>, and the live
 *      site showed a broken icon where the demo should be. Anything the editor accepts
 *      has to render here, or "add a video" is a feature that only works in private.
 */
export function MediaViewer({
  media,
  caption,
  className = "",
}: {
  media: string[];
  caption?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const count = media.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (count > 1 && e.key === "ArrowRight") setIdx((i) => (i + 1) % count);
      if (count > 1 && e.key === "ArrowLeft") setIdx((i) => (i - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    // Stop the page scrolling behind the overlay.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, count]);

  if (count === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIdx(0);
          setOpen(true);
        }}
        aria-label={`Enlarge ${caption || "artefact"}`}
        className={`group relative block w-full overflow-hidden rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface-2)] ${className}`}
      >
        {isVideoUrl(media[0]) ? (
          // muted + playsInline so a phone shows the first frame instead of a black box;
          // preload="metadata" keeps a heavy demo off the critical path.
          <video
            src={media[0]}
            muted
            playsInline
            preload="metadata"
            aria-label={caption || "Video"}
            className="block max-h-[420px] w-full object-contain"
          />
        ) : (
          <img
            src={media[0]}
            alt={caption || ""}
            loading="lazy"
            className="block max-h-[420px] w-full object-contain"
          />
        )}
        <span className="pointer-events-none absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-md border border-[var(--pf-line)] bg-[var(--pf-bg)]/85 px-2 py-1 font-mono text-[11px] text-[var(--pf-ink-2)] backdrop-blur transition-colors group-hover:text-[var(--pf-ink)]">
          {isVideoUrl(media[0]) ? (
            <Play className="size-3" aria-hidden="true" />
          ) : (
            <Maximize2 className="size-3" aria-hidden="true" />
          )}
          {/* "images" was a lie the moment a video was allowed in. */}
          {count > 1 ? `${count} items` : isVideoUrl(media[0]) ? "Play" : "Enlarge"}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={caption || "Artefact"}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-md border border-white/20 p-2 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" aria-hidden="true" />
          </button>

          {/* object-contain again: enlarging must never crop either. */}
          {isVideoUrl(media[idx]) ? (
            <video
              key={media[idx]}
              src={media[idx]}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
              className="max-h-[86vh] max-w-full rounded-lg object-contain"
            />
          ) : (
            <img
              src={media[idx]}
              alt={caption || ""}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[86vh] max-w-full cursor-default rounded-lg object-contain"
            />
          )}

          {caption ? <p className="mt-3 text-sm text-white/70">{caption}</p> : null}

          {count > 1 ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-3 flex items-center gap-4 text-white/80"
            >
              <button
                type="button"
                onClick={() => setIdx((i) => (i - 1 + count) % count)}
                aria-label="Previous"
                className="rounded-md border border-white/20 p-2 hover:bg-white/10"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <span className="font-mono text-xs tabular-nums">
                {idx + 1} / {count}
              </span>
              <button
                type="button"
                onClick={() => setIdx((i) => (i + 1) % count)}
                aria-label="Next"
                className="rounded-md border border-white/20 p-2 hover:bg-white/10"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
