import { describe, expect, it } from "vitest";

import { fileFingerprint } from "./uploaded-file";

describe("fileFingerprint", () => {
  const bytes = Buffer.from("%PDF-1.4 my actual cv");

  it("identifies the file by its contents, not its name", () => {
    const a = fileFingerprint({ name: "cv.pdf", size: bytes.length, type: "application/pdf", bytes });
    const renamed = fileFingerprint({ name: "cv-final-v2.pdf", size: bytes.length, type: "application/pdf", bytes });
    expect(JSON.parse(a).sha256).toBe(JSON.parse(renamed).sha256);
    expect(JSON.parse(renamed).file).toBe("cv-final-v2.pdf");
  });

  it("changes when the bytes change", () => {
    const edited = Buffer.from("%PDF-1.4 my actual cv, now with a new job");
    expect(JSON.parse(fileFingerprint({ name: "cv.pdf", size: edited.length, type: "application/pdf", bytes: edited })).sha256)
      .not.toBe(JSON.parse(fileFingerprint({ name: "cv.pdf", size: bytes.length, type: "application/pdf", bytes })).sha256);
  });

  it("keeps no part of the file itself", () => {
    const printed = fileFingerprint({ name: "cv.pdf", size: bytes.length, type: "application/pdf", bytes });
    expect(printed).not.toContain("my actual cv");
    expect(Object.keys(JSON.parse(printed)).sort()).toEqual(["bytes", "file", "sha256", "type"]);
  });

  it("says so when the browser sent no type", () => {
    expect(JSON.parse(fileFingerprint({ name: "cv", size: 3, type: "", bytes: Buffer.from("abc") })).type).toBe("unknown");
  });
});
