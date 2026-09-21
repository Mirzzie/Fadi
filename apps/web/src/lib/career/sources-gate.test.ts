import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * KEEPING WHAT ARRIVED IS ONLY TRUE IF EVERY DOOR DOES IT.
 *
 * Stage 1 preserved imported text on two paths, and Codex was right to refuse the claim that a
 * source can never be lost: onboarding — the FIRST place most people's history enters Fadi — and
 * both file-import paths stored the text somewhere it would be overwritten, keeping no version.
 *
 * Same reasoning as the admission gate in lib/identity/gate.test.ts: a rule kept by discipline is
 * kept until someone adds a feature in a hurry. This fails on a NEW door, not the existing ones,
 * so adding to the list below is a decision someone makes on purpose.
 *
 * Captures that go through `admitEvidence` are deliberately NOT here. The clipped text IS the
 * record in those paths, and admission already appends it to the fact's history; preserving it a
 * second time would manufacture a source that never existed as a document.
 */

/**
 * Writers of FADI'S OWN output, which must NOT be preserved as a source.
 *
 * track-resume.ts assembles a base résumé from the person's records and writes it to the same
 * row an import lands in. Recording that as an imported source would file Fadi's wording as
 * something the person supplied — the exact confusion the source/claim split exists to prevent.
 * Their imported text is safe regardless, because it was versioned at the door it came in by.
 */
const GENERATED = ["src/lib/career/track-resume.ts"];

/** Files that store imported career text, each of which must preserve a version of it. */
const DOORS = [
  "src/app/onboarding/actions.ts",
  "src/app/dashboard/profile/actions.ts",
  "src/app/dashboard/evidence/actions.ts",
  "src/app/dashboard/documents/actions.ts",
];

function grep(pattern: string): string[] {
  try {
    return execFileSync(
      "grep",
      ["-rln", "--include=*.ts", "--include=*.tsx", "-E", pattern, "src"],
      { encoding: "utf8", cwd: process.cwd() }
    )
      .split("\n")
      .filter(Boolean)
      .filter((f) => !f.endsWith(".test.ts"));
  } catch {
    return []; // grep exits 1 when nothing matches
  }
}

describe("every imported source is kept before it can be overwritten", () => {
  it("has no writer of résumé or LinkedIn text that skips preservation", () => {
    const writers = grep(
      "create(Resumes|LinkedInProfiles)Repository\\([^)]*\\)[\\s\\S]{0,40}\\.(createForUser|upsertLatest(ForTrack|ForUser))\\(|resumesRepository\\.createForUser\\(|linkedInProfilesRepository\\.createForUser\\("
    );
    const preserving = new Set([...grep("preserveCareerSource\\("), ...GENERATED]);
    expect(writers.filter((file) => !preserving.has(file))).toEqual([]);
  });

  it("has no file-import path that reads a document and keeps no version of it", () => {
    const importers = grep("extractDocumentText\\(|parseJsonResume\\(");
    const preserving = new Set(grep("preserveCareerSource\\("));
    expect(importers.filter((file) => !preserving.has(file) && !file.includes("/lib/documents/")))
      .toEqual([]);
  });

  it("names the doors it knows about, so a new one is noticed", () => {
    const preserving = grep("preserveCareerSource\\(").filter((f) => !f.includes("lib/career/sources.ts"));
    expect(preserving.sort()).toEqual([...DOORS].sort());
  });
});
