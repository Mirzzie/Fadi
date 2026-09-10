import { describe, expect, it } from "vitest";

/**
 * The checklist must belong to the phase the user chose.
 *
 * Two of the five steps are pipeline work — "Save a role worth pursuing" and "Track
 * your first application" — and both link to routes Prepare declares it hides. So in
 * Prepare the headline NEXT STEP was an instruction to leave the mode, with a progress
 * bar counting the user incomplete for not obeying it.
 *
 * These assert the RULE against the step ids, so the test stays true when the copy
 * changes but fails if a new pipeline step is added without being classified.
 */
const APPLY_ONLY = ["save-role", "apply"];
const SHARED = ["direction", "cv", "report"];

describe("the setup checklist per phase", () => {
  it("classifies every step as shared or apply-only, leaving none unaccounted", async () => {
    // If someone adds a sixth step, this fails until they decide which phase owns it —
    // which is the point. Silence would mean it shows up in Prepare by accident.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/guidance/setup.ts", "utf8"),
    );
    const ids = [...src.matchAll(/^\s{6}id: "([a-z-]+)",/gm)].map((m) => m[1]);

    expect(new Set(ids)).toEqual(new Set([...SHARED, ...APPLY_ONLY]));
  });

  it("keeps the apply-only steps named in one place the filter reads", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/guidance/setup.ts", "utf8"),
    );
    for (const id of APPLY_ONLY) expect(src).toMatch(new RegExp(`APPLY_ONLY[\\s\\S]{0,120}"${id}"`));
  });

  it("never points a Prepare step at a route Prepare hides", async () => {
    const [setupSrc, modeSrc] = await Promise.all([
      import("node:fs").then((fs) => fs.readFileSync("src/lib/guidance/setup.ts", "utf8")),
      import("node:fs").then((fs) => fs.readFileSync("src/app/dashboard/mode.ts", "utf8")),
    ]);
    const hidden = [...(modeSrc.match(/prepare: \[([\s\S]*?)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(hidden.length).toBeGreaterThan(0);

    // Every step whose href is hidden in Prepare must be in the apply-only list.
    const steps = [...setupSrc.matchAll(/id: "([a-z-]+)",[\s\S]*?href: "([^"]+)"/g)];
    for (const [, id, href] of steps) {
      if (hidden.some((h) => href.startsWith(h))) expect(APPLY_ONLY).toContain(id);
    }
  });
});
