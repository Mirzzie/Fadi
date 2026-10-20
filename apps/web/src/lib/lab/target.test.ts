import { describe, expect, it } from "vitest";

import { isConnected, resolveTarget } from "./target";

const proxmox = { id: "r1", label: "Proxmox at 192.168.0.56", endpoint: null };
const vm = { id: "r2", label: "DC01", endpoint: "vmware://local/home/me/vms/DC01.vmx" };

describe("where a project's lab actually runs", () => {
  it("no placement means this computer", () => {
    expect(resolveTarget({ resourceId: null }, null)).toEqual({
      kind: "local-docker",
      resourceId: null,
      label: "This computer",
    });
  });

  it("THE REVIEWED BUG: a registered machine with no connection is not quietly this laptop", () => {
    const target = resolveTarget({ resourceId: "r1" }, proxmox);
    expect(target.kind).toBe("unconnected");
    expect(target.label).toBe("Proxmox at 192.168.0.56");
  });

  it("a VMware guest registered by its .vmx path is a VMware target", () => {
    expect(resolveTarget({ resourceId: "r2" }, vm).kind).toBe("vmware");
  });

  it("a run whose machine was removed is not treated as this computer", () => {
    expect(resolveTarget({ resourceId: "gone" }, null).kind).toBe("unconnected");
  });

  it("a resource belonging to a different id never resolves as this run's target", () => {
    expect(resolveTarget({ resourceId: "r1" }, vm).kind).toBe("unconnected");
  });

  it("only connected resources can be placement candidates", () => {
    expect(isConnected(proxmox)).toBe(false);
    expect(isConnected(vm)).toBe(true);
    expect(isConnected({ id: "r3", label: "Laptop", endpoint: "local://docker" })).toBe(true);
  });
});
