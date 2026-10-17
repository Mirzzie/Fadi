import { describe, expect, it } from "vitest";

import type { Observation } from "./contract";
import { firewallVerdict } from "./firewall";
import { conduct, orderRequirements, requirementsFor, type LabSpec } from "./graph";
import { remedyView } from "./remedies";

const siemOnVmware: LabSpec = {
  placement: "vmware",
  hasSpec: true,
  services: [{ key: "wazuh", label: "Wazuh 4.14.9 SIEM", agentPorts: [1514, 1515] }],
};

// Room on the computer is assumed unless a test says otherwise.
const seen = (verdicts: Record<string, Observation["verdict"]>) =>
  new Map(
    Object.entries({ "host-disk": "pass" as const, ...verdicts }).map(([requirementId, verdict]) => [
      requirementId,
      {
        requirementId,
        predicateId: "lab_spec.exists" as const,
        predicateVersion: 1,
        verdict,
        evidence: {},
        observerVersion: "test",
        observedAt: new Date(0).toISOString(),
      },
    ])
  );

describe("the requirement graph", () => {
  it("orders a SIEM on VMware the way Codex set: computer, baseline, machine, service, reach, plan", () => {
    expect(orderRequirements(requirementsFor(siemOnVmware)).map((r) => r.id)).toEqual([
      "lab-spec",
      "host-disk",
      "host-dns",
      "host-firewall",
      "baseline",
      "machine",
      "channel",
      "internet",
      "service-wazuh",
      "reach-wazuh",
      "plan",
    ]);
  });

  it("asks a project with no lab only to plan", () => {
    const ids = requirementsFor({ placement: "none", hasSpec: false, services: [] }).map(
      (r) => r.id
    );
    expect(ids).toEqual(["lab-spec", "plan"]);
  });

  it("has no host gates for Fadi's own container lab", () => {
    const ids = requirementsFor({ ...siemOnVmware, placement: "fadi-container" }).map((r) => r.id);
    expect(ids).not.toContain("host-firewall");
    expect(ids).not.toContain("baseline");
  });
});

describe("what is next", () => {
  const all = requirementsFor(siemOnVmware);

  it("is the first hard requirement not met whose own dependencies are met", () => {
    const result = conduct(
      all,
      seen({ "lab-spec": "pass", "host-dns": "pass", "host-firewall": "fail" })
    );
    expect(result.next?.requirement.id).toBe("host-firewall");
    expect(result.items.find((i) => i.requirement.id === "service-wazuh")?.state).toBe("waiting");
    expect(result.ready).toBe(false);
  });

  it("treats unknown as not met — never as passed", () => {
    const result = conduct(all, seen({ "lab-spec": "pass", "host-dns": "unknown" }));
    expect(result.next?.requirement.id).toBe("host-dns");
  });

  it("puts everything after a stopped machine back to waiting, whatever was seen before", () => {
    const result = conduct(
      all,
      seen({
        "lab-spec": "pass",
        "host-dns": "pass",
        "host-firewall": "pass",
        baseline: "pass",
        machine: "fail",
        channel: "pass",
        "reach-wazuh": "pass",
      })
    );
    expect(result.next?.requirement.id).toBe("machine");
    expect(result.items.find((i) => i.requirement.id === "channel")?.state).toBe("waiting");
  });

  it("lets a failed soft requirement warn without holding the plan back", () => {
    const soft = all.map((r) => (r.id === "internet" ? { ...r, blocking: "soft" as const } : r));
    const result = conduct(
      soft,
      seen({
        "lab-spec": "pass",
        "host-dns": "pass",
        "host-firewall": "pass",
        baseline: "pass",
        machine: "pass",
        channel: "pass",
        internet: "fail",
        "service-wazuh": "pass",
        "reach-wazuh": "pass",
      })
    );
    expect(result.next?.requirement.id).toBe("plan");
    expect(result.items.find((i) => i.requirement.id === "internet")?.state).toBe("open");
  });

  it("is ready when every hard requirement is met", () => {
    const every = Object.fromEntries(all.map((r) => [r.id, "pass" as const]));
    const result = conduct(all, seen(every));
    expect(result.next).toBeNull();
    expect(result.ready).toBe(true);
  });

  it("holds the plan back while the machine has no internet (16 Oct 2026)", () => {
    const every = Object.fromEntries(all.map((r) => [r.id, "pass" as const]));
    const result = conduct(all, seen({ ...every, internet: "fail", plan: "fail" }));
    expect(result.next?.requirement.id).toBe("internet");
    expect(result.items.find((i) => i.requirement.id === "plan")?.state).toBe("waiting");
  });
});

