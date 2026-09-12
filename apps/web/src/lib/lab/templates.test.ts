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
    expect(specForTemplate("windows-11").memoryMb).toBeGreaterThan(
      LAB_TEMPLATES["windows-11"].ramMb
    );
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
    const withDocker = {
      ...proxmox,
      id: "node-with-docker",
      virtualization: "containers" as const,
    };
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
    // The concessions that were never needed and are never made. "-v" left this list when
    // labs gained persistence: the ban was always about HOST PATHS, and a named volume is
    // not one. The separate suite below proves no template can mount a host path.
    for (const never of ["--privileged", "--mount", "--network=host", "--user", "--pid"]) {
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

  it("binds every lab endpoint to loopback", () => {
    for (const key of [
      "windows-server-2025",
      "windows-11",
      "linux-web",
      "linux-postgres",
    ] as const) {
      const args = renderTemplate(key, "fadi-local");
      const bindings = args.filter((arg, index) => args[index - 1] === "-p");
      expect(bindings.length, key).toBeGreaterThan(0);
      expect(
        bindings.every((binding) => binding.startsWith("127.0.0.1:")),
        key
      ).toBe(true);
    }
  });
});

describe("a lab survives being stopped", () => {
  it("gives Windows a named volume, so an hour of Setup is not lost to a closed lid", async () => {
    const { renderTemplate } = await import("./templates");
    const args = renderTemplate("windows-server-2025", "fadi-dc01");
    const i = args.indexOf("-v");
    expect(i, "Windows must keep its disk").toBeGreaterThan(-1);
    expect(args[i + 1]).toBe("fadi-dc01-storage:/storage");
  });

  it("NEVER mounts a host path — that is what the ban was always about", async () => {
    const { LAB_TEMPLATES, renderTemplate } = await import("./templates");
    for (const key of Object.keys(LAB_TEMPLATES)) {
      const args = renderTemplate(key as keyof typeof LAB_TEMPLATES, "fadi-x");
      for (let i = 0; i < args.length; i++) {
        if (args[i] !== "-v") continue;
        const source = args[i + 1].split(":")[0];
        // "-v /:/host" hands over the filesystem. "-v fadi-x-storage:/storage" is a volume
        // Docker owns, with no path into the machine.
        expect(source.startsWith("/"), key).toBe(false);
        expect(source).toBe("fadi-x-storage");
      }
    }
  });

  it("gives a disposable template no storage at all", async () => {
    const { renderTemplate } = await import("./templates");
    // An nginx serving a static page has nothing worth keeping; a volume per lab that
    // never needed one is litter on someone's disk.
    expect(renderTemplate("linux-web", "fadi-site")).not.toContain("-v");
  });

  it("binds every published port to loopback", async () => {
    const { LAB_TEMPLATES, renderTemplate } = await import("./templates");
    for (const key of Object.keys(LAB_TEMPLATES)) {
      const args = renderTemplate(key as keyof typeof LAB_TEMPLATES, "fadi-x");
      for (let i = 0; i < args.length; i++) {
        if (args[i] !== "-p") continue;
        // Verified the hard way: without this the Windows installer and RDP were reachable
        // from every device on the home network, and ufw does not help because Docker's
        // publishing bypasses it.
        expect(args[i + 1].startsWith("127.0.0.1:"), key + " published " + args[i + 1]).toBe(true);
      }
    }
  });
});

describe("the lab naming convention has one definition", () => {
  it("names the container the way docker will show it", async () => {
    const { labContainerForRun, labNameForRun } = await import("./templates");
    const run = "bb94e388-a775-4892-aed3-3145df33b3d7";
    // Two places compute this; if they disagreed, step one would hand someone a docker exec
    // for a container that does not exist.
    expect(labNameForRun(run)).toBe("project-bb94e388");
    expect(labContainerForRun(run)).toBe("fadi-project-bb94e388");
  });
});
