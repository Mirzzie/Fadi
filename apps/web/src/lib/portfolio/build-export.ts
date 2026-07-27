import "server-only";

import { execFile } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { promisify } from "node:util";

import type { PortfolioView } from "@/lib/portfolio/view";

const exec = promisify(execFile);

/**
 * Build the full static portfolio site (apps/portfolio-export) with the user's data baked
 * in, and return every file in out/ ready to push to a static host (ADR 0009).
 *
 * This is what makes the Publish button deploy the REAL template — hero, framer-motion
 * animations, case studies — instead of the old single-file "lite" snapshot. It runs a
 * Next.js static export as a child process (the export app has its own .next/, so it
 * never collides with the running dev server).
 *
 * Binary files (self-hosted .woff2 fonts, images) are returned base64-encoded — reading
 * them as utf-8 corrupts them and silently breaks the fonts.
 */

export type ExportedFile = { path: string; content: string; encoding: "utf-8" | "base64" };

const BINARY_EXT = new Set([
  ".woff2", ".woff", ".ttf", ".otf", ".eot",
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".avif",
]);

/** The export app lives beside apps/web in the monorepo. Resolve from the dev server cwd. */
function exportAppDir(): string {
  // `next dev` runs with cwd = apps/web; the export app is its sibling.
  return resolve(process.cwd(), "..", "portfolio-export");
}

// Serialize builds — two concurrent publishes would race on the shared out/ directory.
let buildLock: Promise<unknown> = Promise.resolve();

/**
 * @param basePath GitHub *project* sites serve under "/<repo>"; user sites
 *   ("<login>.github.io") and apex domains serve at root ("").
 */
export async function buildPortfolioSite(args: {
  view: PortfolioView;
  basePath: string;
}): Promise<ExportedFile[]> {
  const run = buildLock.then(async () => {
    const dir = exportAppDir();

    // Bake the user's published data in — the export reads this JSON at build time.
    writeFileSync(join(dir, "src", "data", "portfolio.json"), JSON.stringify(args.view));

    await exec("npx", ["next", "build"], {
      cwd: dir,
      env: { ...process.env, PORTFOLIO_BASE_PATH: args.basePath },
      timeout: 180_000,
      maxBuffer: 32 * 1024 * 1024,
    });

    return collectOut(join(dir, "out"));
  });
  // Keep the chain alive even if this build throws, so the next publish still runs.
  buildLock = run.catch(() => undefined);
  return run;
}

function collectOut(outDir: string): ExportedFile[] {
  const files: ExportedFile[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        const binary = BINARY_EXT.has(extname(full).toLowerCase());
        files.push({
          path: full.slice(outDir.length + 1),
          content: readFileSync(full, binary ? "base64" : "utf8"),
          encoding: binary ? "base64" : "utf-8",
        });
      }
    }
  };
  walk(outDir);
  return files;
}

/** GitHub project sites need a "/<repo>" base path; a user site ("<login>.github.io") is root. */
export function pagesBasePath(login: string, repo: string): string {
  return repo.toLowerCase() === `${login.toLowerCase()}.github.io` ? "" : `/${repo}`;
}
