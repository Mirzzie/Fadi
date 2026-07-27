import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { z } from "zod";

for (const line of readFileSync("./.env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const OUT = "/tmp/probe3.txt";
const log = (m: string) => appendFileSync(OUT, m + "\n");
const USER = "b9c09bc9-5556-43ec-9cb7-4f4f607918f1";

describe("PROBE: which zod constructs survive strict mode?", () => {
  it("isolates .max() and z.coerce.number()", async () => {
    writeFileSync(OUT, "");
    const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
    const gen = await getUserDocGenerate(USER);
    if (!gen) return log("no provider");

    const sys = "Rate this answer and list strengths.";
    const usr = "Answer: I migrated our CI pipeline to GitHub Actions, cutting build time 40%.";

    const cases: Array<[string, z.ZodType]> = [
      ["baseline nullable", z.object({ items: z.array(z.string()) })],
      ["array .max(6)", z.object({ items: z.array(z.string()).max(6) })],
      ["coerce.number", z.object({ score: z.coerce.number(), items: z.array(z.string()) })],
      ["plain number", z.object({ score: z.number(), items: z.array(z.string()) })],
      [
        "nested object array",
        z.object({
          items: z.array(z.object({ name: z.string(), note: z.string().nullable() })),
        }),
      ],
    ];

    for (const [label, schema] of cases) {
      try {
        const out = await gen.structured(sys, usr, schema, "probe");
        log(`${label}: OK — ${JSON.stringify(out).slice(0, 80)}`);
      } catch (e) {
        log(`${label}: THREW — ${(e as Error).message.replace(/\s+/g, " ").slice(0, 110)}`);
      }
    }
  }, 180000);
});
