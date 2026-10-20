import type { PracticePack } from "../pack";
import type { ChoiceField, Criterion } from "../rubric";
import {
  SIGNIN_CUTOFF,
  citesIncident,
  clock,
  signinCase,
  signinIps,
  signinTable,
  type AttackKind,
  type SigninCase,
} from "../sim/signin-case";

/**
 * THE FIRST SECURITY OPERATIONS PACK: investigate a morning's suspicious sign-ins.
 *
 * Built for the owner's secondary track (Identity & Security Operations) and their proof gap:
 * "incident write-ups with symptoms, logs, root cause and resolution" (career research,
 * 20 Oct 2026). Three steps that end in a write-up worth putting behind a portfolio link:
 * triage, the first hour's response, and the incident report. The log is generated per run, so
 * the account, the address and the times a good answer must contain differ for every person.
 *
 * Trust is EXPERIMENTAL: written by Fadi's maintainers, not yet reviewed by a security
 * practitioner. The marking check a model must pass is still the churn-review one (rubric-eval
 * v2); a security-specific evaluation set is the follow-up (ADR 0015, contract 8).
 */

export const SECURITY_OPERATIONS_PACK: PracticePack = {
  schemaVersion: 1,
  id: "fadi.security-operations",
  // 0.2.0 (20 Oct 2026, Codex review): evidence cutoff stated, report must separate known from
  // unknown, response guidance corrected against Microsoft's documentation.
  version: "0.2.0",
  title: "Security operations work simulations",
  domain: { id: "security-operations", label: "Security Operations" },
  license: "CC-BY-4.0",
  trust: "experimental",
  review: null,
  // The primary sources the response guidance and example answers follow.
  sources: [
    {
      title: "Microsoft Entra: Revoke user access in an emergency",
      url: "https://learn.microsoft.com/en-us/entra/identity/users/users-revoke-access",
      checkedAt: "2026-10-20T19:45:00Z",
    },
    {
      title: "Microsoft Entra: Block legacy authentication with Conditional Access",
      url: "https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-block-legacy-authentication",
      checkedAt: "2026-10-20T19:45:00Z",
    },
  ],
  activities: [
    {
      schemaVersion: 1,
      id: "suspicious-sign-ins",
      title: "Investigate suspicious sign-ins at a small company",
      outcome:
        "Work out from a sign-in log what happened overnight, contain the account that fell, and write the incident report an IT manager can act on.",
      competencies: [
        "Sign-in log analysis",
        "Identity attack recognition",
        "Incident containment",
        "Incident reporting",
      ],
      steps: [
        {
          id: "triage",
          title: "Triage the alert",
          instruction:
            "Work through the sign-in log. Pick what happened, where it came from, which account (if any) was taken over, and which alarming-looking activity is innocent. Then explain your calls in a short triage note (150–300 words): what in the log shows each one.",
          environment: { kind: "document", adapter: null },
          assessment: { kind: "rubric", adapter: { id: "fadi.rubric", version: "1" } },
          // The picks are stored inside the text attempt (rubric.composeAnswer).
          outputs: [{ kind: "text", required: true }],
        },
        {
          id: "contain",
          title: "Run the first hour",
          instruction:
            "Write the first-hour plan for the on-call IT lead (150–300 words): what you do right now and in what order, what you check to find out what the attacker did with the account, and what you change so it can't happen the same way again.",
          environment: { kind: "document", adapter: null },
          assessment: { kind: "rubric", adapter: { id: "fadi.rubric", version: "1" } },
          outputs: [{ kind: "text", required: true }],
        },
        {
          id: "report",
          title: "Write the incident report",
          instruction:
            "Write the incident report for the IT manager (250–450 words): a short summary, a timeline with times from the log, the impact (what is known and what isn't yet), the root cause, the actions recommended or taken (say which), and what will prevent a repeat.",
          environment: { kind: "document", adapter: null },
          assessment: { kind: "rubric", adapter: { id: "fadi.rubric", version: "1" } },
          outputs: [{ kind: "text", required: true }],
        },
      ],
    },
  ],
};

