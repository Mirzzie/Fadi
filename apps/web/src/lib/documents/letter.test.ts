import { describe, expect, it } from "vitest";

import {
  emptyLetter,
  isProseKind,
  LETTER_FIELDS,
  letterFromText,
  letterSnippet,
  letterToPlainText,
  parseLetter,
  resolveLetterSignature,
  serializeLetter,
} from "./letter";

describe("letter model", () => {
  it("identifies the prose kinds", () => {
    expect(isProseKind("cover_letter")).toBe(true);
    expect(isProseKind("email")).toBe(true);
    expect(isProseKind("value_proposition")).toBe(true);
    expect(isProseKind("resume")).toBe(false);
    expect(isProseKind("note")).toBe(false);
  });

  it("round-trips structured data through serialize/parse", () => {
    const data = {
      ...emptyLetter("cover_letter"),
      sender: { name: "Mira", email: "m@x.io", phone: "", location: "Cork", links: "" },
      recipient: { name: "Hiring Manager", title: "", company: "Aon", location: "" },
      body: "Para one.\n\nPara two.",
      signature: "Mira",
    };
    const parsed = parseLetter(serializeLetter(data), "cover_letter");
    expect(parsed.sender.name).toBe("Mira");
    expect(parsed.recipient.company).toBe("Aon");
    expect(parsed.body).toBe("Para one.\n\nPara two.");
  });

  it("drops legacy plain text into the body, losing nothing", () => {
    const legacy = "Dear Hiring Manager,\n\nI'm writing about the role.\n\nSincerely,\nMira";
    const parsed = parseLetter(legacy, "cover_letter");
    expect(parsed.body).toBe(legacy);
    // Defaults still applied for the structured fields.
    expect(parsed.greeting).toBe("Dear Hiring Manager,");
  });

  it("treats non-letter JSON (arrays, scalars) as body text", () => {
    expect(parseLetter("[1,2,3]", "email").body).toBe("[1,2,3]");
    expect(parseLetter("42", "email").body).toBe("42");
  });

  it("returns sensible defaults for an empty document", () => {
    expect(parseLetter("", "email")).toEqual(emptyLetter("email"));
    expect(emptyLetter("email").greeting).toBe("Hi,");
    expect(emptyLetter("value_proposition").signOff).toBe("");
  });

  it("exposes per-kind field configs", () => {
    expect(LETTER_FIELDS.cover_letter.recipient).toBe(true);
    expect(LETTER_FIELDS.email.subject).toBe(true);
    expect(LETTER_FIELDS.email.recipient).toBe(false);
    expect(LETTER_FIELDS.value_proposition.subjectLabel).toBe("Headline");
    expect(LETTER_FIELDS.value_proposition.greeting).toBe(false);
  });

  it("falls back to the sender name for the signature", () => {
    const d = { ...emptyLetter("cover_letter"), signature: "", sender: { ...emptyLetter("cover_letter").sender, name: "Mira" } };
    expect(resolveLetterSignature(d)).toBe("Mira");
    expect(resolveLetterSignature({ ...d, signature: "M. Casual" })).toBe("M. Casual");
  });

  it("builds a structured letter from a plain Scout draft without doubling the greeting/sign-off", () => {
    const d = letterFromText("  Hi Jane,\n\nI'd love to chat.\n\nThanks,\nMira  ", "email");
    expect(d.body).toBe("Hi Jane,\n\nI'd love to chat.\n\nThanks,\nMira");
    // The draft carries its own salutation + sign-off, so the structured blocks
    // are cleared to avoid rendering them twice.
    expect(d.greeting).toBe("");
    expect(d.signOff).toBe("");
  });

  it("produces readable plain text and a list snippet", () => {
    const d = { ...emptyLetter("email"), subject: "Quick question", body: "Hello there.", signature: "Mira" };
    const text = letterToPlainText(d);
    expect(text).toContain("Subject: Quick question");
    expect(text).toContain("Hello there.");
    expect(letterSnippet(serializeLetter(d), "email")).toBe("Hello there.");
  });
});
