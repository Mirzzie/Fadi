import { describe, expect, it } from "vitest";

import { redactPracticeProof } from "./proof";

describe("Practice proof redaction", () => {
  it("removes common credentials before output becomes durable proof", () => {
    const input = [
      "Authorization: Bearer abc.def-123",
      "PASSWORD=SecretPassword",
      "api_key: sk-live_abcdefghijklmnop",
      "postgres://operator:database-pass@localhost:5432/fadi",
      "-----BEGIN PRIVATE KEY-----\nsecret material\n-----END PRIVATE KEY-----",
    ].join("\n");
    const result = redactPracticeProof(input);

    expect(result).not.toContain("abc.def-123");
    expect(result).not.toContain("SecretPassword");
    expect(result).not.toContain("abcdefghijklmnop");
    expect(result).not.toContain("database-pass");
    expect(result).not.toContain("secret material");
    expect(result).toContain("Bearer [redacted-token]");
    expect(result).toContain("PASSWORD=[redacted]");
    expect(result).toContain("postgres://operator:[redacted]@localhost");
  });

  it("preserves ordinary diagnostic evidence", () => {
    const output = "WazuhSvc Running\nConfig: C:\\Program Files (x86)\\ossec-agent\\ossec.conf";
    expect(redactPracticeProof(output)).toBe(output);
  });
});
