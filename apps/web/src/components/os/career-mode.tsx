"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import {
  getCareerModeAction,
  setCareerModeAction,
  type CareerMode,
} from "@/app/dashboard/mode-actions";

type Ctx = {
  mode: CareerMode;
  /** Switch phase: optimistic locally, persisted server-side, then refreshes so content follows. */
  setMode: (m: CareerMode) => void;
};

const CareerModeContext = createContext<Ctx | null>(null);
const LS_KEY = "fadi_mode";

/**
 * Client source of truth for the Apply/Prepare phase, shared by the menu-bar toggle and the dock
 * filter so switching transforms the WHOLE shell at once. Paints instantly from localStorage (no
 * flash on repeat visits), then reconciles with the server (correct across devices).
 */
export function CareerModeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mode, setModeState] = useState<CareerMode>(() => {
    if (typeof window === "undefined") return "apply";
    const cached = window.localStorage.getItem(LS_KEY);
    return cached === "prepare" || cached === "apply" ? cached : "apply";
  });

  // Reconcile with the durable server value once on mount.
  useEffect(() => {
    let active = true;
    getCareerModeAction()
      .then((server) => {
        if (!active) return;
        setModeState(server);
        window.localStorage.setItem(LS_KEY, server);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setMode = (m: CareerMode) => {
    if (m === mode) return;
    setModeState(m); // optimistic — the shell reshapes immediately
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, m);
    void setCareerModeAction(m).then(() => router.refresh()); // persist + let content follow
  };

  return (
    <CareerModeContext.Provider value={{ mode, setMode }}>{children}</CareerModeContext.Provider>
  );
}

export function useCareerMode(): Ctx {
  const ctx = useContext(CareerModeContext);
  if (!ctx) throw new Error("useCareerMode must be used within CareerModeProvider");
  return ctx;
}
