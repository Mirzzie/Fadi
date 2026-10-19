import { caseTable, churnCase, citedSignals, mentions, type ChurnCase } from "../sim/churn-case";
import type { PracticePack } from "../pack";
import type { Criterion } from "../rubric";

/**
 * THE FIRST NON-TECHNICAL PRACTICE PACK: a Customer Success Manager's quarterly churn review.
 *
 * A real, hireable task (CSM, account manager, client services): read a book of accounts, find
 * which will leave and why, decide what to do about it, and defend the call to a VP. Three steps,
 * each a document reviewed against a rubric. The case is generated per run (`churnCase`), so the
 * facts a good answer must contain differ for every person.
 *
 * Trust is EXPERIMENTAL: written by Fadi's maintainers, not yet reviewed by a named practitioner.
 * The model answers and fact checks below are the rubric adapter's assets — never shown in a step,
 * and an example answer is revealed only after the person's own work passes.
 */

export const CUSTOMER_SUCCESS_PACK: PracticePack = {
  schemaVersion: 1,
  id: "fadi.customer-success",
  version: "0.1.0",
  title: "Customer Success work simulations",
  domain: { id: "customer-success", label: "Customer Success" },
  license: "CC-BY-4.0",
  trust: "experimental",
  review: null,
  sources: [],
  activities: [
    {
      schemaVersion: 1,
      id: "churn-review",
      title: "Quarterly churn review for a B2B software company",
      outcome:
        "Identify which accounts are genuinely at risk of not renewing, separate real risk from noise, and write a retention plan you can defend to a VP of Customer Success.",
      competencies: [
        "Account health analysis",
        "Churn risk prioritisation",
        "Retention planning",
        "Executive communication",
      ],
      steps: [
        {
          id: "diagnose",
          title: "Find the accounts at risk",
          instruction:
            "Work through the account table. Which two accounts are most at risk of not renewing this quarter, in order? For each, say what in the data shows it. Is any account that looks alarming actually fine — and how can you tell? Write it as a short analysis (150–300 words).",
          environment: { kind: "document", adapter: null },
          assessment: { kind: "rubric", adapter: { id: "fadi.rubric", version: "1" } },
          outputs: [{ kind: "text", required: true }],
        },
        {
          id: "plan",
          title: "Write the retention plan",
          instruction:
            "Write a one-page memo to your VP (300–500 words): for each at-risk account, the actions you will take in the next 30 days, who owns each, and how you will know it worked. Say what you will NOT spend time on, and why.",
          environment: { kind: "document", adapter: null },
          assessment: { kind: "rubric", adapter: { id: "fadi.rubric", version: "1" } },
          outputs: [{ kind: "text", required: true }],
        },
        {
          id: "defend",
          title: "Defend your priorities",
          instruction:
            "Your VP replies: \"Why not give everyone a 15% renewal discount and be done with it?\" Answer in 100–250 words — what that would cost, what it would and wouldn't fix, and what you'd do instead.",
          environment: { kind: "document", adapter: null },
          assessment: { kind: "rubric", adapter: { id: "fadi.rubric", version: "1" } },
          outputs: [{ kind: "text", required: true }],
        },
      ],
    },
  ],
};

/** The brief every step of a run shows: the situation and this person's own account table. */
export function churnBrief(theCase: ChurnCase): string {
  return [
    `You are a Customer Success Manager at ${theCase.company}, a B2B software company. Renewals for the quarter are due soon and your VP wants your read on your book of six accounts before Friday.`,
    "",
    caseTable(theCase),
  ].join("\n");
}

type StepAssets = {
  criteria: Criterion<ChurnCase>[];
  /** Shown only after the person's own work passes. */
  exampleAnswer: (theCase: ChurnCase) => string;
};

