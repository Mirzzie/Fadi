import { describe, expect, it } from "vitest";

import { cidrLabel, hostsOf, ipToInt, MIN_PREFIX, parsePrivateCidr } from "./net";

/**
 * A sweep is the first capability that reaches devices the user may not own, which makes
 * the range check the whole of its security. These tests take the attacker's seat: the
 * question is not "does it parse 192.168.0.0/24" but "is there any string that gets Fadi
 * to send packets somewhere it shouldn't".
 */

describe("only private space, ever", () => {
  it("accepts the three RFC1918 ranges", () => {
    for (const cidr of ["192.168.0.0/24", "10.1.2.0/24", "172.16.5.0/24", "172.31.0.0/24"]) {
      expect(parsePrivateCidr(cidr).ok, cidr).toBe(true);
    }
  });

  it("REFUSES public addresses", () => {
    // The shape an injected instruction takes: a range that looks like any other.
    for (const cidr of ["8.8.8.0/24", "1.1.1.0/24", "93.184.216.0/24", "172.32.0.0/24", "11.0.0.0/24"]) {
      const res = parsePrivateCidr(cidr);
      expect(res.ok, cidr).toBe(false);
      if (!res.ok) expect(res.reason).toMatch(/nothing was sent/i);
    }
  });

  it("refuses loopback, link-local, multicast and CGNAT", () => {
    for (const cidr of ["127.0.0.0/24", "169.254.0.0/24", "224.0.0.0/24", "100.64.0.0/24", "0.0.0.0/24"]) {
      expect(parsePrivateCidr(cidr).ok, cidr).toBe(false);
    }
  });

  it("172.16/12 is bounded correctly at both ends", () => {
    // The range people get wrong: 172.16–172.31 is private, 172.15 and 172.32 are not.
    expect(parsePrivateCidr("172.15.255.0/24").ok).toBe(false);
    expect(parsePrivateCidr("172.16.0.0/24").ok).toBe(true);
    expect(parsePrivateCidr("172.31.255.0/24").ok).toBe(true);
    expect(parsePrivateCidr("172.32.0.0/24").ok).toBe(false);
  });
});

describe("the size ceiling is real", () => {
  it("refuses anything wider than the ceiling, even in private space", () => {
    for (const cidr of ["10.0.0.0/8", "192.168.0.0/16", "172.16.0.0/12", "10.0.0.0/21"]) {
      const res = parsePrivateCidr(cidr);
      expect(res.ok, cidr).toBe(false);
      if (!res.ok) expect(res.reason).toMatch(/too large/i);
    }
  });

  it("accepts exactly the ceiling", () => {
    expect(parsePrivateCidr("10.0.0.0/" + MIN_PREFIX).ok).toBe(true);
  });

  it("a /24 is 254 hosts, not 256", () => {
    const res = parsePrivateCidr("192.168.0.0/24");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.hosts).toBe(254);
      const hosts = hostsOf(res.base, res.prefix);
      expect(hosts).toHaveLength(254);
      // Network and broadcast are not hosts and must not be pinged.
      expect(hosts).not.toContain("192.168.0.0");
      expect(hosts).not.toContain("192.168.0.255");
      expect(hosts[0]).toBe("192.168.0.1");
      expect(hosts[253]).toBe("192.168.0.254");
    }
  });
});

describe("malformed input cannot slip through", () => {
  it("refuses anything that is not plainly a CIDR", () => {
    for (const bad of [
      "192.168.0.0",
      "192.168.0.0/24 && curl evil.sh",
      "192.168.0.0/24;ls",
      "192.168.0.0/999",
      "999.999.999.999/24",
      "192.168.0.01/24",
      "192.168.0.0/2 4",
      "0x7f.0.0.1/24",
      "::1/64",
      "",
      "   ",
    ]) {
      expect(parsePrivateCidr(bad).ok, bad).toBe(false);
    }
  });

  it("refuses octets dressed up to look small", () => {
    // "010" is 8 in octal in some parsers and 10 in others; ambiguity is refused outright.
    expect(ipToInt("010.0.0.1")).toBeNull();
    expect(ipToInt("1e2.0.0.1")).toBeNull();
    expect(ipToInt(" 10.0.0.1")).toBeNull();
    expect(ipToInt("10.0.0.256")).toBeNull();
  });

  it("normalises the range, so what is shown is what is swept", () => {
    // A host address inside the subnet is normalised to the network address; the label
    // and the host list are then derived from the same number.
    const res = parsePrivateCidr("192.168.0.25/24");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(cidrLabel(res.base, res.prefix)).toBe("192.168.0.0/24");
      expect(hostsOf(res.base, res.prefix)).toContain("192.168.0.56");
    }
  });
});
