import { describe, expect, it } from "vitest";

import { isBlockedHostLiteral, parseSafeUrl } from "./url-guard";

describe("isBlockedHostLiteral", () => {
  it("blocks loopback, localhost, link-local + cloud metadata, and private ranges", () => {
    for (const h of [
      "localhost",
      "app.localhost",
      "127.0.0.1",
      "169.254.169.254", // AWS/GCP metadata
      "metadata.google.internal",
      "10.0.0.5",
      "192.168.1.1",
      "172.16.0.1",
      "100.64.0.1", // CGNAT
      "::1",
      "fd00::1",
    ]) {
      expect(isBlockedHostLiteral(h), h).toBe(true);
    }
  });

  it("allows real public hosts", () => {
    for (const h of ["jobs.example.com", "8.8.8.8", "203.0.113.10", "linkedin.com"]) {
      expect(isBlockedHostLiteral(h), h).toBe(false);
    }
  });
});

describe("parseSafeUrl", () => {
  it("rejects non-http(s) schemes and internal hosts", () => {
    expect(parseSafeUrl("file:///etc/passwd")).toBeNull();
    expect(parseSafeUrl("http://169.254.169.254/latest/meta-data/")).toBeNull();
    expect(parseSafeUrl("http://localhost:3000/admin")).toBeNull();
    expect(parseSafeUrl("ftp://example.com")).toBeNull();
    expect(parseSafeUrl("not a url")).toBeNull();
  });

  it("accepts ordinary public postings", () => {
    expect(parseSafeUrl("https://jobs.example.com/123")?.hostname).toBe("jobs.example.com");
  });
});
