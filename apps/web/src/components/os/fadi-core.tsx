"use client";

import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { FadiState } from "./fadi-presence";

/**
 * The living Fadi — a luminous, reactive core. Layered glow + orbiting particles +
 * counter-rotating rings + a speaking waveform, driven by Fadi's live state
 * (idle / listening / thinking / working / speaking). One component for the orb,
 * the boot sequence, and the desktop centerpiece.
 *
 * Performance: every loop here is a pure CSS animation on transform/opacity, so it
 * runs on the compositor (off the main thread) instead of framer-motion's per-frame
 * JS. This matters because the orb is mounted on *every* screen — the previous
 * framer-motion version drove ~5 infinite animations on the main thread app-wide
 * and made the whole UI feel slow. Honors prefers-reduced-motion.
 */

const TEAL = "oklch(0.72 0.19 192)";
const VIOLET = "oklch(0.66 0.22 285)";
const TEAL_HALO = "oklch(0.72 0.19 192 / 0.5)";

// Ring spin period (s) + overall energy per state.
const SPIN: Record<FadiState, number> = { idle: 18, listening: 9, thinking: 5, working: 5, speaking: 8 };
const ENERGY: Record<FadiState, number> = { idle: 0.45, listening: 0.85, thinking: 1, working: 1, speaking: 0.9 };
const PARTICLE_DEGS = [0, 45, 90, 135, 180, 225, 270, 315];

export function FadiCore({
  state = "idle",
  size = 56,
  className,
}: {
  state?: FadiState;
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const spin = SPIN[state];
  const energy = ENERGY[state];
  const speaking = state === "speaking" && !reduce;
  const ringR = size * 0.46;

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Halo — static blur, gentle opacity/scale pulse (composited). */}
      <div
        className={cn("absolute inset-0 rounded-full", !reduce && "holo-pulse")}
        style={{
          background: `radial-gradient(circle, ${TEAL_HALO}, transparent 70%)`,
          filter: "blur(6px)",
          opacity: reduce ? energy : undefined,
        }}
      />

      {/* Speaking ripple — an unmistakable "Fadi is talking" pulse outward. */}
      {speaking ? (
        <span
          className="core-ripple absolute inset-0 rounded-full border-2"
          style={{ borderColor: TEAL_HALO }}
        />
      ) : null}

      {/* Outer ring */}
      <svg
        viewBox="0 0 100 100"
        className={cn("absolute inset-0 h-full w-full", !reduce && "core-spin")}
        style={reduce ? undefined : { animationDuration: `${spin}s` }}
      >
        <circle cx="50" cy="50" r="46" fill="none" stroke={TEAL} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="10 14" strokeLinecap="round" />
      </svg>

      {/* Inner ring (counter-rotating) */}
      <svg
        viewBox="0 0 100 100"
        className={cn("absolute inset-0 h-full w-full", !reduce && "core-spin-rev")}
        style={reduce ? undefined : { animationDuration: `${spin * 1.5}s` }}
      >
        <circle cx="50" cy="50" r="33" fill="none" stroke={VIOLET} strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 18" strokeLinecap="round" />
      </svg>

      {/* Orbiting particles — one rotating container (a single composited transform). */}
      <div
        className={cn("absolute inset-0", !reduce && "core-spin")}
        style={reduce ? undefined : { animationDuration: `${spin * 0.8}s` }}
      >
        {PARTICLE_DEGS.map((deg, i) => (
          <span
            key={deg}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: Math.max(2, size * 0.05),
              height: Math.max(2, size * 0.05),
              background: i % 2 ? VIOLET : TEAL,
              boxShadow: "0 0 6px currentColor",
              opacity: energy,
              transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-${ringR}px)`,
            }}
          />
        ))}
      </div>

      {/* Core sphere */}
      <div
        className={cn("relative rounded-full", !reduce && "core-breathe")}
        style={{
          width: size * 0.5,
          height: size * 0.5,
          background: `radial-gradient(circle at 35% 30%, oklch(0.9 0.1 192), ${VIOLET} 72%)`,
          boxShadow: `0 0 18px ${TEAL}, inset 0 0 10px oklch(1 0 0 / 0.45)`,
          animationDuration: speaking ? "0.9s" : undefined,
        }}
      >
        {/* Speaking waveform */}
        {speaking ? (
          <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="core-wave w-[2px] rounded-full bg-white/90"
                style={{ height: size * 0.18, animationDelay: `${i * 0.08}s` }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
