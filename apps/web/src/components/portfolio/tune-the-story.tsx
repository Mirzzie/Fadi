"use client";

import { useEffect, useState } from "react";

import { labelForInterest, PERSONA_EVENT, readPersona, setPersona } from "./persona";

/** Inline persona filter (the "Tune the story" section on the public portfolio). */
export function TuneTheStory({ interests }: { interests: string[] }) {
  const options = [...interests, "all"];
  const [active, setActive] = useState<string>("all");
  const [role, setRole] = useState<string>("visitor");

  useEffect(() => {
    const p = readPersona();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (p?.interest) {
      setActive(p.interest);
      setRole(p.role);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail as { interest?: string; role?: string };
      if (d?.interest) setActive(d.interest);
      if (d?.role) setRole(d.role);
    };
    window.addEventListener(PERSONA_EVENT, onChange);
    return () => window.removeEventListener(PERSONA_EVENT, onChange);
  }, []);

  if (interests.length === 0) return null;

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          data-cursor
          onClick={() => setPersona(role, o)}
          className={`rounded-full border px-4 py-2 text-sm transition-colors ${
            active === o
              ? "border-[var(--pf-accent)] bg-[color-mix(in_srgb,var(--pf-accent)_10%,transparent)] text-[var(--pf-accent)]"
              : "border-zinc-800 text-zinc-300 hover:border-[color-mix(in_srgb,var(--pf-accent)_50%,transparent)]"
          }`}
        >
          {labelForInterest(o)}
        </button>
      ))}
    </div>
  );
}
