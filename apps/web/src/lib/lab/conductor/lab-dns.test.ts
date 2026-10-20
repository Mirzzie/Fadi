import { describe, expect, it } from "vitest";

import { diagnoseLabDns, parseLabDns } from "./lab-dns";
import { requirementsFor } from "./graph";
import { remedyView } from "./remedies";

// What the owner's VM reported on 16 Oct 2026.
const owners = parseLabDns(
  '{"servers":"127.0.0.1","resolves":false,"direct":true,"role":5,"forwarders":["192.168.238.2"]}'
)!;

describe("why a Windows lab can't resolve names", () => {
  it("names the stale forwarder of a domain controller, and the gateway it should be", () => {
    const result = diagnoseLabDns(owners, "172.16.89.2");
    expect(result).toMatchObject({ verdict: "fail", remedy: "lab.dns_forwarder" });
    expect(result.seen).toContain("192.168.238.2");
    expect(result.seen).toContain("172.16.89.2");
  });

  it("blames the computer's side only when not even 1.1.1.1 answers", () => {
    expect(diagnoseLabDns({ ...owners, direct: false }, "172.16.89.2").remedy).toBe(
      "host.vmnet_dns"
    );
  });

  it("resets a member machine's DNS client, not a server it doesn't have", () => {
    const member = {
      servers: ["10.9.9.9"],
      resolves: false,
      direct: true,
      role: 3,
      forwarders: [],
    };
    expect(diagnoseLabDns(member, "172.16.89.2").remedy).toBe("lab.dns_client");
  });

  it("does not invent a cause it can't see", () => {
    const fine = diagnoseLabDns({ ...owners, forwarders: ["172.16.89.2"] }, "172.16.89.2");
    expect(fine).toMatchObject({ verdict: "fail", remedy: null });
    expect(diagnoseLabDns({ ...owners, resolves: true }, null).verdict).toBe("pass");
  });

  it("keeps only addresses from the machine's answer, and fails closed on garbage", () => {
    expect(parseLabDns('{"servers":["127.0.0.1","x; rm"],"forwarders":"1.2.3.4"}')).toMatchObject({
      servers: ["127.0.0.1"],
      forwarders: ["1.2.3.4"],
    });
    expect(parseLabDns("'Resolve-DnsName' is not recognized")).toBeNull();
  });

  it("builds the forwarder fix from the validated gateway only, to be typed into the lab", () => {
    const requirement = requirementsFor({
      placement: "vmware",
      hasSpec: true,
      services: [],
    }).find((r) => r.id === "internet")!;
    const view = remedyView({ kind: "manual", id: "lab.dns_forwarder" }, requirement, {
      vmnetIp: "172.16.89.1",
      natGateway: "172.16.89.2",
    });
    expect(view).toMatchObject({
      place: "lab",
      commands: ["Set-DnsServerForwarder -IPAddress 172.16.89.2", "Clear-DnsServerCache -Force"],
    });
    const bad = remedyView({ kind: "manual", id: "lab.dns_forwarder" }, requirement, {
      vmnetIp: null,
      natGateway: "1.2.3.4; Remove-Item C:\\",
    });
    expect(bad).toMatchObject({ commands: [] });
  });
});
