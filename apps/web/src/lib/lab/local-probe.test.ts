import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * THE GUARD THAT MATTERS FOR LOCAL EXECUTION.
 *
 * Fadi reads untrusted text by design — job descriptions, imported notes, portfolio
 * feedback from strangers. One oracle case already carries "ignore all validation rules".
 * A model that reads that AND can run commands is prompt injection with local execution,
 * and no amount of binding to 127.0.0.1 changes it.
 *
 * The protection is structural, so the test is structural: the command list must stay a
 * fixed set of literals, and nothing may reach the executor from a caller, a request or
 * a model. These read the source, because that is where the property lives — a
 * behavioural test would pass on a version that had grown one dangerous parameter.
 */
const SRC = readFileSync(join(process.cwd(), "src/lib/lab/local-probe.ts"), "utf8");

describe("local probing cannot be steered from outside", () => {
  it("never uses a shell", () => {
    // execFile with an argument array has no string for an injected quote to escape.
    expect(SRC).toContain('from "node:child_process"');
    expect(SRC).not.toMatch(/\bexec\s*\(/);
    expect(SRC).not.toMatch(/\bspawn\s*\(|shell\s*:\s*true/);
  });

  it("builds no command or argument from a template", () => {
    // A backtick inside the PROBES list would mean something outside decides what runs.
    const probes = SRC.slice(SRC.indexOf("const PROBES"), SRC.indexOf("export type LocalScan"));
    expect(probes).not.toMatch(/`/);
    expect(probes).not.toMatch(/\$\{/);
  });

  it("takes no parameters — there is no input to smuggle anything through", () => {
    expect(SRC).toMatch(/export async function scanLocalMachine\(\)/);
  });

  it("runs only read-only inspections", () => {
    // Discovering something must not grant control over it. If a verb like this appears,
    // someone has crossed from observing the machine to changing it, and that needs a
    // different design with explicit consent — not a quiet edit to this list.
    const probes = SRC.slice(SRC.indexOf("const PROBES"), SRC.indexOf("export type LocalScan"));
    for (const verb of ["\"run\"", "\"start\"", "\"stop\"", "\"rm\"", "\"exec\"", "\"create\"", "\"delete\"", "\"install\""]) {
      expect(probes).not.toContain(verb);
    }
  });

  it("bounds every command in time and output", () => {
    expect(SRC).toMatch(/timeout:\s*\d+/);
    expect(SRC).toMatch(/maxBuffer:/);
  });
});
