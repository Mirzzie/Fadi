import { describe, expect, it } from "vitest";

import {
  addedPuffery,
  inventedNumbers,
  isDictationWorthCleaning,
  isMetaCommentary,
  numericClaims,
  suspiciouslyExpanded,
  verifyTidy,
} from "./dictation";

describe("REGRESSION: 'There is no text to clean.' reached a live résumé", () => {
  // This shipped. A near-empty capture made the model answer the request instead of
  // performing it, the reply passed every guard (no numbers, no puffery), and it was
  // appended to a real experience section as an achievement bullet.
  const LEAK = "There is no text to clean.";

  it("recognises the exact leaked string as commentary", () => {
    expect(isMetaCommentary(LEAK)).toBe(true);
  });

  it("rejects it and keeps the speaker's words instead", () => {
    const verdict = verifyTidy("um", LEAK);
    expect(verdict.ok).toBe(false);
    expect(verdict.text).toBe("um");
    expect(verdict).toMatchObject({ reason: "meta_commentary" });
  });

  it("never sends a trivial capture to the model in the first place", () => {
    // The real root cause: "um" should never have been a dictation at all.
    expect(isDictationWorthCleaning("um")).toBe(false);
    expect(isDictationWorthCleaning("")).toBe(false);
    expect(isDictationWorthCleaning("uh, yeah")).toBe(false);
    expect(isDictationWorthCleaning("so and the")).toBe(false);
  });

  it("still lets real speech through", () => {
    expect(isDictationWorthCleaning("built a home lab")).toBe(true);
    expect(isDictationWorthCleaning("um so I ran Wazuh")).toBe(true);
  });
});

describe("isMetaCommentary — the model talking about the text", () => {
  it.each([
    "There is nothing to clean here.",
    "The transcript is empty.",
    "It seems the audio was silent.",
    "I'm sorry, I cannot process that.",
    "Please provide the text you want cleaned.",
    "The input appears to be blank.",
  ])("catches %j", (reply) => {
    expect(isMetaCommentary(reply)).toBe(true);
  });

  it("does NOT flag a legitimate cleanup that merely mentions similar words", () => {
    expect(isMetaCommentary("Cleaned the backlog of alerts and provided reports.")).toBe(false);
    expect(isMetaCommentary("Ran Wazuh and Suricata on Proxmox.")).toBe(false);
    expect(isMetaCommentary("Provided level 2 support for clients.")).toBe(false);
  });
});

describe("suspiciouslyExpanded — cleanup tightens, it never balloons", () => {
  it("flags text that grew far beyond what was said", () => {
    expect(suspiciouslyExpanded("um", "There is no text to clean.")).toBe(true);
  });

  it("allows normal punctuation and capitalisation growth", () => {
    expect(suspiciouslyExpanded("um so like i set up wazuh on proxmox", "Set up Wazuh on Proxmox.")).toBe(false);
    expect(suspiciouslyExpanded("i helped clients", "I helped clients.")).toBe(false);
  });
});

describe("numericClaims", () => {
  it("finds digits and spoken number-words", () => {
    expect(numericClaims("triaged 200 alerts")).toEqual(["200"]);
    expect(numericClaims("about two hundred alerts")).toEqual(["hundred", "two"]);
  });

  it("normalises thousands separators so 1,200 and 1200 are the same claim", () => {
    expect(inventedNumbers("saved 1,200 euro", "Saved 1200 euro.")).toEqual([]);
  });

  it("ignores numbers that are part of a word", () => {
    expect(numericClaims("no numbers here")).toEqual([]);
  });
});

describe("inventedNumbers — the fabrication guard", () => {
  it("catches a metric the speaker never said", () => {
    // The exact failure mode: a "polish" model turning vagueness into a hard number.
    const raw = "I ran a home lab with Wazuh and triaged a lot of alerts.";
    const tidied = "Ran a home SOC lab with Wazuh, triaging 200+ alerts weekly.";
    expect(inventedNumbers(raw, tidied)).toEqual(["200"]);
  });

  it("allows numbers the speaker actually said, reworded around them", () => {
    const raw = "um so I like triaged about 200 alerts on the lab";
    const tidied = "Triaged approximately 200 alerts in the lab.";
    expect(inventedNumbers(raw, tidied)).toEqual([]);
  });

  it("permits DROPPING a number — that is editing, not fabrication", () => {
    expect(inventedNumbers("I did 200 alerts and 3 reports", "Triaged alerts.")).toEqual([]);
  });

  it("treats a spoken number-word and its digit as different claims (conservative)", () => {
    // "two hundred" -> "200" is a legitimate transcription, but we cannot distinguish
    // it from an invented figure without understanding the sentence. We fail SAFE:
    // the user keeps their own words. A missed polish is cheap; a fabricated metric
    // in a signed document is not.
    expect(inventedNumbers("about two hundred alerts", "Triaged 200 alerts.")).toEqual(["200"]);
  });
});

describe("addedPuffery — the stature guard", () => {
  it("catches praise the model awarded the speaker", () => {
    const raw = "I helped set up the firewall rules.";
    const tidied = "Expertly spearheaded the implementation of robust firewall rules.";
    expect(addedPuffery(raw, tidied).sort()).toEqual(["expertly", "robust", "spearheaded"]);
  });

  it("leaves the speaker's own words alone if THEY said them", () => {
    const raw = "I successfully finished the CCNA.";
    const tidied = "Successfully completed the CCNA.";
    expect(addedPuffery(raw, tidied)).toEqual([]);
  });

  it("accepts a genuinely plain cleanup", () => {
    const raw = "um so basically I like set up wazuh on proxmox you know";
    const tidied = "Set up Wazuh on Proxmox.";
    expect(addedPuffery(raw, tidied)).toEqual([]);
  });
});

describe("verifyTidy — keep their voice unless the cleanup earned it", () => {
  it("accepts an honest cleanup", () => {
    const raw = "um yeah so i basically ran wazuh and suricata on proxmox and triaged like 200 attacks";
    const tidied = "Ran Wazuh and Suricata on Proxmox, triaging 200 simulated attacks.";
    expect(verifyTidy(raw, tidied)).toEqual({ ok: true, text: tidied });
  });

  it("falls back to the RAW transcript when a number was invented", () => {
    const raw = "I triaged a lot of alerts";
    const tidied = "Triaged 500 alerts.";
    const verdict = verifyTidy(raw, tidied);
    expect(verdict.ok).toBe(false);
    // The fallback is the point: the speaker's own words are always publishable.
    expect(verdict.text).toBe(raw);
    expect(verdict).toMatchObject({ reason: "invented_numbers", details: ["500"] });
  });

  it("falls back to the RAW transcript when stature was invented", () => {
    const raw = "I helped with the migration";
    const verdict = verifyTidy(raw, "Spearheaded the migration.");
    expect(verdict.ok).toBe(false);
    expect(verdict.text).toBe(raw);
    expect(verdict).toMatchObject({ reason: "added_puffery", details: ["spearheaded"] });
  });

  it("reports numbers before puffery when a draft invented both", () => {
    const verdict = verifyTidy("I helped out", "Expertly led 12 engineers.");
    expect(verdict).toMatchObject({ ok: false, reason: "invented_numbers" });
  });
});
