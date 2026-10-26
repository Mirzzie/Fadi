"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { GuideTargetId } from "@/lib/agent/guide";
import { useFadi } from "./fadi-presence";

export function useGuideTarget<T extends HTMLElement>(
  id: GuideTargetId,
  title: string,
  description: string
) {
  const [element, setElement] = useState<T | null>(null);
  const ref = useCallback((node: T | null) => setElement(node), []);
  const pathname = usePathname();
  const { registerGuideTarget } = useFadi();
  useEffect(() => {
    if (!element) return;
    let unregister: (() => void) | null = null;
    const sync = () => {
      // Keep inactive, mounted tab panels out of the available-guide count. Disabled
      // controls remain registered so an explicit request receives the refusal message.
      const rendered = element.isConnected && element.getClientRects().length > 0;
      if (rendered && !unregister)
        unregister = registerGuideTarget({ id, element, title, description, pathname });
      else if (!rendered && unregister) {
        unregister();
        unregister = null;
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
      observer.observe(parent, {
        attributes: true,
        attributeFilter: ["class", "style", "hidden", "inert"],
      });
    }
    const resize = new ResizeObserver(sync);
    resize.observe(element);
    return () => {
      observer.disconnect();
      resize.disconnect();
      unregister?.();
    };
  }, [id, title, description, pathname, registerGuideTarget, element]);
  return ref;
}
