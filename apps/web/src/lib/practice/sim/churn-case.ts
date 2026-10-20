import { createHash } from "node:crypto";

/**
 * THE CASE FOR THE CUSTOMER-SUCCESS CHURN REVIEW — generated per run from a seed.
 *
 * A Customer Success Manager at a B2B software company is handed their book of accounts the week
 * before quarterly renewals and asked which ones will leave, why, and what to do. The figures
 * differ for every person (seeded), and the facts a good answer must contain — which accounts are
 * really at risk, which one only LOOKS at risk — are computed here from those figures, never
 * guessed by a model. A copied answer names the wrong accounts (CTF per-user flags, 17 Oct 2026).
 *
 * Pure and deterministic: the same seed always gives the same case, so a reset can replay it and a
 * review can recompute the facts without storing them.
 */

export type Account = {
  name: string;
  industry: string;
  /** Annual recurring revenue, in thousands. */
  arrK: number;
  /** Days until the renewal date. */
  renewalDays: number;
  /** Weekly active users now, and 90 days ago. */
  activeNow: number;
  active90: number;
  /** Support tickets opened in the last 30 days, and how many are still open past their SLA. */
  tickets30: number;
  ticketsBreached: number;
  /** Their executive sponsor left the customer in the last quarter. */
  sponsorLeft: boolean;
  /** Usage dips every year at this time (a seasonal business) — the trap. */
  seasonal: boolean;
};

export type ChurnCase = {
  seed: string;
  company: string;
  accounts: Account[];
  /** Computed: the two genuinely highest-risk accounts, most urgent first. */
  atRisk: [string, string];
  /** Computed: the account whose usage drop is seasonal, not churn. */
  decoy: string;
};

const NAMES = [
  "Northwind Logistics",
  "Halcyon Health",
  "Brightwater Retail",
  "Kestrel Manufacturing",
  "Juniper Legal",
  "Atlas Freight",
  "Meridian Clinics",
  "Saffron Foods",
  "Cobalt Engineering",
  "Willow Education",
];
/** Each account's industry follows from its name — "Northwind Logistics" is in logistics. */
const INDUSTRY_OF: Record<string, string> = {
  "Northwind Logistics": "logistics",
  "Halcyon Health": "healthcare",
  "Brightwater Retail": "retail",
  "Kestrel Manufacturing": "manufacturing",
  "Juniper Legal": "legal services",
  "Atlas Freight": "logistics",
  "Meridian Clinics": "healthcare",
  "Saffron Foods": "food & beverage",
  "Cobalt Engineering": "engineering",
  "Willow Education": "education",
};
const COMPANIES = ["Relay", "Tessellate", "Ledgerline", "Orbitly"];

/** A small deterministic stream of numbers from the seed (SHA-256 counter mode). */
function stream(seed: string) {
  let counter = 0;
  let pool: number[] = [];
  return () => {
    if (pool.length === 0) {
      pool = [...createHash("sha256").update(`${seed}:${counter++}`).digest()];
    }
    return pool.shift()! / 256;
  };
}

/** Risk from the signals a CSM is taught to read. Renewal soon raises urgency. */
export function riskScore(account: Account): number {
  const usageDrop = account.active90 > 0 ? 1 - account.activeNow / account.active90 : 0;
  const realDrop = account.seasonal ? 0 : Math.max(0, usageDrop);
  const urgency = account.renewalDays <= 45 ? 1.3 : account.renewalDays <= 90 ? 1.1 : 1;
  return (realDrop * 50 + account.ticketsBreached * 6 + (account.sponsorLeft ? 25 : 0)) * urgency;
}

