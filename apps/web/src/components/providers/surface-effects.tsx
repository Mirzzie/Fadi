"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const REVEALS = '[data-fadi-reveal], main [data-slot="card"]';

/** Decorative continuity only: no cursor replacement, interaction interception or work state. */
export function SurfaceEffects() {
  const pathname = usePathname();
  const follower = useRef<HTMLDivElement>(null);
  const focusWorkspace =
    /^\/dashboard\/learning\/(?:projects\/[0-9a-f-]{36}|practice\/[^/]+\/[^/]+)/.test(pathname);

  useEffect(() => {
    if (focusWorkspace || /\/print$/.test(pathname)) return;
    const dot = follower.current;
    if (!dot) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    let x = 0,
      y = 0,
      targetX = 0,
      targetY = 0;
    let started = false;
    // Keep dynamic lighting in a private CSS rule, never in streamed React attributes.
    const lighting = document.createElement("style");
    document.head.append(lighting);
    lighting.sheet!.insertRule(":root {}", 0);
    const coordinates = (lighting.sheet!.cssRules[0] as CSSStyleRule).style;
    const animations = new Set<Animation>();
    const tokens = getComputedStyle(document.documentElement);
    const revealDuration = Number.parseFloat(tokens.getPropertyValue("--motion-reveal")) || 550;
    const revealEasing = tokens.getPropertyValue("--ease-reveal").trim() || "ease-out";

    function clear() {
      dot!.removeAttribute("data-active");
      started = false;
      cancelAnimationFrame(frame);
      frame = 0;
    }
    function tick() {
      x += (targetX - x) * 0.22;
      y += (targetY - y) * 0.22;
      dot!.style.transform = `translate3d(${x - 8}px, ${y - 8}px, 0)`;
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.2) frame = requestAnimationFrame(tick);
      else frame = 0;
    }
    function move(event: PointerEvent) {
      if (reduced.matches || !fine.matches || event.pointerType !== "mouse") return clear();
      const element = event.target instanceof Element ? event.target : null;
      // A decoration never competes with editing, a canvas, an embedded machine or native menus.
      if (
        element?.closest(
          'input, textarea, select, [contenteditable="true"], iframe, canvas, pre, [data-effects="quiet"]'
        )
      )
        return clear();
      targetX = Math.max(8, Math.min(innerWidth - 8, event.clientX));
      targetY = Math.max(8, Math.min(innerHeight - 8, event.clientY));
      if (!started) {
        x = targetX;
        y = targetY;
        started = true;
      }
      dot!.setAttribute("data-active", "");
      if (!frame) frame = requestAnimationFrame(tick);
      coordinates.setProperty("--surface-x", `${event.clientX}px`);
      coordinates.setProperty("--surface-y", `${event.clientY}px`);
    }

    const seen = new WeakSet<Element>();
    const intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            if (!reduced.matches) {
              const animation = entry.target.animate(
                [
                  { opacity: 0.45, translate: "0 12px" },
                  { opacity: 1, translate: "0 0" },
                ],
                { duration: revealDuration, easing: revealEasing }
              );
              animations.add(animation);
              animation.onfinish = () => animations.delete(animation);
            }
            intersection.unobserve(entry.target);
          }
      },
      { threshold: 0.08 }
    );
    function register(root: ParentNode) {
      const nodes = [...root.querySelectorAll(REVEALS)];
      if (root instanceof Element && root.matches(REVEALS)) nodes.unshift(root);
      for (const node of nodes)
        if (!seen.has(node)) {
          seen.add(node);
          // Nested card animation would move the same content twice.
          if (!node.parentElement?.closest(REVEALS)) intersection.observe(node);
        }
    }
    register(document);
    const mutations = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) if (node instanceof Element) register(node);
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", clear);
    window.addEventListener("blur", clear);
    window.addEventListener("scroll", clear, { passive: true, capture: true });
    document.addEventListener("keydown", clear);
    function motionChange() {
      clear();
      for (const animation of animations) animation.cancel();
      animations.clear();
    }
    reduced.addEventListener("change", motionChange);
    fine.addEventListener("change", clear);
    dot.setAttribute("data-ready", "");
    return () => {
      dot.removeAttribute("data-ready");
      motionChange();
      lighting.remove();
      intersection.disconnect();
      mutations.disconnect();
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", clear);
      window.removeEventListener("blur", clear);
      window.removeEventListener("scroll", clear, true);
      document.removeEventListener("keydown", clear);
      reduced.removeEventListener("change", motionChange);
      fine.removeEventListener("change", clear);
    };
  }, [pathname, focusWorkspace]);

  return <div ref={follower} data-fadi-pointer aria-hidden="true" />;
}
