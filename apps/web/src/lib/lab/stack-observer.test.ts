import { describe, expect, it } from "vitest";

import { parsePs, summariseStack } from "./stack-observer";
import { stacksForProject, vmNetworkAddress } from "./stacks";

const SERVICES = ["wazuh.manager", "wazuh.indexer", "wazuh.dashboard"];
const row = (Service: string, State: string) => JSON.stringify({ Service, State });

describe("whether a stack is up", () => {
  it("reads both shapes Compose prints", () => {
    expect(parsePs(`${row("a", "running")}\n${row("b", "exited")}\n`)).toHaveLength(2);
    expect(parsePs(`[${row("a", "running")}]`)).toHaveLength(1);
    expect(parsePs("")).toEqual([]);
  });

  it("is up only when every service runs and the dashboard answers", () => {
    const all = SERVICES.map((s) => ({ Service: s, State: "running" }));
    expect(summariseStack(all, SERVICES, true).state).toBe("running");
    expect(summariseStack(all, SERVICES, false).state).toBe("starting");
    expect(summariseStack(all.slice(1), SERVICES, true)).toMatchObject({
      state: "partial",
      running: 2,
      total: 3,
    });
    expect(
      summariseStack([{ Service: "wazuh.manager", State: "exited" }], SERVICES, false).state
    ).toBe("stopped");
    expect(summariseStack([], SERVICES, false).state).toBe("absent");
  });
});

describe("which stacks a project needs, and where agents connect", () => {
  it("only when the project says so", () => {
    expect(stacksForProject({ title: "Open-Source SIEM & Reporting for an SME" })).toEqual([
      "wazuh",
    ]);
    expect(stacksForProject({ title: "Harden nginx", detail: "Deploy Wazuh agent" })).toEqual([
      "wazuh",
    ]);
    expect(stacksForProject({ title: "Active Directory lab" })).toEqual([]);
  });

  it("uses the VMware network, never a home-network interface", () => {
    const iface = (address: string) => [
      { address, family: "IPv4", internal: false, netmask: "", mac: "", cidr: null },
    ];
    expect(
      vmNetworkAddress({ wlan0: iface("192.168.1.20"), vmnet8: iface("172.16.89.1") } as never)
    ).toBe("172.16.89.1");
    expect(vmNetworkAddress({ wlan0: iface("192.168.1.20") } as never)).toBe("127.0.0.1");
  });
});
