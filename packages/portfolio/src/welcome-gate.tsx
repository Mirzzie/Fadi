"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, X } from "lucide-react";

import {
  applyPersonaFilter,
  labelForInterest,
  PERSONA_EVENT,
  readPersona,
  setPersona,
} from "./persona";

// Visitor-side personalization for the PUBLIC portfolio. Independent of the
// owner's Fadi career tracks. Interests are passed in from the actual data, so
// this is domain-agnostic (works for medicine, civil, psychology — anything).

const ROLES = [
  { value: "recruiter", label: "Recruiter / hiring" },
  { value: "business", label: "Client / business" },
  { value: "peer", label: "Peer / colleague" },
  { value: "visitor", label: "Just exploring" },
];

export function WelcomeGate({ interests }: { interests: string[] }) {
  const reducedMotion = useReducedMotion();
  const options = [...interests, "all"];
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [interest, setInterest] = useState<string | null>(null);
  const [savedInterest, setSavedInterest] = useState<string | null>(null);

  useEffect(() => {
    const p = readPersona();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (p?.interest) {
      setSavedInterest(p.interest);
      setRole(p.role);
      setInterest(p.interest);
      applyPersonaFilter(p.interest);
    } else if (interests.length > 0) {
      setOpen(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail as { interest?: string };
      if (d?.interest) setSavedInterest(d.interest);
    };
    window.addEventListener(PERSONA_EVENT, onChange);
    return () => window.removeEventListener(PERSONA_EVENT, onChange);
  }, [interests]);

  function submit() {
    if (!interest) return;
    setPersona(role ?? "visitor", interest);
    setOpen(false);
  }
  function skip() {
    setOpen(false);
    applyPersonaFilter("all");
  }

  if (interests.length === 0) return null;
  const savedLabel = savedInterest ? labelForInterest(savedInterest) : null;

  return (
    <>
      <button
        type="button"
        data-cursor
        onClick={() => setOpen(true)}
        className="fadi-glass fixed bottom-5 right-5 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2.5 text-sm text-[var(--primary)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        <Sparkles className="size-4" />
        {savedLabel && savedLabel !== "Everything" ? `Tailored: ${savedLabel}` : "Tailor for me"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
            onClick={skip}
          >
            <motion.div
              initial={{ opacity: 0, y: reducedMotion ? 0 : 20, scale: reducedMotion ? 1 : 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : 20, scale: reducedMotion ? 1 : 0.98 }}
              transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e: MouseEvent) => e.stopPropagation()}
              className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--foreground)] shadow-2xl sm:p-8 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-[var(--ring)]"
            >
              <div className="flex items-start justify-between">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--primary)]">
                  Welcome
                </p>
                <button
                  type="button"
                  onClick={skip}
                  className="inline-flex size-11 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  aria-label="Skip"
                >
                  <X className="size-5" />
                </button>
              </div>

              <h2 className="mt-3 text-2xl font-medium tracking-tight">Who&apos;s visiting?</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Tell me what you&apos;re here for and the work reorders around it.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    data-cursor
                    onClick={() => setRole(r.value)}
                    aria-pressed={role === r.value}
                    className={`rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      role === r.value
                        ? "border-[var(--primary)] bg-[var(--muted)] text-[var(--primary)]"
                        : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <h3 className="mt-6 text-sm font-medium text-[var(--foreground)]">What are you interested in?</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {options.map((i) => (
                  <button
                    key={i}
                    type="button"
                    data-cursor
                    onClick={() => setInterest(i)}
                    aria-pressed={interest === i}
                    className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                      interest === i
                        ? "border-[var(--primary)] bg-[var(--muted)] text-[var(--primary)]"
                        : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]"
                    }`}
                  >
                    {labelForInterest(i)}
                  </button>
                ))}
              </div>

              <div className="mt-7 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={skip}
                  className="min-h-11 px-3 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  Skip
                </button>
                <button
                  type="button"
                  data-cursor
                  onClick={submit}
                  disabled={!interest}
                  className="min-h-11 rounded-full border border-[var(--primary)] bg-[var(--primary)] px-6 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Show me
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
