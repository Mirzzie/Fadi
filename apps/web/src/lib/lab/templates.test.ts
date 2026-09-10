import { describe, expect, it } from "vitest";

import { placeLab } from "./capability";
import { LAB_TEMPLATES, renderTemplate, specForTemplate } from "./templates";

/**
 * A catalogue becomes an engine at the point where it can say WHERE a lab goes.
 *
 * The two machines in this account make the case on their own: a 24GB laptop and a 4GB
 * Proxmox node are both "a computer", and only one of them can hold a Windows Server guest.
 * Getting that wrong does not fail loudly — it swaps for an hour and ruins an evening.
 */

const laptop = {
  id: "laptop",
  label: "This laptop",
  kind: "laptop",
  arch: "x86_64" as const,
  memoryMb: 22 * 1024,
  diskGb: 46,
  virtualization: "vms" as const,
  alwaysOn: false,
};

const proxmox = {
  id: "proxmox",
  label: "Proxmox at 192.168.0.56",
  kind: "hypervisor",
  arch: "x86_64" as const,
  memoryMb: 4 * 1024,
  diskGb: 200,
  virtualization: "vms" as const,
  alwaysOn: true,
};

describe("placing a Windows lab", () => {
  it("fits the 24GB laptop and NOT the 4GB Proxmox node", () => {
    const spec = specForTemplate("windows-server-2025");
    const plan = placeLab(spec, [laptop, proxmox]);

    expect(plan.fits.map((f) => f.id)).toContain("laptop");
    // 4GB total against a 4GB guest leaves the hypervisor nothing to run on. A matcher
    // that counted no overhead would call this a fit and be wrong in the expensive way.
    expect(plan.fits.map((f) => f.id)).not.toContain("proxmox");
  });

  it("asks for a host that runs VMs, whatever the packaging says", () => {
    // dockur/windows starts with `docker run`, which makes it look like a container. It is
    // QEMU. Calling it a container because docker launches it would put a Windows guest on
    // a Raspberry Pi.
    expect(specForTemplate("windows-11").needs).toBe("vms");
    expect(specForTemplate("linux-ubuntu").needs).toBe("containers");
  });

  it("counts host overhead rather than the guest alone", () => {
    expect(specForTemplate("windows-11").memoryMb).toBeGreaterThan(LAB_TEMPLATES["windows-11"].ramMb);
  });
});

describe("placing a Linux lab", () => {
  it("does NOT assume a hypervisor can run containers", () => {
    // My first version of this test expected the 128MB nginx to land on the always-on
    // Proxmox node, since it is small and the box stays up. The matcher refused, and it
    // was right: running VMs establishes a hypervisor, not a container runtime, its
    // images, its networking, or permission to use it.
    //
    // What the Proxmox box offers here is a PLAN — make a guest, install a runtime — which
    // is a prerequisite to state, not a capability to assume.
    const plan = placeLab(specForTemplate("linux-web"), [proxmox]);
    expect(plan.fits.map((f) => f.id)).not.toContain("proxmox");

    // And it lands in UNVERIFIED rather than in misses, which is the better answer again:
    // a hypervisor that could run containers after someone installs a runtime is not
    // impossible, it is unconfirmed. The check names what would settle it, so the answer
    // is a next step instead of a refusal.
    const pending = plan.unverified.find((u) => u.resource.id === "proxmox");
    expect(pending).toBeDefined();
    expect(pending?.checks.join(" ")).toMatch(/container/i);
  });

  it("fits a machine that actually runs containers", () => {
    const withDocker = { ...proxmox, id: "node-with-docker", virtualization: "containers" as const };
    const plan = placeLab(specForTemplate("linux-web"), [withDocker]);
    expect(plan.fits.map((f) => f.id)).toContain("node-with-docker");
  });
});

describe("the rendered argv", () => {
  it("gives Windows exactly the three flags it needs and nothing else", () => {
    const args = renderTemplate("windows-server-2025", "fadi-dc01");
    expect(args).toContain("--device");
    expect(args).toContain("/dev/kvm");
    expect(args).toContain("/dev/net/tun");
    expect(args).toContain("--cap-add");
    expect(args).toContain("NET_ADMIN");
    // The concessions that were never needed and are never made.
    for (const never of ["--privileged", "-v", "--volume", "--mount", "--network=host", "--user"]) {
      expect(args, never).not.toContain(never);
    }
  });

  it("gives Linux templates no elevated access at all", () => {
    for (const key of ["linux-ubuntu", "linux-web", "linux-postgres"] as const) {
      const args = renderTemplate(key, "fadi-x");
      expect(args, key).not.toContain("--device");
      expect(args, key).not.toContain("--cap-add");
    }
  });

  it("names the container from the caller and the image from the catalogue", () => {
    const args = renderTemplate("linux-web", "fadi-site");
    expect(args[args.indexOf("--name") + 1]).toBe("fadi-site");
    // The image is the last argument and comes from the template, never from a parameter.
    expect(args[args.length - 1]).toBe(LAB_TEMPLATES["linux-web"].image);
  });
});
