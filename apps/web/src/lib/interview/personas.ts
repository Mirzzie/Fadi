/**
 * Interviewer personas — pure data + a pure style helper. Kept OUT of mock.ts
 * (which dynamically imports server-only AI code) so the client setup UI can import
 * the persona list without dragging the AI SDK into the browser bundle.
 *
 * These are interviewer ARCHETYPES that shape tone/toughness/follow-ups — honest (we
 * never claim to simulate a specific real person) and domain-agnostic (they fit
 * nursing, trades, finance, tech alike).
 */
export type InterviewerPersona = { id: string; label: string; blurb: string; style: string };

export const INTERVIEWER_PERSONAS: InterviewerPersona[] = [
  {
    id: "recruiter",
    label: "Friendly recruiter",
    blurb: "Warm first-round screen — motivation and fit.",
    style: "a warm, friendly recruiter doing a first-round screen: relaxed and encouraging, focused on motivation, communication, and culture fit; ease the candidate in.",
  },
  {
    id: "hiring_manager",
    label: "Rigorous hiring manager",
    blurb: "Pushes for specifics, follows up hard.",
    style: "a rigorous hiring manager: push for concrete specifics, numbers, and ownership; ask sharp follow-ups; never accept a vague answer.",
  },
  {
    id: "pressure",
    label: "Skeptical pressure-tester",
    blurb: "Challenges your answers; stays cool under fire.",
    style: "a skeptical interviewer who pressure-tests: politely challenge claims, play devil's advocate, and probe weaknesses to see how the candidate holds up. Stay professional, never hostile.",
  },
  {
    id: "panel",
    label: "Structured panel",
    blurb: "Formal, competency by competency.",
    style: "a structured panel interviewer: formal and methodical, covering one competency at a time with consistent, criteria-based questions.",
  },
  {
    id: "visionary",
    label: "Visionary founder",
    blurb: "First-principles, 'why', big-picture.",
    style: "a visionary founder-style interviewer: ask first-principles and 'why' questions, challenge assumptions, and probe how the candidate thinks about impact and the bigger picture — WITHOUT impersonating any real person.",
  },
];

export function personaStyle(id?: string | null): string {
  const p = INTERVIEWER_PERSONAS.find((x) => x.id === id);
  return p ? `\nINTERVIEWER STYLE — conduct this as ${p.style}` : "";
}
