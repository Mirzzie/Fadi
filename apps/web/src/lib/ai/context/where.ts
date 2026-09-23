/**
 * WHAT THE PERSON IS LOOKING AT.
 *
 * Fadi's context carried their profile, evidence, saved jobs, market data and momentum — and not
 * the one thing a person beside them would see first: the screen in front of them. So "what's
 * wrong with this résumé?" had to be answered without knowing which résumé, and the person ended
 * up re-typing what Fadi could have read.
 *
 * The client sends only the path. The entity behind it is resolved SERVER-side from the person's
 * own rows, so a forged label cannot put words in Fadi's context, and a stale tab cannot claim to
 * be looking at someone else's document.
 */

export type Where = {
  /** The route the person is on, as a plain sentence: "the Jobs board". */
  place: string;
  /** The thing they have open, when the route names one. */
  entity?: { kind: "document" | "job" | "application" | "project"; id: string; label: string };
};

/** Routes that name a place, longest prefix first so /dashboard is the fallback. */
const PLACES: [RegExp, string][] = [
  [/^\/dashboard\/evidence/, "their evidence — the career record everything else is written from"],
  [/^\/dashboard\/portfolio/, "their portfolio CMS"],
  [/^\/dashboard\/documents\/[^/]+/, "one of their documents, open in the editor"],
  [/^\/dashboard\/documents/, "their documents library"],
  [/^\/dashboard\/applications\/[^/]+/, "one application's workspace"],
  [/^\/dashboard\/applications/, "their applications board"],
  [/^\/dashboard\/jobs/, "the jobs board"],
  [/^\/dashboard\/learning\/projects\/[^/]+/, "a practice project they are working through"],
  [/^\/dashboard\/learning/, "the learning hub"],
  [/^\/dashboard\/interview/, "interview preparation"],
  [/^\/dashboard\/network/, "their network"],
  [/^\/dashboard\/profile/, "their profile"],
  [/^\/dashboard\/settings/, "settings"],
  [/^\/dashboard\/niche-finder/, "the niche finder"],
  [/^\/dashboard$/, "their dashboard"],
];

/** The id in a route like /dashboard/documents/<uuid>, when there is one. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export type RouteTarget =
  | { kind: "document" | "job" | "application" | "project"; id: string }
  | null;

/** Which of the person's own records this route is about, if any. Pure. */
export function routeTarget(pathname: string): RouteTarget {
  const id = pathname.match(UUID)?.[0];
  if (!id) return null;
  if (pathname.startsWith("/dashboard/documents/")) return { kind: "document", id };
  if (pathname.startsWith("/dashboard/applications/")) return { kind: "application", id };
  if (pathname.startsWith("/dashboard/learning/projects/")) return { kind: "project", id };
  if (pathname.startsWith("/dashboard/jobs/")) return { kind: "job", id };
  return null;
}

/** The place, in words Fadi can say back to the person. Pure. */
export function placeOf(pathname: string): string | null {
  const clean = (pathname || "").split("?")[0].replace(/\/+$/, "") || "/dashboard";
  for (const [pattern, place] of PLACES) if (pattern.test(clean)) return place;
  return null;
}

/** One line for the prompt. Empty when we cannot say anything true about it. */
export function describeWhere(where: Where | null): string {
  if (!where?.place) return "";
  const entity = where.entity ? ` They have "${where.entity.label}" open.` : "";
  return `RIGHT NOW they are looking at ${where.place}.${entity} If they say "this", they almost certainly mean that — do not ask them which one unless it is genuinely ambiguous.`;
}
