"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--pf-accent)_50%,transparent)] bg-black/60 px-4 py-2.5 text-sm text-[var(--pf-accent)] backdrop-blur transition-colors hover:bg-[var(--pf-accent)] hover:text-black"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={skip}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e: MouseEvent) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-[color-mix(in_srgb,var(--pf-accent)_30%,transparent)] bg-[#101017] p-8 text-zinc-100 shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--pf-accent)]">
                  Welcome
                </p>
                <button
                  type="button"
                  onClick={skip}
                  className="text-zinc-500 hover:text-zinc-200"
                  aria-label="Skip"
                >
                  <X className="size-5" />
                </button>
              </div>

              <h2 className="mt-3 text-2xl font-medium tracking-tight">Who&apos;s visiting?</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Tell me what you&apos;re here for and the work reorders around it.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    data-cursor
                    onClick={() => setRole(r.value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      role === r.value
                        ? "border-[var(--pf-accent)] bg-[color-mix(in_srgb,var(--pf-accent)_10%,transparent)] text-[var(--pf-accent)]"
                        : "border-zinc-800 text-zinc-300 hover:border-[color-mix(in_srgb,var(--pf-accent)_50%,transparent)]"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <h3 className="mt-6 text-sm font-medium text-zinc-300">What are you interested in?</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {options.map((i) => (
                  <button
                    key={i}
                    type="button"
                    data-cursor
                    onClick={() => setInterest(i)}
                    className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                      interest === i
                        ? "border-[var(--pf-accent)] bg-[color-mix(in_srgb,var(--pf-accent)_10%,transparent)] text-[var(--pf-accent)]"
                        : "border-zinc-800 text-zinc-300 hover:border-[color-mix(in_srgb,var(--pf-accent)_50%,transparent)]"
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
                  className="text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Skip
                </button>
                <button
                  type="button"
                  data-cursor
                  onClick={submit}
                  disabled={!interest}
                  className="rounded-full border border-[var(--pf-accent)] bg-[color-mix(in_srgb,var(--pf-accent)_10%,transparent)] px-6 py-2.5 text-sm font-medium text-[var(--pf-accent)] transition-colors hover:bg-[var(--pf-accent)] hover:text-black disabled:opacity-40"
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
