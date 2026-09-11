import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * THE PLAN MUST KNOW WHAT MACHINE IT IS FOR.
 *
 * A real plan told the owner to "select the Windows 64-bit .msi" and save it to
 * C:\Users\%USERNAME%\Downloads — on a Linux laptop. Every step was unfollowable. Nothing
 * in the prompt had ever said what OS they were on, so the model filled the gap with the
 * most common answer, confidently.
 *
 * Structural, because the property lives in what is SENT: a behavioural test would need a
 * model, and the failure was that a line was missing from a prompt.
 */
const SRC = readFileSync(join(process.cwd(), "src/lib/lab/plan-run.ts"), "utf8");

describe("the planner is told the operating system", () => {
  it("reads the real platform rather than assuming one", () => {
    // Asserting the phrase merely APPEARS was satisfied by its own explanatory comment —
    // hardcoding `const platform = "linux"` passed. The assignment is the property.
    const code = SRC.split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
      .join("\n");
    expect(code).toMatch(/hostOsOf\(process\.platform\)/);
  });

  it("puts the OS into the prompt, not just into a variable", () => {
    // The bug would have survived a version that computed this and never sent it.
    const promptAssembly = SRC.slice(SRC.indexOf("`Project: ${input.title}`"));
    expect(promptAssembly.slice(0, 200)).toContain("placement");
  });

  it("sends a placement briefing, not just an OS name", () => {
    // The naive version said "this machine runs Linux", which fixed Windows-steps-on-Linux
    // and made the opposite error available: a Windows Server project rewritten as Linux
    // steps. Both machines have to be named. The wording of that briefing is tested in
    // host-and-lab.test.ts; here we only prove the planner sends it.
    expect(SRC).toContain("placementBriefing");
    expect(SRC).toContain("templateForProject");
  });
});
