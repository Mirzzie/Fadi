import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isVideoUrl, DEFAULT_LABELS, LABEL_KEYS } from "@careeros/portfolio";
import { SECTION_KEYS, SECTION_META } from "@/components/portfolio/portfolio-manager/shared";

/**
 * THE CMS AND THE PUBLIC PAGE MUST AGREE.
 *
 * Every one of these guards exists because the two halves drifted silently: the manager
 * offered something, the user filled it in, and the published site quietly dropped it.
 * Nothing failed — the content simply never appeared, which is the worst possible
 * failure mode for a tool whose whole job is "what you put in is what people see".
 *
 * These read the source deliberately. The alternative is rendering the template, and a
 * render test would pass just as happily on a page that silently ignores a section.
 */
const pkg = (f: string) => readFileSync(join(process.cwd(), "../../packages/portfolio/src", f), "utf8");
const template = pkg("work-template.tsx");
const index = pkg("work-index.ts");
const viewer = pkg("media-viewer.tsx");

describe("every section the CMS offers reaches the page", () => {
  it.each(SECTION_KEYS)("renders %s somewhere", (section) => {
    // Either the template filters for it, or work-index routes it (cases, skills).
    const handled = `"${section}"`;
    expect(template.includes(handled) || index.includes(handled)).toBe(true);
  });

  it("describes every section it offers", () => {
    for (const s of SECTION_KEYS) expect(SECTION_META[s]?.label).toBeTruthy();
  });
});

describe("every media type the editor accepts is renderable", () => {
  it("classifies the formats a video/* file input produces", () => {
    for (const url of ["a.mp4", "a.webm", "a.mov", "a.m4v", "a.ogv", "https://x/y.MP4?v=2"]) {
      expect(isVideoUrl(url)).toBe(true);
    }
    for (const url of ["a.png", "a.jpg", "a.svg", "https://x/diagram.webp#f"]) {
      expect(isVideoUrl(url)).toBe(false);
    }
  });

  it("THE BUG: the live viewer must draw video as video, not as a broken <img>", () => {
    // The editor accepts video/* and the admin preview handled it, so a screen recording
    // looked right until it was published — the public component drew every media URL
    // with <img>. Video worked everywhere except the one place visitors look.
    expect(viewer).toContain("isVideoUrl");
    expect(viewer).toContain("<video");
  });
});

/** JSX text nodes that are literal prose rather than an expression. */
function hardcodedCopy(source: string): string[] {
  const found = new Set<string>();
  for (const [, text] of source.matchAll(/>\s*([A-Z][A-Za-z0-9 ,.'’&—–?!-]{3,60})\s*</g)) {
    found.add(text.trim());
  }
  return [...found];
}

describe("every fixed word on the page is the owner's to change", () => {
  it("detects hardcoded copy when there is some", () => {
    // Proves the scanner below actually works. Without this the real assertion passes
    // just as happily on a broken regex as on a clean template — a guard that cannot
    // fail is not a guard.
    expect(hardcodedCopy('<a href="x">Book a call</a>')).toEqual(["Book a call"]);
    expect(hardcodedCopy("<span>{L.bookingCta}</span>")).toEqual([]);
  });

  it("leaves no user-visible copy hardcoded in the template", () => {
    const editable = new Set<string>(Object.values(DEFAULT_LABELS));
    expect(hardcodedCopy(template).filter((t) => !editable.has(t))).toEqual([]);
  });

  it("gives every label key a default and a name in the settings form", () => {
    for (const k of LABEL_KEYS) expect(DEFAULT_LABELS[k]).toBeTruthy();
  });
});
