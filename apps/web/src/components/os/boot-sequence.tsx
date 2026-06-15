"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import { FadiLogo } from "@/components/brand/fadi-logo";
import { useSpeechOutput } from "@/lib/voice/use-speech-output";
import { FadiCore } from "./fadi-core";

const BOOT_KEY = "fadios-booted";
const VOICE_PREF_KEY = "fadi-voice-enabled";

/**
 * Cinematic wake — entering FadiOS feels like powering on a system. Shown once per
 * session; the "Enter" tap is the gesture that unlocks browser audio so Fadi can
 * speak his first words (and talk by default afterward). Reduced-motion skips it
 * entirely (no animation, no forced speech).
 */
export function BootSequence() {
  const reduce = useReducedMotion();
  const { speak } = useSpeechOutput({ rate: 1.0 });
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (reduce) return; // honor reduced-motion: no boot cinematic
    try {
      if (sessionStorage.getItem(BOOT_KEY) !== "1") setShow(true);
    } catch {
      setShow(true);
    }
  }, [reduce]);

  function enter() {
    try {
      localStorage.setItem(VOICE_PREF_KEY, "1"); // Fadi talks by default from here on
      sessionStorage.setItem(BOOT_KEY, "1");
    } catch {
      /* private mode — boot just won't persist */
    }
    // This click is the audio-unlock gesture; Fadi's first words.
    speak("FadiOS online. I'm Fadi, your AI operating system. Let's get to work.");
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="boot"
          className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-[oklch(0.09_0.03_245)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
        >
          {/* Igniting holographic grid */}
          <motion.div
            aria-hidden="true"
            className="holo-grid pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
          />
          <div aria-hidden="true" className="holo-scanlines pointer-events-none absolute inset-0 opacity-50" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(60% 50% at 50% 45%, oklch(0.66 0.22 285 / 0.18), transparent 70%)" }}
          />

          <div className="relative flex flex-col items-center gap-5 px-6 text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 120, damping: 14 }}
            >
              <FadiCore state="thinking" size={120} />
            </motion.div>

            <motion.div
              className="flex items-center gap-2.5"
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              <FadiLogo className="size-7" />
              <span className="text-glow text-2xl font-semibold tracking-tight text-white">FadiOS</span>
            </motion.div>

            <motion.p
              className="text-xs uppercase tracking-[0.35em] text-white/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.6 }}
            >
              AI Operating System
            </motion.p>

            <motion.button
              type="button"
              onClick={enter}
              className="glow-edge mt-2 rounded-full border border-primary/40 bg-primary/10 px-6 py-2.5 text-sm font-semibold text-primary backdrop-blur transition-colors hover:bg-primary/20"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.5 }}
            >
              ⏻ Enter FadiOS
            </motion.button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
