"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";

/* ---------------------------- word-rise headline ---------------------------- */
export function WordRise({ text, delay = 0 }: { text: string; delay?: number }) {
  const words = text.split(" ");
  return (
    <span className="inline-block">
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ delay: delay + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* -------------------------------- marquee -------------------------------- */
export function Marquee({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  const row = [...items, ...items];
  return (
    <div className="relative flex overflow-hidden border-y border-zinc-800 py-5">
      <motion.div
        className="flex shrink-0 items-center gap-8 pr-8"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 22, ease: "linear", repeat: Infinity }}
      >
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-8 text-xl text-zinc-500">
            {t}
            <span className="text-[var(--pf-accent)]">◆</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* --------------------------- gold trailing cursor --------------------------- */
export function Cursor() {
  const mx = useMotionValue(-100);
  const my = useMotionValue(-100);
  const x = useSpring(mx, { damping: 22, stiffness: 350, mass: 0.4 });
  const y = useSpring(my, { damping: 22, stiffness: 350, mass: 0.4 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    const over = (e: MouseEvent) => {
      if ((e.target as Element)?.closest?.("a,button,[data-cursor]")) setActive(true);
    };
    const out = (e: MouseEvent) => {
      if ((e.target as Element)?.closest?.("a,button,[data-cursor]")) setActive(false);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    window.addEventListener("mouseout", out);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      window.removeEventListener("mouseout", out);
    };
  }, [mx, my]);

  return (
    <motion.div
      aria-hidden
      style={{ x, y }}
      className="pointer-events-none fixed left-0 top-0 z-[100] hidden -translate-x-1/2 -translate-y-1/2 md:block"
    >
      <div
        className="rounded-full border border-[var(--pf-accent)] transition-[width,height,background-color] duration-200"
        style={{
          width: active ? 42 : 14,
          height: active ? 42 : 14,
          backgroundColor: active ? "color-mix(in srgb, var(--pf-accent) 12%, transparent)" : "transparent",
        }}
      />
    </motion.div>
  );
}

/* ------------------- liquid metaball background (SVG goo) ------------------- */
const BLOBS = [
  { size: 340, top: "6%", left: "10%", dur: 26, dx: 120, dy: 60 },
  { size: 300, top: "58%", left: "6%", dur: 30, dx: 90, dy: -80 },
  { size: 420, top: "12%", left: "62%", dur: 34, dx: -140, dy: 70 },
  { size: 260, top: "64%", left: "70%", dur: 28, dx: -90, dy: -60 },
  { size: 220, top: "40%", left: "40%", dur: 24, dx: 70, dy: 90 },
  { size: 300, top: "80%", left: "38%", dur: 32, dx: -80, dy: -70 },
];
const BLOB_BG = "radial-gradient(circle at 34% 28%, #3b3b46 0%, #232430 42%, #14141b 78%)";

export function BlobField() {
  const mx = useMotionValue(-400);
  const my = useMotionValue(-400);
  const cx = useSpring(mx, { damping: 30, stiffness: 90, mass: 1.2 });
  const cy = useSpring(my, { damping: 30, stiffness: 90, mass: 1.2 });
  const { scrollYProgress } = useScroll();
  const drift = useTransform(scrollYProgress, [0, 1], [0, -140]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [mx, my]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#101017]">
      <svg className="absolute h-0 w-0" aria-hidden>
        <defs>
          <filter id="portfolio-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <motion.div className="absolute inset-0" style={{ y: drift, filter: "url(#portfolio-goo)" }}>
        {BLOBS.map((b, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ width: b.size, height: b.size, top: b.top, left: b.left, background: BLOB_BG }}
            animate={{ x: [0, b.dx, 0], y: [0, b.dy, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        <motion.div
          className="absolute rounded-full"
          style={{
            x: cx,
            y: cy,
            width: 300,
            height: 300,
            marginLeft: -150,
            marginTop: -150,
            background: BLOB_BG,
          }}
        />
      </motion.div>
    </div>
  );
}

/* ----- alternate template backgrounds (same content, different mood) ----- */
export function AuroraField() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07080c]">
      <motion.div
        className="absolute -left-1/4 top-[-10%] h-[60vh] w-[60vw] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(45,212,191,0.18), transparent 70%)" }}
        animate={{ x: [0, 80, 0], y: [0, 40, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-15%] top-[30%] h-[55vh] w-[55vw] rounded-full blur-[130px]"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.16), transparent 70%)" }}
        animate={{ x: [0, -70, 0], y: [0, -50, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-15%] left-[30%] h-[50vh] w-[50vw] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.12), transparent 70%)" }}
        animate={{ x: [0, 50, 0], y: [0, -40, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function MinimalField() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 bg-[#0a0a0b]"
      style={{
        backgroundImage:
          "radial-gradient(circle at center, rgba(255,255,255,0.05) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
  );
}

/** Picks the template background. Default = noir-gold liquid blobs. */
export function PortfolioBackground({ template }: { template: string }) {
  if (template === "aurora") return <AuroraField />;
  if (template === "minimal") return <MinimalField />;
  return <BlobField />;
}
