import type { LabFacts } from "./lab-facts";

/**
 * PLACES — where each step of a project happens, and what is true in each (verified-labs V-1).
 *
 * Lab platforms bind every action to a place (a terminal on a named host, a tab for a named
 * service) so nobody has to work out which machine an address belongs to. Fadi's planner gets
 * the same: the lab as observed, the person's own browser with the URLs that open there, and
 * what Fadi itself does. Pure, so the brief and its checks are pinned by tests.
 */

export type Place = "lab" | "browser" | "fadi";

export type PlacesInput = {
  labLabel: string;
  /** The OS the lab is meant to run, when it could not be observed. */
  expectedOs: string;
  facts: LabFacts | null;
  /** The person's own computer, for the browser place. */
  hostOs: string;
  services: Array<{
    label: string;
    /** Opens in the person's browser. */
    browserUrl: string;
    signIn: string;
    /** What the lab connects to, "host:port". */
    fromLab: string;
  }>;
};

export function placesBrief(input: PlacesInput): string {
  const f = input.facts;
  const has = f ? Object.entries(f.has) : [];
  const yes = has.filter(([, v]) => v).map(([k]) => k);
  const no = has.filter(([, v]) => !v).map(([k]) => k);
  const lab = f
    ? [
        `1. lab — ${input.labLabel}, OBSERVED just now: ${f.os}${f.build ? ` (build ${f.build})` : ""}, ${f.shell === "powershell" ? `PowerShell ${f.shellVersion ?? ""}`.trim() : "sh"}, signed in as ${f.account ?? "an administrator"}.`,
        yes.length ? `   Installed: ${yes.join(", ")}.` : "",
        no.length
          ? `   NOT installed (do not use; install it in a step first if it is truly needed): ${no.join(", ")}.`
          : "",
        `   Internet: ${f.internet === null ? "unknown" : f.internet ? "yes" : "NO — the lab cannot download anything"}.`,
        ...Object.entries(f.reaches).map(
          ([target, ok]) =>
            `   Reaches ${target}: ${ok ? "yes" : "not yet (the service may not be started)"}.`
        ),
      ]
    : [
        `1. lab — ${input.labLabel}: not observed (it is not running). Assume a clean ${input.expectedOs} with only its built-in tools: no Chrome, no git, no Docker.`,
      ];
  return [
    "PLACES — every step happens in exactly one place; set `where` to it:",
    ...lab.filter(Boolean),
    "   Inside the lab, 127.0.0.1 and localhost are the lab itself, never the person's computer.",
    `2. browser — the person's own browser on their ${input.hostOs} computer.${
      input.services.length
        ? ` Opens: ${input.services.map((s) => `${s.label} at ${s.browserUrl} (sign in ${s.signIn})`).join("; ")}.`
        : ""
    } Dashboards are opened HERE, not inside the lab.`,
    `3. fadi — Fadi does it after one click and approval on the project page${
      input.services.length
        ? `: starting or stopping ${input.services.map((s) => s.label).join(", ")} (under "Services beside the machine")`
        : ""
    }. Such a step tells the person which button to press.`,
    ...input.services.map(
      (s) => `From the lab, ${s.label} is reached at ${s.fromLab} — use that address in lab steps.`
    ),
    "Each step also gets a `check`: ONE read-only command run in the lab whose output contains `expect` only when the step worked (for a browser or fadi step, check what that step changed, from the lab).",
  ].join("\n");
}

const TOOL_WORDS: Record<string, RegExp> = {
  chrome: /\bchrome(?:\.exe)?\b/i,
  firefox: /\bfirefox(?:\.exe)?\b/i,
  git: /(?:^|[\s;|&(])git\s+(?:clone|pull|init|checkout)\b/i,
  docker: /(?:^|[\s;|&(])docker\s+(?:run|compose|pull|build|ps)\b/i,
  choco: /\bchoco\s+install\b/i,
};

/**
 * What a planned step gets wrong about its place, from the facts: a tool the lab doesn't have,
 * or a browser address used inside the lab.
 */
export function placeViolations(
  steps: Array<{ title: string; instruction: string; where?: string | null }>,
  input: PlacesInput
): string[] {
  const out = new Set<string>();
  const browserHosts = input.services.map((s) => {
    try {
      return new URL(s.browserUrl).host;
    } catch {
      return "";
    }
  });
  for (const step of steps) {
    if ((step.where ?? "lab") !== "lab") continue;
    const text = `${step.title}\n${step.instruction}`;
    for (const [tool, pattern] of Object.entries(TOOL_WORDS)) {
      const missing = input.facts ? input.facts.has[tool] === false : tool !== "edge";
      // Installing it in the same step is fine.
      if (missing && pattern.test(text) && !new RegExp(`install[^\\n]*${tool}`, "i").test(text)) {
        out.add(`${tool} in the lab, which is not installed there`);
      }
    }
    for (const host of browserHosts) {
      if (host && text.includes(host)) {
        out.add(
          `${host} in a lab step — that address is on the person's computer; open it in the browser place, and use the lab's own address for the service`
        );
      }
    }
  }
  return [...out];
}

/**
 * A planned check Fadi can actually run, or null. A check passes when its output CONTAINS
 * `expect`, so a comparison (">=1") never matches; and it runs on its own, so a variable it
 * never sets ("$log") is empty. Both were in the first plans with checks (15 Oct 2026). A
 * dropped check is not a failure: "Check it for me" then writes one at the time.
 */
export function usableCheck(
  check: { command?: string | null; expect?: string | null } | null | undefined
): { command: string; expect: string } | null {
  const command = check?.command?.trim() ?? "";
  const expect = check?.expect?.trim() ?? "";
  if (!command || !expect) return null;
  if (/^[<>=!]=?\s*-?\d/.test(expect)) return null;
  const used = [...command.matchAll(/\$([A-Za-z_]\w*)/g)].map((m) => m[1]!.toLowerCase());
  const set = new Set([
    ...[...command.matchAll(/\$([A-Za-z_]\w*)\s*=/g)].map((m) => m[1]!.toLowerCase()),
    // PowerShell's own variables.
    "_",
    "true",
    "false",
    "null",
    "env",
    "psitem",
    "args",
    "home",
    "pwd",
    "lastexitcode",
    "psversiontable",
    "error",
    "matches",
    "input",
    "pshome",
    "host",
  ]);
  if (used.some((name) => !set.has(name))) return null;
  return { command, expect };
}
