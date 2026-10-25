"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  guidePlacement,
  targetInView,
  targetIsUsable,
  type Box,
  type GuideTarget,
} from "@/lib/agent/guide";

type Placement = {
  x: number;
  y: number;
  target: Box | null;
  panel: { x: number; y: number; width: number } | null;
};

export function useOrbGuide(
  ref: RefObject<HTMLDivElement | null>,
  guide: GuideTarget | null,
  stop: () => void
) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const launcher = ref.current;
        if (!launcher) return;
        const width = window.innerWidth,
          height = window.innerHeight;
        const size = launcher.getBoundingClientRect();
        let next: Placement = {
          x: Math.max(12, width - size.width - 20),
          y: Math.max(12, height - size.height - 80),
          target: null,
          panel: null,
        };
        if (guide) {
          const box = guide.element.getBoundingClientRect();
          if (!targetIsUsable(guide.element) || !targetInView(box, width, height)) {
            stop();
            return;
          }
          const chosen = guidePlacement(box, width, height, size.width, size.height);
          if (!chosen?.panel) {
            stop();
            return;
          }
          next = {
            ...chosen.orb,
            target: {
              left: box.left,
              top: box.top,
              right: box.right,
              bottom: box.bottom,
              width: box.width,
              height: box.height,
            },
            panel: chosen.panel,
          };
        }
        setPlacement((previous) =>
          JSON.stringify(previous) === JSON.stringify(next) ? previous : next
        );
      });
    };
    measure();
    const resize = new ResizeObserver(measure);
    if (ref.current) resize.observe(ref.current);
    if (guide) resize.observe(guide.element);
    const mutation = new MutationObserver(measure);
    if (guide) {
      mutation.observe(document.body, { childList: true, subtree: true });
      for (
        let element: HTMLElement | null = guide.element;
        element;
        element = element.parentElement
      ) {
        mutation.observe(element, {
          attributes: true,
          attributeFilter: [
            "class",
            "style",
            "hidden",
            "disabled",
            "aria-disabled",
            "aria-hidden",
            "inert",
          ],
        });
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
    };
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    if (guide) window.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      window.removeEventListener("keydown", escape);
    };
  }, [ref, guide, stop]);
  return placement;
}
