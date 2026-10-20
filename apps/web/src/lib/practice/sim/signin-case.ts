import { createHash } from "node:crypto";

/**
 * THE CASE FOR THE SUSPICIOUS SIGN-INS INCIDENT — generated per run from a seed.
 *
 * A security operations analyst at a small company is handed a morning's sign-in log after an
 * alert, and must work out what happened: was it an attack, which kind, from where, did any
 * account fall, and which alarming-looking activity is innocent. The log differs for every
 * person (seeded), and the answers are computed here from how the log was built, never guessed
 * by a model, so a writeup copied from someone else's case names the wrong account and address.
 *
 * Addresses come only from the documentation ranges (RFC 5737: 192.0.2.0/24, 198.51.100.0/24,
 * 203.0.113.0/24), so nothing in a case points at a real host.
 *
 * Pure and deterministic: the same seed always gives the same case.
 */

export type AttackKind = "password-spray" | "brute-force";
/** How the attacker got past MFA on the account that fell. */
export type Bypass = "legacy-protocol" | "mfa-fatigue";
/** The innocent activity that looks like part of the attack. */
export type DecoyKind = "locked-out" | "traveller";

export type SignIn = {
  /** Minutes after 00:00 UTC on the case date. */
  minute: number;
  user: string;
  ip: string;
  network: string;
  country: string;
  app: string;
  result: "Success" | "Failure";
  detail: string;
};

export type SigninCase = {
  seed: string;
  company: string;
  domain: string;
  date: string;
  users: string[];
  log: SignIn[];
  /** Computed answers. */
  attack: AttackKind;
  attackerIp: string;
  compromised: string;
  bypass: Bypass;
  decoy: string;
  decoyKind: DecoyKind;
  /** Times (minutes) the timeline must be built from. */
  firstAttempt: number;
  compromisedAt: number;
};

const FIRST = [
  "aoife",
  "ciaran",
  "niamh",
  "darragh",
  "sinead",
  "eoin",
  "grainne",
  "padraig",
  "roisin",
  "tadhg",
  "orla",
  "cillian",
];
const LAST = ["byrne", "walsh", "kelly", "doyle", "murphy", "ryan", "brennan", "lynch", "nolan"];
const COMPANIES = [
  { name: "Northbay Logistics", domain: "northbay.ie" },
  { name: "Clearwater Dental Group", domain: "clearwaterdental.ie" },
  { name: "Ardmore Accountants", domain: "ardmore-acc.ie" },
  { name: "Kilbride Engineering", domain: "kilbride-eng.ie" },
];
const HOSTING = [
  { country: "NL", network: "Hosting provider (VPS)" },
  { country: "RO", network: "Hosting provider (VPS)" },
  { country: "US", network: "Hosting provider (cloud)" },
  { country: "SG", network: "Hosting provider (VPS)" },
];

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

