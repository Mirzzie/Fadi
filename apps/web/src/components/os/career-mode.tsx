"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";

import { setCareerModeAction, type CareerMode } from "@/app/dashboard/mode-actions";

type Ctx = {
  mode: CareerMode;
  /** Switch phase: optimistic locally, persisted server-side (DB + cookie), then refreshes so
   *  the server-rendered content (e.g. the Prepare panel) follows. */
  setMode: (m: CareerMode) => void;
};

const CareerModeContext = createContext<Ctx | null>(null);

/**
 * Client source of truth for the Apply/Prepare phase, shared by the menu-bar toggle and the dock
 * filter so switching transforms the WHOLE shell at once. Seeded from a cookie read on the SERVER
 * (via the initialMode prop), so the first client render matches the server exactly — no flash,
 * no hydration mismatch.
 */
export function CareerModeProvider({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode: CareerMode;
}) {
  const router = useRouter();
  const [mode, setModeState] = useState<CareerMode>(initialMode);

  const setMode = (m: CareerMode) => {
    if (m === mode) return;
    setModeState(m); // optimistic — the shell reshapes immediately
    void setCareerModeAction(m).then(() => router.refresh()); // persist (DB + cookie) + let content follow
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
