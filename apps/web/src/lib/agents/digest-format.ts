/**
 * Pure digest formatting (unit-tested; no server-only imports). Every line is
 * composed from agent_findings rows — the digest never says more than the
 * ledger records.
 */

export type DigestFinding = {
  kind: string;
  title: string;
  detail: string | null;
};

export function composeDigestMessage(findings: DigestFinding[]): string {
  const newRoles = findings.filter((f) => f.kind === "new_role");
  const expired = findings.filter((f) => f.kind === "expired_saved_role");
  const signals = findings.filter((f) => f.kind === "market_signal");
  const shifts = findings.filter((f) => f.kind === "world_shift");
  // Coherence findings are about the user's OWN data, not the market, so they get
  // their own heading rather than being filed under news about the outside world.
  const coherence = findings.filter(
    (f) =>
      f.kind === "portfolio_gap" ||
      f.kind === "portfolio_duplicate" ||
      f.kind === "evidence_link_unconfirmed" ||
      f.kind === "evidence_needs_decision",
  );

  const parts: string[] = [
    "While you were away, I ran a pass over your market. Here's what's real:",
  ];

  if (newRoles.length > 0) {
    parts.push(
      `\n**New matched role${newRoles.length === 1 ? "" : "s"}:**\n` +
        newRoles.map((f) => `- ${f.title}${f.detail ? ` — ${f.detail}` : ""}`).join("\n"),
    );
  }

  if (expired.length > 0) {
    parts.push(
      `\n**Heads up:**\n` +
        expired.map((f) => `- ${f.title}. ${f.detail ?? ""}`.trimEnd()).join("\n"),
    );
  }

  if (coherence.length > 0) {
    parts.push(
      `\n**Your own record:**\n` +
        coherence.map((f) => `- ${f.title}${f.detail ? ` — ${f.detail}` : ""}`).join("\n"),
    );
  }

  if (shifts.length > 0) {
    parts.push(
      `\n**Bigger picture:**\n` +
        shifts.map((f) => `- ${f.title}${f.detail ? ` — ${f.detail}` : ""}`).join("\n"),
    );
  }

  if (signals.length > 0) {
    parts.push(
      `\n**Market signal${signals.length === 1 ? "" : "s"} worth a glance:**\n` +
        signals.map((f) => `- ${f.title}`).join("\n"),
    );
  }

  parts.push("\nWant me to dig into any of these?");
  return parts.join("\n");
}

/** Short spoken/subline form — the orb greeting, not the full briefing. */
export function composeDigestSubline(findings: DigestFinding[]): string {
  const n = (kind: string) => findings.filter((f) => f.kind === kind).length;

  const roles = n("new_role");
  const expired = n("expired_saved_role");
  const signals = n("market_signal") + n("world_shift");

  const counts: string[] = [];
  if (roles > 0) counts.push(`${roles} new matched role${roles === 1 ? "" : "s"}`);
  if (expired > 0) {
    counts.push(
      `${expired} saved posting${expired === 1 ? "" : "s"} that look${expired === 1 ? "s" : ""} closed`,
    );
  }
  if (signals > 0) counts.push(`${signals} market signal${signals === 1 ? "" : "s"}`);
  const coherence =
    n("portfolio_gap") +
    n("portfolio_duplicate") +
    n("evidence_link_unconfirmed") +
    n("evidence_needs_decision");
  if (coherence > 0) {
    counts.push(`${coherence} thing${coherence === 1 ? "" : "s"} to fix in your own record`);
  }

  // "I found nothing" is a real outcome and must read like one, not like a sentence
  // with a hole where the list should be.
  if (counts.length === 0) return "While you were away I ran a pass and found nothing new.";

  return `While you were away I found ${counts.join(", ")}. The details are in our chat.`;
}
