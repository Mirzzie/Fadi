import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Repo-wide guard: no schema passed to structured output may use `.optional()` or
 * `.default()`.
 *
 * WHY THIS IS A SOURCE-SCANNING TEST. The per-schema version (pool-schema.test.ts)
 * only protects the one schema it imports, and this defect's defining property is that
 * it spread silently: seven schemas across five features carried it before anyone
 * noticed, because each looked locally reasonable. A guard that must be remembered for
 * each new schema is the same shape as the momentum bug (DATA_FLOW_AUDIT F1) — a
 * chokepoint every caller was trusted to invoke, and some never did.
 *
 * So this scans the source instead. A new schema is covered the moment it is written,
 * with nothing to remember.
 *
 * THE RULE: OpenAI-compatible structured output only ENFORCES a schema in strict mode,
 * and strict mode requires every property to be `required`. One `.optional()` or
 * `.default()` demotes the whole request to a non-strict schema, where the model is
 * merely advised of the shape — and it then returns whatever it likes. Measured against
 * the live model 2026-07-20: the `.optional()` form failed 100% of attempts; the
 * `.nullable()` form succeeded.
 *
 * Use `.nullable()` instead — the property stays required, its VALUE may be null.
 *
 * SAFE (each verified against the live model, do not "fix" these):
 *   `.max(n)` · `z.coerce.number()` · `z.number()` · nested object arrays
 */

const LIB = join(__dirname, "..");

/** Files that define a schema handed to `.structured()` / `parseStructured()`. */
const SCHEMA_FILES = [
  "evidence/pool.ts",
  "documents/cv-review.ts",
  "documents/resume-schema.ts",
  "interview/company-brief.ts",
  "interview/jd-prep.ts",
  "interview/mock.ts",
  "learning/suggest.ts",
  "jobs/fit.ts",
  "resilience/autopsy.ts",
  "intelligence/application-quality.ts",
];

/**
 * Extract the body of every `const <name>Schema = z.object({ ... });` block.
 * Deliberately a blunt brace-counting scan rather than a parser: it needs to be
 * obvious what it checks, and it only has to read code we control.
 */
function schemaBlocks(source: string): Array<{ name: string; body: string }> {
  const blocks: Array<{ name: string; body: string }> = [];
  const re = /(?:const|export const)\s+(\w*[Ss]chema\w*)\s*=\s*z\.object\(/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(source))) {
    let depth = 0;
    let i = match.index + match[0].length - 1;
    const start = i;
    for (; i < source.length; i++) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push({ name: match[1], body: source.slice(start, i) });
  }
  return blocks;
}

describe("structured-output schemas", () => {
  const files = SCHEMA_FILES.map((rel) => ({
    rel,
    source: readFileSync(join(LIB, rel), "utf8"),
  }));

  it("finds the schemas it claims to check (guard against a vacuous pass)", () => {
    // Without this, a rename or a moved file would make every assertion below pass by
    // scanning nothing at all.
    const total = files.reduce((n, f) => n + schemaBlocks(f.source).length, 0);
    expect(total).toBeGreaterThanOrEqual(9);
  });

  it("uses no .optional() or .default() in any structured-output schema", () => {
    const offenders: string[] = [];
    for (const { rel, source } of files) {
      for (const { name, body } of schemaBlocks(source)) {
        for (const bad of [".optional()", ".default("]) {
          if (body.includes(bad)) offenders.push(`${rel} → ${name} uses ${bad}`);
        }
      }
    }
    // If this fails: replace `.optional()` with `.nullable()`. The field must stay
    // required or structured output silently stops being enforced at runtime.
    expect(offenders).toEqual([]);
  });
});
