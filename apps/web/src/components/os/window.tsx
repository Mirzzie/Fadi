"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { FadiChat } from "@/components/fadi/fadi-chat";
import { cn } from "@/lib/utils";
import { useWindows, type OsWindow, type WindowApp } from "./window-manager";

/** Renders every open window above the desktop. */
export function WindowLayer() {
  const { windows } = useWindows();
  return (
    <AnimatePresence>
      {windows.map((win) => (
        <Window key={win.id} win={win} />
      ))}
    </AnimatePresence>
  );
}

function Window({ win }: { win: OsWindow }) {
  const { close, focus } = useWindows();
  const controls = useDragControls();
  const [size, setSize] = useState({ w: win.w, h: win.h });

  return (
    <motion.div
      drag
      dragControls={controls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      onPointerDownCapture={() => focus(win.id)}
      initial={{ x: win.x, y: win.y, opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      style={{ position: "absolute", top: 0, left: 0, width: size.w, height: size.h, zIndex: win.z }}
      className="glass-holo pointer-events-auto flex flex-col overflow-hidden rounded-xl shadow-2xl"
    >
      {/* Title bar — drag handle + traffic-light close */}
      <div
        onPointerDown={(e) => controls.start(e)}
        className="flex h-9 shrink-0 cursor-grab items-center gap-2 border-b border-border/50 px-3 active:cursor-grabbing"
      >
        <button
          type="button"
          onClick={() => close(win.id)}
          aria-label="Close window"
          className="group grid size-3 place-items-center rounded-full bg-[oklch(0.6_0.22_22)] transition-transform hover:scale-110"
        >
          <span className="text-[7px] leading-none text-black/60 opacity-0 group-hover:opacity-100">×</span>
        </button>
        <span className="size-3 rounded-full bg-muted-foreground/30" aria-hidden="true" />
        <span className="size-3 rounded-full bg-muted-foreground/30" aria-hidden="true" />
        <span className="ml-1 select-none text-xs font-medium tracking-tight text-foreground/90">{win.title}</span>
      </div>

      {/* App content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <AppContent app={win.app} />
      </div>

      {/* Resize handle (bottom-right) */}
      <ResizeHandle
        onResize={(dx, dy) =>
          setSize((s) => ({ w: Math.max(320, s.w + dx), h: Math.max(220, s.h + dy) }))
        }
      />
    </motion.div>
  );
}

function ResizeHandle({ onResize }: { onResize: (dx: number, dy: number) => void }) {
  const last = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.target as Element).setPointerCapture(e.pointerId);
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!last.current) return;
        onResize(e.clientX - last.current.x, e.clientY - last.current.y);
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        last.current = null;
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      }}
      className="absolute bottom-0 right-0 size-4 cursor-nwse-resize"
      aria-hidden="true"
    >
      <span className="absolute bottom-1 right-1 size-2 border-b-2 border-r-2 border-muted-foreground/40" />
    </div>
  );
}

function AppContent({ app }: { app: WindowApp }) {
  if (app === "fadi") return <FadiChat />;
  if (app === "activity") return <ActivityPanel />;
  return <NotesPanel />;
}

type Finding = { id: string; kind: string; title: string; detail: string | null; href: string | null };

function ActivityPanel() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/fadi/activity");
        if (!res.ok) return;
        const data = (await res.json()) as { findings: Finding[] };
        if (!cancelled) setFindings(data.findings);
      } catch {
        if (!cancelled) setFindings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="nice-scrollbar h-full overflow-y-auto p-3 text-sm">
      {findings === null ? (
        <p className="text-xs text-muted-foreground">Loading activity…</p>
      ) : findings.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing yet — Fadi logs what it finds while you&apos;re away.</p>
      ) : (
        <ul className="space-y-2">
          {findings.map((f) => (
            <li key={f.id} className="rounded-lg border border-border/50 bg-card/50 p-2.5">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-primary">{f.kind.replace(/_/g, " ")}</p>
              <p className="mt-0.5 line-clamp-2 text-foreground">{f.title}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const NOTES_KEY = "fadios-notes";

function NotesPanel() {
  const [text, setText] = useState("");
  useEffect(() => {
    try {
      setText(localStorage.getItem(NOTES_KEY) ?? "");
    } catch {
      /* ignore */
    }
  }, []);
  return (
    <textarea
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        try {
          localStorage.setItem(NOTES_KEY, e.target.value);
        } catch {
          /* ignore */
        }
      }}
      placeholder="A quick scratchpad… (saved locally)"
      className={cn("nice-scrollbar h-full w-full resize-none bg-transparent p-3 text-sm outline-none")}
    />
  );
}
