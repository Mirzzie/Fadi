/**
 * THE LAB CATALOGUE — machines Fadi knows how to bring up.
 *
 * A template is not a parameterised container. It is a whole, reviewed invocation with a
 * name, written out here by a person, including the parts that are dangerous. That is the
 * entire security model of this file: nothing composes these, nothing extends them, and a
 * caller picks a KEY.
 *
 * WHY THE DANGEROUS FLAGS ARE HERE AT ALL.
 *
 * Running Windows means running a VM. dockur/windows is QEMU wearing a container, and it
 * needs `/dev/kvm`, `/dev/net/tun` and `NET_ADMIN` to work — three things the recipe tests
 * otherwise forbid outright, because a recipe that can pass `--device` can hand over the
 * host.
 *
 * The ban was right for *composable* recipes and wrong as an absolute. The honest
 * invariant is not "no recipe may ever emit --device"; it is:
 *
 *     ONLY A TEMPLATE DECLARED AS NEEDING VIRTUALISATION MAY EMIT THESE, AND ONLY THIS
 *     EXACT SET, AND THE SET IS NOT DERIVED FROM ANYTHING A CALLER SAYS.
 *
 * That is testable, and it is tested. A template that asks for `--privileged`, a bind mount
 * of the host filesystem, or host networking fails the suite — those are not needed by
 * anything here and would be a different conversation.
 */

export type LabTemplate = {
  /** What the person is starting, in their words. */
  label: string;
  /** What it is FOR — so the catalogue reads as lab work, not as a list of images. */
  purpose: string;
  image: string;
  /** Fixed environment. Values are literals; nothing here is interpolated from input. */
  env: Record<string, string>;
  /** Host ports this publishes, and what each is for. */
  ports: Array<{ host: number; container: number; proto?: "tcp" | "udp"; what: string }>;
  /** Memory the machine actually needs to run, not the minimum it will boot with. */
  ramMb: number;
  /** Free disk it needs before starting, including the download. */
  diskGb: number;
  /**
   * True when this is a virtual machine in a container and needs KVM plus a TAP device.
   * The flag that unlocks the otherwise-forbidden argv, and the only thing that does.
   */
  needsVirtualisation: boolean;
  /**
   * Where the machine keeps its state, when it has any worth keeping.
   *
   * Given a NAMED volume, never a host path — Docker owns the storage and there is no
   * route from it to the filesystem. Absent for templates that are genuinely disposable.
   */
  persistentPath?: string;
  /** Said plainly at the point of consent. */
  caveat?: string;
};

/**
 * Windows versions are passed to dockur as a VERSION string. Kept as a closed set rather
 * than a free field: "the model picks the Windows version" and "the model picks what
 * dockur downloads and runs" are the same sentence.
 */
export const LAB_TEMPLATES: Record<string, LabTemplate> = {
  "windows-server-2025": {
    label: "Windows Server 2025",
    purpose: "Active Directory, Group Policy, PowerShell administration, domain services.",
    image: "dockurr/windows",
    env: { VERSION: "2025", RAM_SIZE: "4G", CPU_CORES: "2", DISK_SIZE: "64G" },
    ports: [
      { host: 8006, container: 8006, what: "the browser viewer, for the install and first boot" },
      { host: 3389, container: 3389, what: "Remote Desktop, once it is up" },
    ],
    ramMb: 4096,
    diskGb: 40,
    needsVirtualisation: true,
    // dockur keeps the guest disk here. Without it an hour of Windows Setup is lost the
    // first time the machine stops.
    persistentPath: "/storage",
    caveat:
      "This installs Windows from Microsoft's own evaluation media. You are responsible for licensing it, and the install takes a while before anything is usable.",
  },

  "windows-11": {
    label: "Windows 11 Pro",
    purpose: "Endpoint work: policy, hardening, EDR, anything that needs a real desktop.",
    image: "dockurr/windows",
    env: { VERSION: "11", RAM_SIZE: "4G", CPU_CORES: "2", DISK_SIZE: "64G" },
    ports: [
      { host: 8006, container: 8006, what: "the browser viewer, for the install and first boot" },
      { host: 3389, container: 3389, what: "Remote Desktop, once it is up" },
    ],
    ramMb: 4096,
    diskGb: 40,
    needsVirtualisation: true,
    // dockur keeps the guest disk here. Without it an hour of Windows Setup is lost the
    // first time the machine stops.
    persistentPath: "/storage",
    caveat:
      "This installs Windows from Microsoft's own evaluation media. You are responsible for licensing it, and the install takes a while before anything is usable.",
  },

  /**
   * Linux labs are ordinary containers, which is why they are separated from the two
   * above: no KVM, no TAP device, no elevated capability, up in seconds rather than an
   * hour. If a project can be done on Linux, it should be.
   */
  "linux-ubuntu": {
    label: "Ubuntu 24.04",
    purpose: "Services, scripting, containers, CI — most build projects want this.",
    image: "ubuntu:24.04",
    env: {},
    ports: [],
    ramMb: 512,
    diskGb: 2,
    needsVirtualisation: false,
  },

  "linux-web": {
    label: "Nginx web server",
    purpose: "Reverse proxies, TLS, headers, static hosting.",
    image: "nginx:1.27-alpine",
    env: {},
    ports: [{ host: 8080, container: 80, what: "the site it serves" }],
    ramMb: 128,
    diskGb: 1,
    needsVirtualisation: false,
  },

  "linux-postgres": {
    label: "PostgreSQL 16",
    purpose: "Backups, replication, tuning, anything that needs a real database.",
    image: "postgres:16-alpine",
    env: { POSTGRES_PASSWORD: "fadilab" },

    ports: [{ host: 5432, container: 5432, what: "the database" }],
    ramMb: 512,
    diskGb: 2,
    needsVirtualisation: false,
    persistentPath: "/var/lib/postgresql/data",
    caveat: "The password is a fixed lab value. Do not put anything real in this database.",
  },
};

