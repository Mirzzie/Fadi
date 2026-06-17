/**
 * Referral outreach — the part of networking where AI genuinely helps: turning
 * "I should ask someone at this company" into a short, warm, specific message the
 * user is actually willing to send.
 *
 * Honesty: we CANNOT see the user's LinkedIn graph, so we never pretend to know
 * who they're connected to. referralStrategy() gives honest ways to FIND a path;
 * the draft never invents a shared history. Pure helpers here are test-importable;
 * the AI provider is loaded dynamically.
 */

export type Relationship =
  | "alumni"
  | "former_colleague"
  | "second_degree"
  | "friend"
  | "recruiter"
  | "cold";

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  alumni: "School alum",
  former_colleague: "Former colleague",
  second_degree: "Mutual connection",
  friend: "Friend / personal",
  recruiter: "Recruiter",
  cold: "No connection yet",
};

export type OutreachInput = {
  company: string;
  roleTitle?: string | null;
  contactName?: string | null;
  contactRole?: string | null;
  relationship: Relationship;
  /** A one-line "who the user is" (from their career evidence), if available. */
  candidateBlurb?: string | null;
};

/**
 * Honest ways to find a referral path into a company — we can't read the user's
 * network, so we hand them the search moves that actually work.
 */
export function referralStrategy(company: string): string[] {
  const c = company.trim() || "the company";
  return [
    `Search LinkedIn for alumni from your school or past employers who now work at ${c} — shared background makes a warm ask far easier.`,
    `Look for 2nd-degree connections at ${c} and ask the mutual person for a short intro rather than messaging cold.`,
    `Find someone on the actual team you'd join; engage genuinely with their work first, then make a specific, low-pressure ask.`,
    `Message a recruiter at ${c} directly — referring and sourcing is literally their job.`,
    `Ask your own circle (friends, former managers, community/Slack groups): "Does anyone know someone at ${c}?"`,
  ];
}

/** The relationship-aware opener fragment, used by the no-AI fallback. */
function opener(input: OutreachInput): string {
  const name = input.contactName?.trim();
  const hi = name ? `Hi ${name},` : "Hi,";
  switch (input.relationship) {
    case "alumni":
      return `${hi} I noticed we both came through the same school — small world.`;
    case "former_colleague":
      return `${hi} It's been a while since we worked together — hope you're doing well.`;
    case "second_degree":
      return `${hi} We have a connection in common, so I wanted to reach out directly.`;
    case "friend":
      return `${hi} Hope you're well!`;
    case "recruiter":
      return `${hi} I saw you recruit at ${input.company} and wanted to introduce myself.`;
    default:
      return `${hi} I hope you don't mind a direct message.`;
  }
}

/**
 * A genuine, sendable message without any AI — short, specific, low-pressure.
 * Always available so the feature works without a provider key.
 */
export function fallbackOutreach(input: OutreachInput): string {
  const role = input.roleTitle?.trim();
  const who = input.candidateBlurb?.trim();
  const lines = [opener(input)];

  lines.push(
    role
      ? `I'm exploring the ${role} role at ${input.company}${who ? `, coming from ${who}` : ""}.`
      : `I'm exploring opportunities at ${input.company}${who ? `, coming from ${who}` : ""}.`,
  );
  lines.push(
    input.relationship === "recruiter"
      ? "Would you be open to a quick chat about whether I'd be a fit?"
      : "Would you be open to a quick chat, or — if you think it's warranted — to referring me? No pressure either way, and happy to share more.",
  );
  lines.push("Thanks so much for considering it.");
  return lines.join("\n\n");
}

/** The system prompt for AI drafting — used server-side (see referrals.ts). */
export const OUTREACH_SYSTEM = `You write short, genuine referral-outreach messages for a job seeker. Constraints:
- Under 110 words. Warm, specific, and low-pressure — never desperate, never generic spam.
- Make a clear, easy ask: a quick chat and/or a referral, with an explicit "no pressure".
- Respect the stated relationship. Do NOT invent a shared history, prior conversations, or facts not given.
- Plain text, first person, ready to send. No subject line unless it's an email to a recruiter.`;

/** Compact context for the model. */
export function buildOutreachContext(input: OutreachInput): string {
  const parts = [
    `Recipient: ${input.contactName?.trim() || "(name unknown)"}${input.contactRole ? `, ${input.contactRole}` : ""} at ${input.company}.`,
    `Relationship to me: ${RELATIONSHIP_LABEL[input.relationship]}.`,
    input.roleTitle ? `Role I'm targeting: ${input.roleTitle}.` : "Role: exploring openings.",
  ];
  if (input.candidateBlurb?.trim()) parts.push(`About me: ${input.candidateBlurb.trim()}`);
  return parts.join("\n");
}
