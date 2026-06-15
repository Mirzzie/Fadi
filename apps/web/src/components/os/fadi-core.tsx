"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { FadiState } from "./fadi-presence";

/**
 * The living Fadi — a luminous, reactive core. Layered glow + orbiting particles +
 * counter-rotating rings + a speaking waveform, all driven by Fadi's live state
 * (idle / listening / thinking / working / speaking). One component for the orb,
 * the boot sequence, and the desktop centerpiece. Honors prefers-reduced-motion.
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
  const speaking = state === "speaking";
  const ringR = size * 0.46;

  const spinFor = (reverse = false) => (reduce ? undefined : { rotate: reverse ? -360 : 360 });
  const linear = (duration: number) => ({ duration, repeat: Infinity, ease: "linear" as const });

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Halo */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${TEAL_HALO}, transparent 70%)`, filter: "blur(6px)" }}
        animate={reduce ? { opacity: energy } : { scale: [1, 1.16, 1], opacity: [energy * 0.5, energy, energy * 0.5] }}
        transition={reduce ? undefined : { duration: speaking ? 1.3 : 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Outer ring */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        animate={spinFor()}
        transition={linear(spin)}
      >
        <circle cx="50" cy="50" r="46" fill="none" stroke={TEAL} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="10 14" strokeLinecap="round" />
      </motion.svg>

      {/* Inner ring (counter-rotating) */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        animate={spinFor(true)}
        transition={linear(spin * 1.5)}
      >
        <circle cx="50" cy="50" r="33" fill="none" stroke={VIOLET} strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 18" strokeLinecap="round" />
      </motion.svg>

      {/* Orbiting particles */}
      <motion.div className="absolute inset-0" animate={spinFor()} transition={linear(spin * 0.8)}>
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
      </motion.div>

      {/* Core sphere */}
      <motion.div
        className="relative rounded-full"
        style={{
          width: size * 0.5,
          height: size * 0.5,
          background: `radial-gradient(circle at 35% 30%, oklch(0.9 0.1 192), ${VIOLET} 72%)`,
          boxShadow: `0 0 18px ${TEAL}, inset 0 0 10px oklch(1 0 0 / 0.45)`,
        }}
        animate={reduce ? undefined : { scale: speaking ? [1, 1.1, 0.95, 1.08, 1] : [1, 1.05, 1] }}
        transition={reduce ? undefined : { duration: speaking ? 0.6 : 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Speaking waveform */}
        {speaking && !reduce ? (
          <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                className="w-[2px] rounded-full bg-white/90"
                animate={{ height: [size * 0.06, size * 0.18, size * 0.06] }}
                transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
              />
            ))}
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
