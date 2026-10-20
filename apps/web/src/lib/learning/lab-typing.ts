"use client";

import { useSyncExternalStore } from "react";

/**
 * "Type into lab": the step's command blocks and the lab's screen live in different parts of
 * the page. While a screen that can be typed into is showing, it registers itself here; each
 * command block then offers to type its command into the machine.
 *
 * Typed, not pasted: VMware's screen sharing does not carry the clipboard into the guest, so
 * the screen page sends the text as keystrokes. It never presses Enter after the last line —
 * the person reads the command in the machine before running it.
 */

type Typer = (text: string) => void;

let typer: Typer | null = null;
const listeners = new Set<() => void>();

export function registerLabTyper(next: Typer | null): void {
  typer = next;
  listeners.forEach((listener) => listener());
}

export function typeIntoLab(text: string): boolean {
  if (!typer) return false;
  typer(text);
  return true;
}

export function useCanTypeIntoLab(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => typer !== null,
    () => false
  );
}
