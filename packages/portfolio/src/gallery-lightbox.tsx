"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";

import { isVideoUrl } from "./media";

/**
 * A self-contained gallery affordance for the public portfolio: a small badge
 * overlaid on a card image; clicking opens a full-screen lightbox that pages
 * through the item's media (images + video). Client island — the surrounding
 * card stays server-rendered.
 */
export function GalleryLightbox({ media }: { media: string[] }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const count = media.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % count);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count]);

  if (count === 0) return null;
  const current = media[idx];

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIdx(0);
          setOpen(true);
        }}
        className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur transition-colors hover:bg-[var(--pf-accent)] hover:text-black"
        title="View gallery"
      >
        <Images className="size-3.5" /> {count}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 p-4 md:p-10"
            onClick={() => setOpen(false)}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full border border-white/20 p-2 text-white/80 hover:bg-white/10 hover:text-white"
              title="Close (Esc)"
            >
              <X className="size-5" />
            </button>

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIdx((i) => (i - 1 + count) % count);
                  }}
                  className="absolute left-3 rounded-full border border-white/20 p-2 text-white/80 hover:bg-white/10 hover:text-white md:left-6"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIdx((i) => (i + 1) % count);
                  }}
                  className="absolute right-3 rounded-full border border-white/20 p-2 text-white/80 hover:bg-white/10 hover:text-white md:right-6"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}

            <div
              className="relative flex max-h-full max-w-5xl items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {isVideoUrl(current) ? (
                <video src={current} controls autoPlay className="max-h-[85vh] max-w-full rounded-lg" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current} alt="" className="max-h-[85vh] max-w-full rounded-lg object-contain" />
              )}
            </div>

            {count > 1 && (
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                {idx + 1} / {count}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
