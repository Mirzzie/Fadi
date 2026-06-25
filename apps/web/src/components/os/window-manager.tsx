"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** Apps that can open as desktop windows — client panels + every route (iframed). */
export type WindowApp =
  | "fadi"
  | "activity"
  | "notes"
  | "home"
  | "jobs"
  | "documents"
  | "applications"
  | "network"
  | "interview"
  | "evidence"
  | "intelligence"
  | "learning"
  | "niche"
  | "profile"
  | "settings";

export type OsWindow = {
  id: string;
  app: WindowApp;
  title: string;
  /** Initial position/size; the window owns its live geometry after mount. */
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

type WindowManagerValue = {
  windows: OsWindow[];
  open: (app: WindowApp) => void;
  close: (id: string) => void;
  focus: (id: string) => void;
};

const META: Record<WindowApp, { title: string; w: number; h: number }> = {
  fadi: { title: "Fadi", w: 420, h: 560 },
  activity: { title: "Activity", w: 380, h: 460 },
  notes: { title: "Notes", w: 360, h: 380 },
  home: { title: "Mission Control", w: 920, h: 620 },
  jobs: { title: "Jobs", w: 900, h: 600 },
  documents: { title: "Documents", w: 900, h: 600 },
  applications: { title: "Applications", w: 960, h: 600 },
  network: { title: "Network", w: 820, h: 620 },
  interview: { title: "Interview prep", w: 820, h: 620 },
  evidence: { title: "Your evidence", w: 820, h: 620 },
  intelligence: { title: "Career Weather", w: 820, h: 640 },
  learning: { title: "Learning", w: 880, h: 600 },
  niche: { title: "Niche Finder", w: 880, h: 600 },
  profile: { title: "Profile", w: 760, h: 620 },
  settings: { title: "Settings", w: 760, h: 620 },
};

const WindowManagerContext = createContext<WindowManagerValue | null>(null);

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<OsWindow[]>([]);
  const [topZ, setTopZ] = useState(10);

  const focus = useCallback((id: string) => {
    setTopZ((z) => {
      const next = z + 1;
      setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: next } : w)));
      return next;
    });
  }, []);

  const open = useCallback(
    (app: WindowApp) => {
      setWindows((ws) => {
        // Already open → just bring it forward.
        const existing = ws.find((w) => w.app === app);
        if (existing) {
          const next = topZ + 1;
          setTopZ(next);
          return ws.map((w) => (w.id === existing.id ? { ...w, z: next } : w));
        }
        const meta = META[app];
        const next = topZ + 1;
        setTopZ(next);
        // Cascade new windows so they don't stack exactly.
        const offset = ws.length * 28;
        return [
          ...ws,
          {
            id: `${app}-${Date.now()}`,
            app,
            title: meta.title,
            x: 120 + offset,
            y: 90 + offset,
            w: meta.w,
            h: meta.h,
            z: next,
          },
        ];
      });
    },
    [topZ],
  );

  const close = useCallback((id: string) => {
    setWindows((ws) => ws.filter((w) => w.id !== id));
  }, []);

  const value = useMemo<WindowManagerValue>(
    () => ({ windows, open, close, focus }),
    [windows, open, close, focus],
  );

  return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>;
}

export function useWindows(): WindowManagerValue {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error("useWindows must be used within WindowManagerProvider");
  return ctx;
}