/** The rubric adapter's assets for this activity, by step id. Never sent to the browser early. */
export const CHURN_REVIEW_ASSETS: Record<string, StepAssets> = {
  diagnose: {
    criteria: [
      {
        id: "names-risks",
        kind: "fact",
        label: "Names the two accounts genuinely most at risk",
        check: (text, c) => {
          const found = c.atRisk.filter((name) => mentions(text, name));
          return found.length === 2
            ? { met: true, seen: `You named both: ${c.atRisk.join(" and ")}.` }
            : {
                met: false,
                seen:
                  found.length === 1
                    ? `You found ${found[0]}, but missed another account the data puts at serious risk. Look again at sponsors and tickets past SLA, not only usage.`
                    : "Neither of the two highest-risk accounts is named. Compare renewal dates, tickets past SLA, usage change and sponsors together.",
              };
        },
      },
      {
        id: "spots-decoy",
        kind: "fact",
        label: "Recognises the account whose drop is seasonal, not churn",
        check: (text, c) => {
          const named = mentions(text, c.decoy);
          const seasonal =
            /seasonal|busy season|every year|always drops|cyclical|time of year/i.test(text);
          const flagged = c.atRisk.some((a) => mentions(text, a));
          return named && seasonal && flagged
            ? { met: true, seen: `You saw that ${c.decoy}'s drop is seasonal.` }
            : named && !seasonal
              ? {
                  met: false,
                  seen: `You mention ${c.decoy}, but treat its usage drop as risk. Check the CRM notes before raising an alarm.`,
                }
              : {
                  met: false,
                  seen: "One account's usage drop looks alarming but isn't churn. The CRM notes explain it.",
                };
        },
      },
      {
        id: "evidence",
        kind: "fact",
        label: "Backs each at-risk account with figures from the table",
        // Checked exactly, not judged: a small model said an answer full of figures had none.
        check: (text, c) => {
          const short = c.atRisk
            .map((name) => c.accounts.find((a) => a.name === name)!)
            .map((account) => ({ account, cited: citedSignals(text, account, c.accounts) }))
            .filter(({ cited }) => cited.length < 2);
          return short.length === 0
            ? { met: true, seen: "Each at-risk account is backed by at least two of its own figures." }
            : {
                met: false,
                seen: `Back ${short.map(({ account }) => account.name).join(" and ")} with at least two of its figures from the table (usage change, tickets past SLA, renewal timing, revenue or sponsor).`,
              };
        },
      },
    ],
    exampleAnswer: (c) =>
      `${c.atRisk[0]} is the most urgent: renewal is close, weekly active users have fallen sharply over 90 days and several tickets are past SLA — the customer is struggling and not being helped. ${c.atRisk[1]} is next: usage is softer and, more importantly, their executive sponsor has left, so nobody senior is championing renewal. ${c.decoy} looks alarming on usage alone, but the CRM notes say their usage always drops at this time of year; no tickets or sponsor change back up a churn story.`,
  },
  plan: {
    criteria: [
      {
        id: "covers-risks",
        kind: "fact",
        label: "The plan addresses both at-risk accounts",
        check: (text, c) =>
          c.atRisk.every((name) => mentions(text, name))
            ? { met: true, seen: "Both at-risk accounts have a plan." }
            : {
                met: false,
                seen: "The memo doesn't give each of the two at-risk accounts its own actions.",
              },
      },
      {
        id: "actions",
        kind: "quality",
        label: "Specific actions with owners and a 30-day timeline",
        meets:
          "Each at-risk account has concrete actions (not 'improve engagement'), each with an owner and a date or week.",
        strong:
          "Actions target the cause seen in the data (e.g. clearing breached tickets, finding a new sponsor) and are sequenced sensibly.",
      },
      {
        id: "measures",
        kind: "quality",
        label: "Says how success will be measured",
        meets:
          "States a measurable signal per account that would show the plan is working (e.g. tickets back within SLA, active users recovering, renewal call booked).",
        strong:
          "Sets a checkpoint and says what would trigger escalation if the signal doesn't move.",
      },
      {
        id: "tradeoff",
        kind: "quality",
        label: "Makes a deliberate trade-off",
        meets:
          "Names something they will not spend time on and why (e.g. the healthy accounts, or the seasonal decoy).",
        strong: "Ties the trade-off to revenue at risk or renewal timing.",
      },
    ],
    exampleAnswer: (c) =>
      `To: VP Customer Success — ${c.atRisk[0]}: this week, our support lead clears every ticket past SLA and I book a renewal-risk call with their operations owner; by week 2, a usage review session to win back inactive teams. Success: no breached tickets and weekly active users rising by week 4; if not, escalate to you before the renewal date. ${c.atRisk[1]}: their sponsor has gone, so I will find and meet the new budget holder within 10 days, with an executive-to-executive call from you in week 3. Success: a named sponsor and a renewal meeting booked. Not doing: ${c.decoy} — its dip is seasonal; I'll check in after their busy season instead of spending this month on it.`,
  },
  defend: {
    criteria: [
      {
        id: "cost",
        kind: "quality",
        label: "Explains the cost of a blanket discount",
        meets:
          "Recognises that discounting every account gives away revenue on accounts that would renew anyway.",
        strong:
          "Quantifies or reasons about it with the book's ARR (e.g. 15% across all six accounts versus the at-risk revenue).",
      },
      {
        id: "cause",
        kind: "quality",
        label: "Shows a discount doesn't fix the real causes",
        meets:
          "Points out that the at-risk accounts' problems (breached tickets, a lost sponsor) aren't price problems.",
        strong:
          "Says when a targeted concession could make sense, and what it would be conditional on.",
      },
      {
        id: "alternative",
        kind: "quality",
        label: "Offers a better alternative, firmly but respectfully",
        meets: "Proposes a concrete alternative tied to the plan.",
        strong: "Frames it in the VP's terms (revenue protected, effort, risk).",
      },
    ],
    exampleAnswer: (c) =>
      `A 15% discount across the book gives away revenue on four accounts that are on track to renew, including ${c.decoy}, whose dip is seasonal. And it fixes neither real problem: ${c.atRisk[0]} is leaving because tickets sit past SLA, and ${c.atRisk[1]} because nobody senior there owns us any more. Neither is a price problem. I'd rather fix service at the first and win a new sponsor at the second; if a concession helps close ${c.atRisk[1]}, make it targeted and tied to a multi-year renewal.`,
  },
};

export function churnCaseFor(seed: string): ChurnCase {
  return churnCase(seed);
}
