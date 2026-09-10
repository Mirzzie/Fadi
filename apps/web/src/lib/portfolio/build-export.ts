import "server-only";

import { execFile } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { promisify } from "node:util";

import type { PortfolioView } from "@careeros/portfolio";

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

    // On Windows npx is `npx.cmd`; execFile doesn't go through a shell, so the bare "npx"
    // would throw ENOENT. Use the platform-correct binary name.
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    await exec(npx, ["next", "build"], {
      cwd: dir,
      env: {
        ...process.env,
        PORTFOLIO_BASE_PATH: args.basePath,
        // MUST be forced. Fadi normally runs via `next dev`, so process.env carries
        // NODE_ENV=development into this child — and a production `next build` that
        // inherits it resolves React inconsistently and dies part-way through
        // prerendering with "Cannot read properties of null (reading 'useContext')".
        // That made Publish fail for every locally-run install, while the surfaced
        // error ("Couldn't build your portfolio site") pointed at the GitHub token.
        NODE_ENV: "production",
      },
      timeout: 180_000,
      maxBuffer: 32 * 1024 * 1024,
    });

    const built = collectOut(join(dir, "out"));
    assertStylesheetCoversMarkup(built);
    return built;
  });
  // Keep the chain alive even if this build throws, so the next publish still runs.
  buildLock = run.catch(() => undefined);
  return run;
}

/**
 * REFUSE TO PUBLISH A SITE WITH NO STYLES.
 *
 * Tailwind v4 only generates classes it was pointed at with @source, and it does not
 * follow imports into sibling workspace packages. Miss one, and the build still succeeds:
 * every file is emitted, every asset returns 200, and the deployed page is raw unstyled
 * markup. That exact gap shipped — 72% of the template's classes were absent from the
 * published CSS while Fadi reported success — and nothing anywhere could have caught it,
 * because "the CSS file exists" was the only thing being checked.
 *
 * So compare the two artefacts against each other: take the plain utility classes the
 * rendered HTML actually uses and require the stylesheet to define most of them. Plain
 * classes only — arbitrary values like text-[clamp(...)] are escaped in ways that make
 * naive matching unreliable, and there are always enough plain ones to judge by.
 */
export function assertStylesheetCoversMarkup(files: ExportedFile[]): void {
  const html = files.find((f) => f.path === "index.html");
  const css = files.filter((f) => f.path.endsWith(".css")).map((f) => f.content).join("\n");
  if (!html) throw new Error("The build produced no index.html.");
  if (!css.trim()) throw new Error("The build produced no stylesheet — the site would be unstyled.");

  const used = new Set<string>();
  for (const [, attr] of html.content.matchAll(/class="([^"]+)"/g)) {
    for (const token of attr.split(/\s+/)) {
      // Plain utilities only: no variants, no arbitrary values, no CSS-module hashes.
      if (/^[a-z][a-z0-9]*(-[a-z0-9.]+)+$/.test(token)) used.add(token);
    }
  }
  if (used.size < 20) return; // Too little to judge — don't block on a guess.

  const missing = [...used].filter((t) => !css.includes(`.${t.replace(/\./g, "\\.")}`));
  if (missing.length > used.size * 0.25) {
    throw new Error(
      `The stylesheet is missing ${missing.length} of ${used.size} classes the page uses ` +
        `(e.g. ${missing.slice(0, 4).join(", ")}) — the published site would be unstyled. ` +
        `This usually means a template moved and globals.css needs an @source for it.`,
    );
  }
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

// pagesBasePath now lives beside pagesUrl in ./github, so the two halves of one rule —
// where the site is BUILT for and where it is SERVED from — cannot drift apart, and can
// be tested without dragging this module's child_process import into the test run.
export { pagesBasePath } from "./github";