export type TemplateKey = keyof typeof LAB_TEMPLATES;

export function isTemplateKey(value: string): value is TemplateKey {
  return Object.prototype.hasOwnProperty.call(LAB_TEMPLATES, value);
}

/**
 * The argv for a template, built here so the dangerous flags live beside the reason they
 * are needed.
 *
 * `name` arrives already validated and prefixed by the caller; nothing else in this
 * function comes from outside the file.
 */
export function renderTemplate(key: TemplateKey, containerName: string): string[] {
  const t = LAB_TEMPLATES[key];
  const args = ["run", "-d", "--name", containerName];

  if (t.needsVirtualisation) {
    // The three flags, and only these three. KVM to run the VM at all, a TAP device for
    // its network, and NET_ADMIN to configure that device. Not --privileged, no host
    // networking, no host filesystem: none of those are needed and each is a bigger
    // concession than the job requires.
    args.push("--device", "/dev/kvm", "--device", "/dev/net/tun", "--cap-add", "NET_ADMIN");
    // Windows does not appreciate being killed mid-write.
    args.push("--stop-timeout", "120");
  }

  for (const [k, v] of Object.entries(t.env)) args.push("-e", k + "=" + v);
  // Local lab surfaces stay behind this application. Publishing without an address makes
  // Docker listen on every interface, which exposed the Windows installer, RDP and fixed
  // lab passwords to the LAN. Remote access is a separate, explicitly approved operation.
  for (const p of t.ports) {
    args.push("-p", "127.0.0.1:" + p.host + ":" + p.container + (p.proto === "udp" ? "/udp" : ""));
  }

  // PERSISTENCE, and why this is not the bind-mount the rules forbid.
  //
  // Without storage a lab dies when it stops: a Windows Server that has spent an hour
  // installing is gone the moment the laptop sleeps. That makes it a demo, not a lab, and
  // the whole point is that a project spans evenings.
  //
  // The ban was on HOST PATHS — "-v /:/host" hands over the filesystem, and no template
  // needs that. A NAMED VOLUME is a different thing: Docker owns it, it has no host path,
  // and nothing inside the container can reach the machine through it. The name is derived
  // from the container name, which is itself prefixed and validated, so a lab can only ever
  // address its own storage.
  //
  // Bind mounts stay forbidden. This is the narrower permission that does the job.
  if (t.persistentPath) {
    args.push("-v", containerName + "-storage:" + t.persistentPath);
  }

  args.push(t.image);
  return args;
}

/**
 * What a template needs, in the shape the placement matcher already speaks.
 *
 * This is what turns a catalogue into an engine: given the machines someone owns, Fadi can
 * say WHERE a lab goes rather than assuming it goes here. The two machines in front of me
 * make the point — a 24GB laptop and a 4GB Proxmox node are both "a computer", and only one
 * of them can hold a Windows Server guest.
 *
 * Overhead is counted deliberately. A host with exactly the guest's memory has none left
 * for itself, and a placement that assumes otherwise is how "it fits" becomes "it swapped".
 */
export function specForTemplate(key: TemplateKey): {
  memoryMb: number;
  diskGb: number;
  needs: "containers" | "vms";
  arch: Array<"x86_64">;
} {
  const t = LAB_TEMPLATES[key];
  return {
    // A gigabyte for the host to keep being a host.
    memoryMb: t.ramMb + 1024,
    diskGb: t.diskGb,
    // Windows-in-a-container is a VM, whatever the packaging says, so it asks for a host
    // that runs VMs rather than one that runs containers. Calling it a container because
    // docker starts it would put a Windows guest on a Raspberry Pi.
    needs: t.needsVirtualisation ? "vms" : "containers",
    arch: ["x86_64"],
  };
}
