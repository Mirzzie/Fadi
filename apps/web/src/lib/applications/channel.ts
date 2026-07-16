/**
 * Channel (ATS) detection + monoculture analysis.
 *
 * WHY THIS EXISTS — see docs/PLATFORM_IDEOLOGY.md, Principle 1.
 *
 * "Algorithmic Monocultures in Hiring" (Bommasani, Bana, Creel, Jurafsky, Liang —
 * ACM FAccT 2026; 3.4M applicants / 4M applications / 156 employers) shows employers
 * screen with tools from the same few vendors, so **rejections are correlated, not
 * independent**. Kleinberg & Raghavan (PNAS 2021) formalised it: firms sharing an
 * algorithm can hire *weaker* applicants than firms using independent, individually
 * less accurate methods — good candidates are missed as a structural artifact.
 *
 * The consequence, and the whole point of this module:
 *
 *   Twenty applications through one ATS is NOT twenty attempts. It is one draw,
 *   copy-pasted twenty times. Volume through a single filter has ~zero marginal
 *   value; the escape is DECORRELATION — a different channel.
 *
 * This is also a mental-health feature (Principle 4). A user with 12 rejections from
 * one filter has a sample size of ~1, not 12. Telling them that is both TRUE and
 * protective: it restores locus of control with a fact rather than a platitude.
 *
 * Pure functions on purpose: no DB, no network, no React — fast and deterministic to
 * test, and the honesty rules below are pinned by tests rather than by good intentions.
 */

export type Channel =
  | "workday"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "icims"
  | "taleo"
  | "bamboohr"
  | "recruitee"
  | "teamtailor"
  | "personio"
  | "linkedin"
  | "other"
  | "unknown";

/** Vendor fingerprints. The ATS is almost always visible in the application URL. */
const PATTERNS: ReadonlyArray<readonly [Channel, RegExp]> = [
  ["workday", /myworkdayjobs\.com|workday\.com/i],
  ["greenhouse", /greenhouse\.io/i],
  ["lever", /lever\.co/i],
  ["ashby", /ashbyhq\.com/i],
  ["smartrecruiters", /smartrecruiters\.com/i],
  ["icims", /icims\.com/i],
  ["taleo", /taleo\.net|taleo\.com/i],
  ["bamboohr", /bamboohr\.com/i],
  ["recruitee", /recruitee\.com/i],
  ["teamtailor", /teamtailor\.com/i],
  ["personio", /personio\.(de|com)/i],
  ["linkedin", /linkedin\.com/i],
];

export const CHANNEL_LABEL: Record<Channel, string> = {
  workday: "Workday",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  icims: "iCIMS",
  taleo: "Taleo",
  bamboohr: "BambooHR",
  recruitee: "Recruitee",
  teamtailor: "Teamtailor",
  personio: "Personio",
  linkedin: "LinkedIn",
  other: "Company site / direct",
  unknown: "Unknown",
};

/** Which screening filter did this application enter? */
export function detectChannel(url: string | null | undefined): Channel {
  const u = (url ?? "").trim();
  if (!u) return "unknown";
  for (const [channel, re] of PATTERNS) {
    if (re.test(u)) return channel;
  }
  // A real URL we don't recognise is very likely a company's own careers page —
  // which is GOOD news (it's outside the big-vendor monoculture), so it must not be
  // lumped in with "unknown".
  return "other";
}

export type ChannelMix = {
  /** Applications we could attribute to a channel (excludes unknown). */
  total: number;
  counts: Partial<Record<Channel, number>>;
  dominant: { channel: Channel; count: number; share: number } | null;
  /**
   * Distinct channels used ≈ the number of genuinely INDEPENDENT draws the user has
   * taken. This is the honest denominator: 20 Workday applications ≈ 1 draw.
   */
  effectiveDraws: number;
  /** Enough evidence AND enough concentration to say something true about it. */
  concentrated: boolean;
};

/** Below this we do not have the evidence to claim a pattern. Honesty > engagement. */
const MIN_FOR_CLAIM = 5;
/** One filter holding ≥60% of the pipeline is a monoculture worth naming. */
const CONCENTRATION_THRESHOLD = 0.6;

export function analyseChannelMix(
  applications: ReadonlyArray<{ url?: string | null }>,
): ChannelMix {
  const counts: Partial<Record<Channel, number>> = {};
  let total = 0;

  for (const app of applications) {
    const channel = detectChannel(app.url);
    if (channel === "unknown") continue; // can't attribute — don't guess
    counts[channel] = (counts[channel] ?? 0) + 1;
    total += 1;
  }

  let dominant: ChannelMix["dominant"] = null;
  for (const [channel, count] of Object.entries(counts) as [Channel, number][]) {
    if (!dominant || count > dominant.count) {
      dominant = { channel, count, share: total > 0 ? count / total : 0 };
    }
  }

  const effectiveDraws = Object.keys(counts).length;
  const concentrated =
    total >= MIN_FOR_CLAIM && dominant !== null && dominant.share >= CONCENTRATION_THRESHOLD;

  return { total, counts, dominant, effectiveDraws, concentrated };
}

export type ChannelInsight = {
  /** The honest headline: what the numbers actually mean. */
  headline: string;
  /** Principle 5: every signal must resolve into something the user can DO. */
  action: string;
};

/**
 * Returns an insight ONLY when the data supports one.
 *
 * Deliberately silent when: too few applications (no evidence), or the mix is already
 * diversified (nothing to fix). We do not manufacture advice to look busy — an
 * unsourced nudge is exactly the folklore this platform exists to refuse.
 */
export function channelInsight(mix: ChannelMix): ChannelInsight | null {
  if (!mix.concentrated || !mix.dominant) return null;

  const { channel, count } = mix.dominant;
  const label = CHANNEL_LABEL[channel];
  const plural = count === 1 ? "" : "s";

  return {
    headline:
      `${count} of your ${mix.total} applications went through ${label}. ` +
      `Screening tools from the same vendor reject in correlated ways — so that's ` +
      `closer to 1 rejection repeated ${count} time${plural} than ${count} separate verdicts on you.`,
    action:
      `Send your next few through a different channel — a company's own careers page, ` +
      `a different ATS, or a referral. Different filter, genuinely new draw.`,
  };
}
