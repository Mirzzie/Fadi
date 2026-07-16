/**
 * Next.js server bootstrap. Runs once per server runtime, before any request.
 *
 * We use it to wire the domain-event subscribers. Doing it here (rather than from
 * inside a feature) keeps publishers ignorant of subscribers: nothing in
 * evidence/learning imports the portfolio — the system is composed at the edge.
 */
export async function register() {
  // Node runtime only: subscribers touch server-only APIs (DB, revalidatePath).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { registerAllSubscribers } = await import("@/lib/events/register");
  registerAllSubscribers();
}