export function signinCase(seed: string): SigninCase {
  const next = stream(seed);
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(list: T[]) => list[Math.floor(next() * list.length)]!;
  const shuffle = <T>(list: T[]): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };

  const company = pick(COMPANIES);
  const firsts = shuffle(FIRST).slice(0, 8);
  const users = firsts.map((f) => `${f}.${pick(LAST)}@${company.domain}`);
  const officeIp = `203.0.113.${int(10, 40)}`;
  const homeIps = users.map(() => `192.0.2.${int(20, 230)}`);
  const host = pick(HOSTING);
  const attackerIp = `198.51.100.${int(10, 240)}`;
  const attack: AttackKind = next() < 0.5 ? "password-spray" : "brute-force";
  const bypass: Bypass = next() < 0.5 ? "legacy-protocol" : "mfa-fatigue";
  const decoyKind: DecoyKind = next() < 0.5 ? "locked-out" : "traveller";

  // Roles: the account that falls, the innocent decoy, everyone else ordinary.
  const [compromisedIdx, decoyIdx] = shuffle(users.map((_, i) => i));
  const compromised = users[compromisedIdx!]!;
  const decoy = users[decoyIdx!]!;

  const log: SignIn[] = [];
  const day = `2026-10-${String(int(5, 16)).padStart(2, "0")}`;

  // Ordinary morning: office and home sign-ins, all succeeding with MFA.
  for (const [i, user] of users.entries()) {
    const fromHome = next() < 0.4;
    // The decoy's own sign-ins tell their story below: a locked-out account can't sign in
    // normally before its reset, and a traveller isn't at home (case review, 20 Oct 2026).
    if (user === decoy) continue;
    log.push({
      minute: int(470, 560),
      user,
      ip: fromHome ? homeIps[i]! : officeIp,
      network: fromHome ? "Eir broadband (home)" : `${company.name} office`,
      country: "IE",
      app: pick(["Outlook", "Teams", "SharePoint"]),
      result: "Success",
      detail: "MFA passed (app)",
    });
  }

  // The attack, in the small hours.
  const start = int(130, 200);
  let t = start;
  if (attack === "password-spray") {
    // One or two tries per account across the whole company: low and slow.
    for (const user of shuffle(users)) {
      const tries = user === compromised ? 1 : int(1, 2);
      for (let k = 0; k < tries; k++) {
        t += int(2, 6);
        if (user === compromised) break;
        log.push({
          minute: t,
          user,
          ip: attackerIp,
          network: host.network,
          country: host.country,
          app: bypass === "legacy-protocol" ? "IMAP" : "Outlook",
          result: "Failure",
          detail: "Invalid password",
        });
      }
    }
  } else {
    // Many tries against one account, seconds apart.
    const tries = int(9, 14);
    for (let k = 0; k < tries; k++) {
      t += 1;
      log.push({
        minute: t,
        user: compromised,
        ip: attackerIp,
        network: host.network,
        country: host.country,
        app: bypass === "legacy-protocol" ? "IMAP" : "Outlook",
        result: "Failure",
        detail: "Invalid password",
      });
    }
  }

  // The account falls.
  if (bypass === "mfa-fatigue") {
    const denials = int(3, 5);
    for (let k = 0; k < denials; k++) {
      t += int(1, 3);
      log.push({
        minute: t,
        user: compromised,
        ip: attackerIp,
        network: host.network,
        country: host.country,
        app: "Outlook",
        result: "Failure",
        detail: "MFA denied · password correct",
      });
    }
  }
  t += int(1, 4);
  const compromisedAt = t;
  log.push({
    minute: t,
    user: compromised,
    ip: attackerIp,
    network: host.network,
    country: host.country,
    app: bypass === "legacy-protocol" ? "IMAP" : "Outlook",
    result: "Success",
    detail: bypass === "legacy-protocol" ? "Legacy auth · no MFA" : "MFA approved by user",
  });

  // The innocent activity that looks like part of it.
  const decoyHome = homeIps[decoyIdx!]!;
  if (decoyKind === "locked-out") {
    const at = int(420, 450);
    const fails = int(5, 7);
    for (let k = 0; k < fails; k++) {
      log.push({
        minute: at + k,
        user: decoy,
        ip: decoyHome,
        network: "Eir broadband (home)",
        country: "IE",
        app: "Outlook",
        result: "Failure",
        detail: k === fails - 1 ? "Account locked" : "Invalid password",
      });
    }
    log.push({
      minute: at + fails + int(15, 25),
      user: decoy,
      ip: decoyHome,
      network: "Eir broadband (home)",
      country: "IE",
      app: "Outlook",
      result: "Success",
      detail: "MFA passed (app) · reset by helpdesk",
    });
  } else {
    log.push({
      minute: int(300, 380),
      user: decoy,
      // Its own range, so it can never be the attacker's address.
      ip: `203.0.113.${int(200, 250)}`,
      network: "Hotel Wi-Fi",
      country: pick(["ES", "PT", "FR"]),
      app: "Outlook",
      result: "Success",
      detail: "MFA passed (number match) · known device",
    });
  }

  log.sort((a, b) => a.minute - b.minute);
  return {
    seed,
    company: company.name,
    domain: company.domain,
    date: day,
    users,
    log,
    attack,
    attackerIp,
    compromised,
    bypass,
    decoy,
    decoyKind,
    firstAttempt: Math.min(...log.filter((e) => e.ip === attackerIp).map((e) => e.minute)),
    compromisedAt,
  };
}

/** The analyst picks the alert up at 09:30 UTC: the log runs to here and no further. */
export const SIGNIN_CUTOFF = 9 * 60 + 30;

export function clock(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/** The sign-in log the person works from, as markdown. No conclusions in it. */
export function signinTable(c: SigninCase): string {
  // Evidence first: what happened (result, detail) before where from. The columns that settle
  // the case must be visible without scrolling the log sideways (browser check, 20 Oct 2026).
  const rows = c.log.map(
    (e) =>
      `| ${clock(e.minute)} | ${e.user.split("@")[0]} | ${e.result} | ${e.detail} | ${e.ip} | ${e.network} | ${e.country} | ${e.app} |`
  );
  return [
    "| Time (UTC) | User | Result | Detail | IP address | Network | Country | App |",
    "|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "Notes from the IT team:",
    `- Every account is on ${c.domain}; the log shows the part before the @.`,
    `- Staff work from the office (${c.log.find((e) => e.network.endsWith("office"))?.ip ?? "203.0.113.0/24"}) or from home; nobody works overnight.`,
    "- Conditional access requires MFA for modern sign-ins. Older mail protocols (IMAP, POP, SMTP) are still enabled for a scanner and an old CRM.",
    c.decoyKind === "traveller"
      ? "- One member of staff is at a conference abroad this week."
      : "- The helpdesk handled one password reset this morning.",
  ].join("\n");
}

/** Every IP address in the log, in first-seen order: the options for the source pick. */
export function signinIps(c: SigninCase): string[] {
  return [...new Set(c.log.map((e) => e.ip))];
}

/**
 * Does the text cite the attack's own specifics near each other? Exact and model-free, like the
 * churn review's figures check: the attacker's address, and the time the account fell.
 */
export function citesIncident(text: string, c: SigninCase): { ip: boolean; time: boolean } {
  return {
    ip: text.includes(c.attackerIp),
    time: text.includes(clock(c.compromisedAt)),
  };
}