/** The brief every step shows: the situation and this person's own log. */
export function signinBrief(c: SigninCase): string {
  return [
    `You're the security operations analyst on call for ${c.company} (${c.domain}). At 08:00 on ${c.date} an alert fired for unusual sign-in activity overnight. You pick it up at ${clock(SIGNIN_CUTOFF)}. This is the sign-in log from midnight to ${clock(SIGNIN_CUTOFF)} UTC, and it's all the evidence you have so far.`,
    "",
    signinTable(c),
  ].join("\n");
}

const NONE_ACCOUNT = "No account was taken over";
const NONE_BENIGN = "None of them";
const NO_SOURCE = "No single source";
const ATTACK_LABEL: Record<AttackKind | "none", string> = {
  "password-spray": "Password spray across many accounts",
  "brute-force": "Brute force against one account",
  none: "No attack: ordinary activity",
};

/** Does the text name this account (full address or the part before @)? */
function namesAccount(text: string, upn: string): boolean {
  const local = upn.split("@")[0]!;
  return text.toLowerCase().includes(local.toLowerCase());
}

type StepAssets = {
  criteria: Criterion<SigninCase>[];
  choices?: (c: SigninCase) => ChoiceField[];
  hints: string[];
  exampleAnswer: (c: SigninCase) => string;
};

