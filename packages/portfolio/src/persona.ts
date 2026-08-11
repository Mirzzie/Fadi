// Shared client helpers for visitor personalization on the public portfolio.
// Interests are DYNAMIC — derived from the audience tags the owner actually put
// on their items — so this works for any career (a nurse's "Paediatric ICU", a
// civil engineer's "Structural", not just tech roles).

export const PERSONA_KEY = "fadi-portfolio-persona:v1";
export const PERSONA_EVENT = "fadi-persona-change";

export type Persona = { role: string; interest: string };

export function readPersona(): Persona | null {
  try {
    const raw = localStorage.getItem(PERSONA_KEY);
    return raw ? (JSON.parse(raw) as Persona) : null;
  } catch {
    return null;
  }
}

/** Show items whose audience tags include the interest (or have no tags). "all" shows everything. */
export function applyPersonaFilter(interest: string) {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLElement>("[data-portfolio-item]").forEach((el) => {
    const roles = (el.getAttribute("data-roles") || "").split(" ").filter(Boolean);
    const show = interest === "all" || roles.length === 0 || roles.includes(interest);
    el.style.display = show ? "" : "none";
  });
}

/** Persist + apply + broadcast so every persona control on the page stays in sync. */
export function setPersona(role: string, interest: string) {
  try {
    localStorage.setItem(PERSONA_KEY, JSON.stringify({ role, interest }));
  } catch {
    /* ignore */
  }
  applyPersonaFilter(interest);
  window.dispatchEvent(new CustomEvent(PERSONA_EVENT, { detail: { role, interest } }));
}

/** Turn a raw audience tag into a friendly label ("paediatric-icu" -> "Paediatric Icu"). */
export function labelForInterest(value: string): string {
  if (value === "all") return "Everything";
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
