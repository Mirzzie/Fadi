import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]
  );

describe("shared surface source contracts (not browser acceptance)", () => {
  it("keeps fixed status colours out of interactive components and dashboard routes", () => {
    const failures = [...files("src/components"), ...files("src/app/dashboard")]
      .filter(
        (path) => path.endsWith(".tsx") && !/resume-preview|letter-preview|accent-picker/.test(path)
      )
      .filter((path) =>
        /(?:text|bg|border|ring)-(?:emerald|green|amber|yellow|rose|red)-[1-9]/.test(
          readFileSync(path, "utf8")
        )
      );
    expect(failures).toEqual([]);
  });
  it("lets the shell own the signed-in main landmark", () => {
    const failures = files("src/app/dashboard")
      .filter((path) => path.endsWith("page.tsx"))
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return source.includes("<AppShell>") && source.includes("<main");
      });
    expect(failures).toEqual([]);
  });
  it("uses the shared intro for primary account and work indexes", () => {
    for (const path of [
      "src/app/dashboard/jobs/page.tsx",
      "src/app/dashboard/profile/page.tsx",
      "src/app/dashboard/settings/page.tsx",
      "src/components/evidence/evidence-pool.tsx",
      "src/components/documents/documents-shell.tsx",
      "src/components/portfolio/portfolio-manager/index.tsx",
      "src/components/network/referral-board.tsx",
      "src/components/applications/applications-board.tsx",
      "src/components/interview/mock-interview.tsx",
    ]) {
      expect(readFileSync(path, "utf8"), path).toContain("<PageIntro");
    }
  });
});