describe("the computer's firewall, from ufw's own files", () => {
  const need = {
    ports: [1514, 1515],
    iface: "vmnet8",
    hostIp: "172.16.89.1",
    subnet: "172.16.89.0/24",
  };
  const on = { ufwConf: "ENABLED=yes\nLOGLEVEL=low\n", defaults: 'DEFAULT_INPUT_POLICY="DROP"\n' };
  // The owner's rules on 15 Oct 2026, before and after the fix.
  const before = [
    "-A ufw-user-input -p udp -m multiport --dports 1714:1764 -j ACCEPT -m comment --comment 'dapp_KDE%20Connect'",
    "-A ufw-user-input -p tcp -m multiport --dports 1714:1764 -j ACCEPT -m comment --comment 'dapp_KDE%20Connect'",
    "-A ufw-user-input -s 192.168.0.103 -j ACCEPT",
  ].join("\n");
  const after = `${before}\n-A ufw-user-input -i vmnet8 -p tcp -m multiport --dports 1514:1515 -d 172.16.89.1 -j ACCEPT`;

  it("fails before the rule, naming the missing ports", () => {
    expect(firewallVerdict({ ...on, userRules: before }, need)).toMatchObject({
      verdict: "fail",
      missing: [1514, 1515],
    });
  });

  it("passes with the rule Fadi suggests", () => {
    expect(firewallVerdict({ ...on, userRules: after }, need).verdict).toBe("pass");
  });

  it("does not count a rule for another interface, address or one home machine", () => {
    const other =
      "-A ufw-user-input -i wlan0 -p tcp --dport 1514 -j ACCEPT\n-A ufw-user-input -p tcp -d 10.0.0.1 --dport 1515 -j ACCEPT";
    expect(firewallVerdict({ ...on, userRules: other }, need).missing).toEqual([1514, 1515]);
  });

  it("counts a rule for the whole VMware network", () => {
    const net = "-A ufw-user-input -s 172.16.89.0/24 -j ACCEPT";
    expect(firewallVerdict({ ...on, userRules: net }, need).verdict).toBe("pass");
  });

  it("passes when ufw is off or accepts by default; unknown without ufw or its rules", () => {
    expect(
      firewallVerdict({ ufwConf: "ENABLED=no", defaults: null, userRules: null }, need).verdict
    ).toBe("pass");
    expect(
      firewallVerdict({ ...on, defaults: 'DEFAULT_INPUT_POLICY="ACCEPT"', userRules: null }, need)
        .verdict
    ).toBe("pass");
    expect(firewallVerdict({ ufwConf: null, defaults: null, userRules: null }, need).verdict).toBe(
      "unknown"
    );
    expect(firewallVerdict({ ...on, userRules: null }, need).verdict).toBe("unknown");
  });
});

describe("remedies are closed ids with reviewed text", () => {
  it("builds the firewall command only from the requirement's numbers and the vmnet address", () => {
    const requirement = requirementsFor(siemOnVmware).find((r) => r.id === "host-firewall")!;
    const view = remedyView(requirement.remedy!, requirement, { vmnetIp: "172.16.89.1" });
    expect(view).toMatchObject({
      kind: "manual",
      commands: [
        "sudo ufw allow in on vmnet8 to 172.16.89.1 port 1514:1515 proto tcp comment 'Fadi lab services from VMware machines'",
      ],
    });
    const odd = remedyView(requirement.remedy!, requirement, { vmnetIp: "$(rm -rf ~)" });
    expect(JSON.stringify(odd)).not.toContain("rm -rf");
  });
});

describe("a project already under way (16 Oct 2026)", () => {
  it("doesn't hold the machine's checks behind a snapshot that would no longer be clean", () => {
    const all = requirementsFor({ ...siemOnVmware, progressed: true });
    const result = conduct(
      all,
      seen({
        "lab-spec": "pass",
        "host-dns": "pass",
        "host-firewall": "pass",
        baseline: "fail",
        machine: "pass",
        channel: "pass",
        internet: "fail",
        "service-wazuh": "pass",
        "reach-wazuh": "pass",
        plan: "pass",
      })
    );
    expect(result.next?.requirement.id).toBe("internet");
    expect(result.items.find((i) => i.requirement.id === "baseline")).toMatchObject({
      state: "open",
      requirement: { blocking: "soft" },
    });
  });
});

describe("no 'clean start' offered for a machine the project has already changed", () => {
  it("offers to save one before the project begins, never after", () => {
    const fresh = requirementsFor(siemOnVmware).find((r) => r.id === "baseline")!;
    expect(fresh.remedy).toMatchObject({ id: "vmware.snapshot" });
    const begun = requirementsFor({ ...siemOnVmware, progressed: true }).find((r) => r.id === "baseline")!;
    expect(begun.remedy).toBeNull();
  });
});

describe("room on this computer (17 Oct 2026: 1.3 GB free)", () => {
  it("comes before anything that writes: the snapshot, the machine and the services wait for it", () => {
    const all = requirementsFor({
      ...siemOnVmware,
      services: [{ key: "wazuh", label: "Wazuh", agentPorts: [1514, 1515], diskGb: 6 }],
    });
    expect(all.find((r) => r.id === "host-disk")?.params.gb).toBe(16);
    const result = conduct(all, seen({ "lab-spec": "pass", "host-disk": "fail" }));
    expect(result.next?.requirement.id).toBe("host-disk");
    for (const id of ["baseline", "service-wazuh"]) {
      expect(result.items.find((i) => i.requirement.id === id)?.state).toBe("waiting");
    }
  });
});
