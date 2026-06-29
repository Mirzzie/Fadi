"use client";

import { useEffect, useRef } from "react";

import { useFadi } from "@/components/os/fadi-presence";
import { isFadiVoiceEnabled, speakFadi } from "@/lib/voice/fadi-speech";
import type { GuardianVerdict } from "@/lib/guardian/guardian";

/**
 * Makes the Action Guardian "alive": when Fadi has something to say about an action,
 * the orb surfaces a proactive nudge AND — if the user has voice on — Fadi speaks it.
 * Renders nothing itself; the inline FadiGuardianCallout still carries the full text.
 * Fires once per distinct verdict so it never nags on re-render.
 */
export function FadiGuardianVoice({ verdict, href = "" }: { verdict: GuardianVerdict; href?: string }) {
  const { showNudge } = useFadi();
  const lastSpoken = useRef<string>("");

  useEffect(() => {
    if (verdict.level === "ok") return;
    const key = `${verdict.headline}::${verdict.detail}`;
    if (lastSpoken.current === key) return;
    lastSpoken.current = key;

    showNudge({ label: "Fadi", detail: verdict.headline, href });
    if (isFadiVoiceEnabled()) {
      void speakFadi(`${verdict.headline}. ${verdict.detail}`);
    }
  }, [verdict, href, showNudge]);

  return null;
}
