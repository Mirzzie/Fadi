import { describe, expect, it } from "vitest";

import { assertStylesheetCoversMarkup, pagesBasePath } from "./build-export";

const file = (path: string, content: string) => ({ path, content, encoding: "utf-8" as const });

/** Enough plain utilities to clear the 20-token floor the guard needs to judge. */
const CLASSES = [
  "mx-auto", "max-w-5xl", "text-sm", "font-semibold", "rounded-lg", "border-b",
  "bg-black", "gap-3", "px-5", "py-12", "mt-2", "flex-wrap", "items-center",
  "justify-between", "leading-relaxed", "tracking-tight", "space-y-2", "grid-cols-3",
  "text-white", "min-h-screen", "overflow-hidden", "shrink-0",
];
const HTML = file("index.html", `<div class="${CLASSES.join(" ")}"></div>`);
const fullCss = file("s.css", CLASSES.map((c) => `.${c}{color:red}`).join(""));

describe("a build with no styles must not publish", () => {
  it("passes when the stylesheet defines what the page uses", () => {
    expect(() => assertStylesheetCoversMarkup([HTML, fullCss])).not.toThrow();
  });

  it("THE BUG: rejects a build whose CSS is missing most of the template", () => {
    // What actually shipped. globals.css had no @source for @careeros/portfolio, so
    // Tailwind generated fonts and a handful of utilities — a valid 26 KB stylesheet
    // that returned 200 while 72% of the page's classes had no rule at all.
    const thin = file("s.css", `@font-face{font-family:Geist}${CLASSES.slice(0, 5).map((c) => `.${c}{}`).join("")}`);
    expect(() => assertStylesheetCoversMarkup([HTML, thin])).toThrow(/would be unstyled/);
  });

  it("rejects a build with no stylesheet at all", () => {
    expect(() => assertStylesheetCoversMarkup([HTML])).toThrow(/no stylesheet/);
  });

  it("rejects a build with no index.html", () => {
    expect(() => assertStylesheetCoversMarkup([fullCss])).toThrow(/no index\.html/);
  });

  it("stays quiet when there is too little markup to judge", () => {
    // A near-empty page is not evidence of a broken stylesheet — don't block on a guess.
    const tiny = file("index.html", '<div class="mx-auto text-sm"></div>');
    expect(() => assertStylesheetCoversMarkup([tiny, file("s.css", "body{}")])).not.toThrow();
  });

  it("tolerates decimal utilities like mt-2.5 rather than mistaking them for gaps", () => {
    const withDot = file("index.html", `<div class="mt-2.5 ${CLASSES.join(" ")}"></div>`);
    const css = file("s.css", `.mt-2\\.5{margin-top:.625rem}` + CLASSES.map((c) => `.${c}{}`).join(""));
    expect(() => assertStylesheetCoversMarkup([withDot, css])).not.toThrow();
  });
});

describe("pagesBasePath", () => {
  it("re-exports the rule that decides what the build is compiled for", () => {
    expect(pagesBasePath("Mirzzie", "Mirzzie")).toBe("/Mirzzie");
    expect(pagesBasePath("Ada", "ada.github.io")).toBe("");
  });
});
