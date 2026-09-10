import { describe, expect, it } from "vitest";

import { uploadKindFor } from "./upload";

/**
 * THE BUG THIS PINS: a CV uploaded through Fadi returned 200 and a secure_url, and that
 * URL answered 401 forever. Cloudinary's "auto" endpoint files a PDF under
 * resource_type=image, and image-served PDFs are denied by default on every account.
 * Documents must take the raw path, which has no such restriction.
 */
describe("choosing the Cloudinary endpoint", () => {
  it("sends documents to raw, not auto", () => {
    expect(uploadKindFor({ type: "application/pdf", name: "cv.pdf" })).toBe("raw");
    expect(uploadKindFor({ type: "application/msword", name: "cv.doc" })).toBe("raw");
    expect(
      uploadKindFor({
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        name: "cv.docx",
      }),
    ).toBe("raw");
  });

  it("leaves images and video on auto — that path was never broken", () => {
    expect(uploadKindFor({ type: "image/png", name: "diagram.png" })).toBe("auto");
    expect(uploadKindFor({ type: "video/mp4", name: "demo.mp4" })).toBe("auto");
  });

  it("falls back to the filename when the browser reports no type", () => {
    // Drag-and-drop from some file managers gives an empty File.type.
    expect(uploadKindFor({ type: "", name: "architecture.JPG" })).toBe("auto");
    expect(uploadKindFor({ type: "", name: "demo.webm" })).toBe("auto");
    expect(uploadKindFor({ type: "", name: "resume.pdf" })).toBe("raw");
  });

  it("treats an unknown file as a document rather than guessing image", () => {
    expect(uploadKindFor({ type: "", name: "notes" })).toBe("raw");
  });
});