export const SUSPICIOUS_SIGNINS_ASSETS: Record<string, StepAssets> = {
  triage: {
    choices: (c) => [
      { id: "attack", label: "What happened", options: Object.values(ATTACK_LABEL) },
      { id: "source", label: "Where it came from", options: [...signinIps(c), NO_SOURCE] },
      { id: "account", label: "Account taken over", options: [...c.users, NONE_ACCOUNT] },
      {
        id: "benign",
        label: "Looks suspicious but is innocent",
        options: [...c.users, NONE_BENIGN],
      },
    ],
    criteria: [
      {
        id: "attack-kind",
        kind: "fact",
        label: "Recognises the kind of attack",
        check: ({ choices }, c) =>
          choices.attack === ATTACK_LABEL[c.attack]
            ? { met: true, seen: "You read the pattern correctly." }
            : {
                met: false,
                seen: "Look at how many accounts the failures hit, and how many tries each got. A spray and a brute force leave different shapes in a log.",
              },
      },
      {
        id: "source",
        kind: "fact",
        label: "Finds where it came from",
        check: ({ choices }, c) =>
          choices.source === c.attackerIp
            ? { met: true, seen: `You traced it to ${c.attackerIp}.` }
            : {
                met: false,
                seen: "Group the failures by IP address and network. Which one doesn't belong to how this company works?",
              },
      },
      {
        id: "account",
        kind: "fact",
        label: "Finds the account that was taken over",
        check: ({ choices }, c) =>
          choices.account === c.compromised
            ? { met: true, seen: "You found the account that fell." }
            : {
                met: false,
                seen: "Look for a success from the same address that produced the failures, and read its Detail column.",
              },
      },
      {
        id: "benign",
        kind: "fact",
        label: "Recognises the innocent activity",
        check: ({ choices }, c) =>
          choices.benign === c.decoy
            ? { met: true, seen: "You saw which alarming-looking activity is innocent." }
            : {
                met: false,
                seen: "One person's activity looks bad on its own. Check where it came from, how MFA went, and the IT team's notes.",
              },
      },
      {
        id: "evidence",
        kind: "fact",
        label: "Cites the log: the source address and the time the account fell",
        check: ({ text }, c) => {
          const cited = citesIncident(text, c);
          return cited.ip && cited.time
            ? { met: true, seen: "Your note points at the exact address and time." }
            : {
                met: false,
                seen: `Quote the log: ${[cited.ip ? null : "the source address", cited.time ? null : "the time (UTC) of the successful sign-in"].filter(Boolean).join(" and ")}.`,
              };
        },
      },
      {
        id: "explains",
        kind: "quality",
        label: "Explains the calls from the log",
        meets:
          "Says what pattern shows the kind of attack (many accounts with few tries, or one account with many), what shows the account fell, and why the alarming-looking activity is innocent.",
        strong:
          "Says how the attacker got past MFA on that account and what that means for the response.",
      },
    ],
    hints: [
      "Sort the log by IP address in your head. Ordinary staff activity has a shape; the attack has a different one.",
      "A password spray tries one or two passwords against many accounts to stay under lockout limits. A brute force hammers one account. Either way, a success from the attacking address is what turns an attempt into an incident.",
      "For each IP address, note the network, the country, the time of day, how many accounts it touched and whether anything succeeded. Then read the Detail column on that success: it tells you how MFA was handled. Finally, check the IT team's notes against anything else that looks odd.",
    ],
    exampleAnswer: (c) =>
      `${ATTACK_LABEL[c.attack]} from ${c.attackerIp}, a hosting-provider address with no reason to be signing in to ${c.company} at night. ${c.attack === "password-spray" ? "It tried one or two passwords against nearly every account, staying under lockout limits," : "It tried one account repeatedly, seconds apart,"} and at ${clock(c.compromisedAt)} UTC it signed in as ${c.compromised} — ${c.bypass === "legacy-protocol" ? "over IMAP, a legacy protocol that conditional access doesn't put MFA on" : "after several MFA prompts were denied, one was approved: MFA fatigue"}. ${c.decoy}'s activity looks alarming but isn't part of it: ${c.decoyKind === "locked-out" ? "the failures came from their usual home address, ended in a lockout, and the helpdesk reset their password" : "it's a sign-in from abroad on a registered device with number-matched MFA, and the IT team noted someone is at a conference"}.`,
  },
  contain: {
    criteria: [
      {
        id: "names-target",
        kind: "fact",
        label: "Acts on this incident: the account and the address",
        check: ({ text }, c) => {
          const account = namesAccount(text, c.compromised);
          const ip = text.includes(c.attackerIp);
          return account && ip
            ? { met: true, seen: "Your plan names the account and the address it acts on." }
            : {
                met: false,
                seen: `Name ${[account ? null : "the account you're containing", ip ? null : "the address you're blocking"].filter(Boolean).join(" and ")}: an on-call lead can't act on "the user" or "the IP".`,
              };
        },
      },
      {
        id: "contain",
        kind: "quality",
        label: "Contains the account first",
        meets:
          "Before investigating, cuts the attacker off: disables the account or revokes its sessions, resets the password, and blocks the source address.",
        strong:
          "Knows the limit: revoking sessions stops new tokens, but access already granted can last until it expires (often up to an hour), so the account stays disabled while it's investigated.",
      },
      {
        id: "scope",
        kind: "quality",
        label: "Finds out what the attacker did",
        meets:
          "Checks what happened after the sign-in: mailbox rules and forwarding, sent mail, files accessed, and whether the same address reached other accounts.",
        strong:
          "Preserves the evidence (exports the logs) before changing anything that would overwrite it.",
      },
      {
        id: "root-cause",
        kind: "quality",
        label: "Closes the way in",
        meets:
          "Names the specific gap that let the attacker past MFA in this log, and a control that actually closes it, not a workaround that leaves the same gap open.",
        strong:
          "Handles the business reason the gap exists (what still depends on it, and how to move that safely, e.g. finding it in the logs and testing a block in report-only mode first).",
      },
    ],
    hints: [
      "Ask what the attacker can still do right now, and stop that before anything else.",
      "Containment, then scoping, then fixing the cause. A password reset alone doesn't end access the attacker already has: disable the account and revoke its sessions, and know that access already granted can last until its tokens expire. Attackers in a mailbox often add a forwarding rule to keep watching.",
      "Structure: right now (in order) → what to check, and what to save first → the change that closes the specific way in → who needs to know.",
    ],
    // Follows Microsoft's emergency-revocation and legacy-auth guidance (pack sources).
    exampleAnswer: (c) =>
      `Right now: disable ${c.compromised}, revoke its sessions and reset the password, then block ${c.attackerIp}. Revoking sessions stops new tokens, but access already granted can last until it expires (up to about an hour), which is why the account stays disabled while we look. Before changing anything else, export the sign-in and mailbox audit logs. Then check the account's inbox rules and forwarding, sent items since ${clock(c.compromisedAt)} UTC and file access, and whether ${c.attackerIp} got anywhere with any other account. To close the way in: ${c.bypass === "legacy-protocol" ? "find everything still using IMAP, POP or SMTP in the sign-in logs (the client app column), move the scanner and the old CRM to modern authentication (OAuth), then block legacy authentication with conditional access, in report-only mode first to confirm nothing else breaks. App passwords wouldn't help: they still use the legacy protocol" : "turn on number matching and limit repeated MFA prompts, and tell staff to report unexpected prompts rather than approve them"}. Tell the IT manager and the account owner today.`,
  },
  report: {
    criteria: [
      {
        id: "timeline-times",
        kind: "fact",
        label: "The timeline uses the log's own times",
        check: ({ text }, c) => {
          const first = text.includes(clock(c.firstAttempt));
          const fell = text.includes(clock(c.compromisedAt));
          return first && fell
            ? { met: true, seen: "Your timeline starts and turns where the log does." }
            : {
                met: false,
                seen: `Put the log's times in the timeline: ${[first ? null : "when the attack started", fell ? null : "when the account was taken over"].filter(Boolean).join(" and ")}.`,
              };
        },
      },
      {
        id: "summary-impact",
        kind: "quality",
        label: "Summary and impact a manager can act on",
        meets:
          "Opens with a short summary of what happened, and states the impact honestly: what is known and what is not yet known.",
        strong: "Says how sure the conclusions are and what would change them.",
      },
      {
        id: "root-cause",
        kind: "quality",
        label: "Root cause, not just symptoms",
        meets:
          "Explains why the attack succeeded (the specific gap in how sign-ins are protected), not only that a password was guessed.",
        strong: "Separates the cause from contributing factors.",
      },
      {
        id: "known-unknown",
        kind: "quality",
        label: "Separates what is known from what isn't",
        meets:
          "States only what the sign-in log supports. Marks actions as recommended or pending unless the case says they happened, and names what still has to be checked (such as mailbox and file activity) instead of declaring it clean.",
        strong: "Says what evidence would confirm or change the conclusions.",
      },
      {
        id: "prevention",
        kind: "quality",
        label: "Actions and prevention, kept apart",
        meets:
          "Lists the response actions, then what will prevent a repeat, each specific enough to check later.",
        strong: "Gives each prevention step an owner or a date.",
      },
    ],
    hints: [
      "Write it for someone who wasn't there and has to decide what happens next.",
      "A good incident report separates what happened (timeline), why (root cause), what it cost (impact, known and unknown), what was done, and what changes. Honest uncertainty is a strength: managers act on it.",
      "Structure: summary (3–4 sentences) → timeline with times from the log → impact → root cause → actions taken → prevention, each with an owner.",
    ],
    // Only what the log shows is stated as fact; actions are recommendations, impact is open.
    exampleAnswer: (c) =>
      `Summary: on ${c.date} an attacker ${c.attack === "password-spray" ? "sprayed passwords across our accounts" : "brute-forced one account"} from ${c.attackerIp} and signed in as ${c.compromised} at ${clock(c.compromisedAt)} UTC. Timeline: ${clock(c.firstAttempt)} first attempt; ${clock(c.compromisedAt)} successful sign-in; 08:00 alert. Recommended response (pending confirmation): disable the account, revoke its sessions, reset the password, block the address. Impact: the attacker had access from ${clock(c.compromisedAt)} until the account is disabled. What they did with it is not yet known: the mailbox rules, sent items and file activity still have to be checked in the audit logs, so data exposure can't be ruled in or out yet. Root cause: ${c.bypass === "legacy-protocol" ? "IMAP was still enabled, and conditional access doesn't apply MFA to legacy protocols" : "the user approved an MFA prompt after repeated pushes; prompts didn't require number matching"}. Prevention: ${c.bypass === "legacy-protocol" ? "move the scanner and CRM to modern authentication, then block legacy authentication (IT lead, two weeks)" : "number matching and prompt limits (IT lead, this week); a short staff note on unexpected prompts"}.`,
  },
};

export function signinCaseFor(seed: string): SigninCase {
  return signinCase(seed);
}
