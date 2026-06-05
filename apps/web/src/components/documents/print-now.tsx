"use client";

import { useEffect } from "react";

/** Opens the browser print dialog on mount (→ Save as PDF) and offers a button. */
export function PrintNow() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="fixed right-4 top-4 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