export function churnCase(seed: string): ChurnCase {
  const next = stream(seed);
  const pick = <T>(list: T[]) => list[Math.floor(next() * list.length)]!;
  const shuffle = <T>(list: T[]): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  const names = shuffle(NAMES).slice(0, 6);

  // Two real risks, one decoy, three healthy accounts — shuffled.
  const roles = shuffle(["risk-usage", "risk-sponsor", "decoy", "healthy", "healthy", "healthy"]);
  const accounts: Account[] = names.map((name, i) => {
    const role = roles[i]!;
    const active90 = 40 + Math.floor(next() * 160);
    const base = {
      name,
      // The draw stays (discarded) so every seed's figures and facts are exactly what they were;
      // only the shown industry changed, and now matches the name (browser pass, 19 Oct 2026).
      industry: (next(), INDUSTRY_OF[name] ?? "services"),
      arrK: 30 + Math.floor(next() * 220),
      renewalDays: 20 + Math.floor(next() * 150),
      active90,
      tickets30: 1 + Math.floor(next() * 4),
      ticketsBreached: 0,
      sponsorLeft: false,
      seasonal: false,
    };
    if (role === "risk-usage") {
      return {
        ...base,
        renewalDays: 25 + Math.floor(next() * 30),
        activeNow: Math.round(active90 * (0.35 + next() * 0.15)),
        tickets30: 6 + Math.floor(next() * 5),
        ticketsBreached: 3 + Math.floor(next() * 3),
      };
    }
    if (role === "risk-sponsor") {
      return {
        ...base,
        renewalDays: 35 + Math.floor(next() * 40),
        activeNow: Math.round(active90 * (0.7 + next() * 0.1)),
        sponsorLeft: true,
        tickets30: 3 + Math.floor(next() * 3),
        ticketsBreached: 1 + Math.floor(next() * 2),
      };
    }
    if (role === "decoy") {
      return {
        ...base,
        activeNow: Math.round(active90 * (0.4 + next() * 0.1)),
        seasonal: true,
        tickets30: 1,
      };
    }
    return { ...base, activeNow: Math.round(active90 * (0.95 + next() * 0.2)) };
  });

  const ranked = [...accounts].sort((a, b) => riskScore(b) - riskScore(a));
  return {
    seed,
    company: pick(COMPANIES),
    accounts,
    atRisk: [ranked[0]!.name, ranked[1]!.name],
    decoy: accounts.find((a) => a.seasonal)!.name,
  };
}

/** The account table the person works from, as markdown. No conclusions in it. */
export function caseTable(c: ChurnCase): string {
  const rows = c.accounts.map((a) => {
    const change = Math.round(((a.activeNow - a.active90) / a.active90) * 100);
    return `| ${a.name} | ${a.industry} | $${a.arrK}k | ${a.renewalDays} days | ${a.activeNow} (${change >= 0 ? "+" : ""}${change}% in 90 days) | ${a.tickets30} (${a.ticketsBreached} past SLA) | ${a.sponsorLeft ? "Left last quarter" : "In place"} |`;
  });
  const seasonalNote = c.accounts
    .filter((a) => a.seasonal)
    .map(
      (a) =>
        `- ${a.name}'s account notes: "Usage always drops in this period; their busy season is the other half of the year."`
    );
  return [
    "| Account | Industry | ARR | Renewal in | Weekly users | Tickets, 30 days | Exec sponsor |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "Notes from the CRM:",
    ...seasonalNote,
    "- Every account is on the same plan and price list.",
  ].join("\n");
}

/** Does the text name this account? Matches the distinctive first word (e.g. "Northwind"). */
export function mentions(text: string, account: string): boolean {
  const first = account.split(" ")[0]!;
  return new RegExp(`\\b${first}\\b`, "i").test(text);
}

/**
 * Which of THIS account's own figures the text cites near its name — from where the account is
 * named to where the next account is named. Exact, model-free, and specific to the person's case:
 * the numbers from someone else's case don't match (browser pass, 19 Oct 2026: a 4B local model
 * said an answer full of figures had none, three times out of three).
 */
export function citedSignals(text: string, account: Account, all: Account[]): string[] {
  const firstWord = (name: string) => name.split(" ")[0]!;
  const starts = (name: string) =>
    [...text.matchAll(new RegExp(`\\b${firstWord(name)}\\b`, "gi"))].map((m) => m.index!);
  const own = starts(account.name);
  if (own.length === 0) return [];
  const otherStarts = all
    .filter((a) => a.name !== account.name)
    .flatMap((a) => starts(a.name))
    .sort((x, y) => x - y);
  // Every passage about this account: from each mention to the next mention of another account.
  const window = own
    .map((at) => text.slice(at, otherStarts.find((o) => o > at) ?? text.length))
    .join(" ");
  const has = (n: number) => new RegExp(`(?<![\\d.])${n}(?![\\d])`).test(window);
  const change = Math.abs(
    Math.round(((account.activeNow - account.active90) / account.active90) * 100)
  );
  const signals: string[] = [];
  if (has(change) && /%|percent|halv/i.test(window)) signals.push("usage change");
  else if (has(account.activeNow) && has(account.active90)) signals.push("usage change");
  if (account.ticketsBreached > 0 && has(account.ticketsBreached) && /sla/i.test(window)) {
    signals.push("tickets past SLA");
  }
  if (has(account.renewalDays) && /day|renew/i.test(window)) signals.push("renewal timing");
  if (has(account.arrK) && /k\b|\$|arr|revenue/i.test(window)) signals.push("revenue");
  if (account.sponsorLeft && /sponsor|champion|executive/i.test(window))
    signals.push("sponsor change");
  return signals;
}
