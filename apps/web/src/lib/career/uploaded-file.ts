import { createHash } from "node:crypto";

/**
 * WHAT ARRIVED WAS A FILE, NOT JUST THE TEXT INSIDE IT.
 *
 * A PDF is read, its text extracted, restructured by a model and saved as a document. Every step
 * after the first is a rewording — and until now the only thing kept was the last one. Keeping
 * the extracted text answers "what did this CV actually say?", but not "is this the same file I
 * sent in March?", because two different exports of the same CV extract to different text.
 *
 * Fadi does not store the bytes: a career record is not a file cabinet, and keeping people's
 * documents is a promise about storage and deletion that is not being made here. It keeps the
 * file's FINGERPRINT — name, size, type and a sha256 of the bytes — which is enough to say "this
 * exact file arrived on this date" and nothing more than that.
 */
export function fileFingerprint(input: {
  name: string;
  size: number;
  type: string;
  bytes: Buffer | Uint8Array;
}): string {
  return JSON.stringify(
    {
      file: input.name,
      bytes: input.size,
      type: input.type || "unknown",
      sha256: createHash("sha256").update(input.bytes).digest("hex"),
    },
    null,
    2
  );
}
