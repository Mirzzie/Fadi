"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { GuideTargetId } from "@/lib/agent/guide";
import { useFadi } from "./fadi-presence";

export function useGuideTarget<T extends HTMLElement>(
  id: GuideTargetId,
  title: string,
  description: string
) {
  const ref = useRef<T>(null);
  const pathname = usePathname();
  const { registerGuideTarget } = useFadi();
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return registerGuideTarget({ id, element, title, description, pathname });
  }, [id, title, description, pathname, registerGuideTarget]);
  return ref;
}
