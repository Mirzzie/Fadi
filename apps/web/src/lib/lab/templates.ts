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
  /**
   * How the person signs in to the machine, when it has a login. A plan said "log in with the
   * supplied Administrator credentials" for a Windows lab that was never given any: dockur
   * creates one local administrator, and nothing told the planner or the person its name.
   * Set here, passed to the image, told to the planner and shown in the lab panel — one value.
   * A fixed lab value, like the Postgres template's password: nothing real goes in the lab.
   */
  signIn?: { user: string; password: string };
  /**
   * WHAT IS ACTUALLY INSIDE, measured from the image rather than assumed.
   *
   * A plan told the owner to run "sudo apt-get update" in a lab that was Alpine Linux —
   * no apt, no sudo. The briefing had said "Linux", which was true and useless: Ubuntu and
   * Alpine share a kernel and not a single package command. Each value below was read by
   * running the image, because a template description is exactly the kind of thing that
   * drifts from what the image really contains.
   */
  toolchain: {
    distro: string;
    packageManager: "apt" | "apk" | "winget";
    /** Containers run as root; telling someone to sudo produces "command not found". */
    hasSudo: boolean;
    shell: "bash" | "sh" | "powershell";
    /**
     * How long-running programs are started. A container has no init system: rc-service,
     * systemctl and service all fail with "not found" — reported from a real lab, where a
     * plan's "rc-service nginx start" and "rc-service fail2ban start" both died that way.
     */
    serviceManager: "none" | "windows";
    /**
     * Whether the lab may change packet filtering. Containers run without NET_ADMIN, so
     * iptables/nftables — and anything that bans by writing them, like fail2ban — cannot
     * take effect. A plan that promises bans the lab cannot make is a false success.
     */
    firewall: boolean;
    /** The program already running as the container's main process, and how to reload it. */
    mainService?: { name: string; reload: string; logs?: string };
  };
  /** Said plainly at the point of consent. */
  caveat?: string;
};

/**
 * Windows versions are passed to dockur as a VERSION string. Kept as a closed set rather
 * than a free field: "the model picks the Windows version" and "the model picks what
 * dockur downloads and runs" are the same sentence.
 */
/** Host port for a Windows lab's SSH; published on 127.0.0.1 only, like every lab port. */
export const WINDOWS_SSH_PORT = 2222;

export const LAB_TEMPLATES: Record<string, LabTemplate> = {
  "windows-server-2025": {
    toolchain: {
      distro: "Windows Server 2025",
      packageManager: "winget",
      hasSudo: false,
      shell: "powershell",
      serviceManager: "windows",
      firewall: true,
    },
    label: "Windows Server 2025",
    purpose: "Active Directory, Group Policy, PowerShell administration, domain services.",
    image: "dockurr/windows",
    // dockur's own defaults, set explicitly so the value is ours to state, not an accident:
    // a lab installed before this line has exactly this account.
    env: {
      VERSION: "2025",
      RAM_SIZE: "4G",
      CPU_CORES: "2",
      DISK_SIZE: "64G",
      USERNAME: "Docker",
      PASSWORD: "admin",
    },
    signIn: { user: "Docker", password: "admin" },
    ports: [
      { host: 8006, container: 8006, what: "the browser viewer, for the install and first boot" },
      { host: 3389, container: 3389, what: "Remote Desktop, once it is up" },
      { host: WINDOWS_SSH_PORT, container: 22, what: "SSH, so Fadi can run the checks you approve" },
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
    toolchain: {
      distro: "Windows 11",
      packageManager: "winget",
      hasSudo: false,
      shell: "powershell",
      serviceManager: "windows",
      firewall: true,
    },
    label: "Windows 11 Pro",
    purpose: "Endpoint work: policy, hardening, EDR, anything that needs a real desktop.",
    image: "dockurr/windows",
    // dockur's own defaults, set explicitly so the value is ours to state, not an accident:
    // a lab installed before this line has exactly this account.
    env: {
      VERSION: "11",
      RAM_SIZE: "4G",
      CPU_CORES: "2",
      DISK_SIZE: "64G",
      USERNAME: "Docker",
      PASSWORD: "admin",
    },
    signIn: { user: "Docker", password: "admin" },
    ports: [
      { host: 8006, container: 8006, what: "the browser viewer, for the install and first boot" },
      { host: 3389, container: 3389, what: "Remote Desktop, once it is up" },
      { host: WINDOWS_SSH_PORT, container: 22, what: "SSH, so Fadi can run the checks you approve" },
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
    toolchain: {
      distro: "Ubuntu 24.04",
      packageManager: "apt",
      hasSudo: false,
      shell: "bash",
      serviceManager: "none",
      firewall: false,
    },
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
    toolchain: {
      distro: "Alpine Linux",
      packageManager: "apk",
      hasSudo: false,
      shell: "sh",
      serviceManager: "none",
      firewall: false,
      mainService: {
        name: "nginx",
        reload: "nginx -t && nginx -s reload",
        // Measured in a running lab: the official image links both logs to the container's
        // output, so fail2ban (or tail) inside the lab has no file to read.
        logs: "/var/log/nginx/access.log and error.log are symlinks to /dev/stdout and /dev/stderr, not files. Anything that reads logs inside the lab (fail2ban, tail, grep) needs nginx to write a real file first: in /etc/nginx/nginx.conf the line is `access_log  /var/log/nginx/access.log  main;` — add a second line `access_log /var/log/nginx/access-file.log main;` next to it, then reload. 404 and 403 responses are in the ACCESS log, not the error log.",
      },
    },
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
    toolchain: {
      distro: "Alpine Linux",
      packageManager: "apk",
      hasSudo: false,
      shell: "bash",
      serviceManager: "none",
      firewall: false,
      mainService: { name: "postgres", reload: "su postgres -c 'pg_ctl reload'" },
    },
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

/**
 * The name a project's lab is started under, as the parameter the recipe validates.
 *
 * One definition, because two places compute it — the lab action that starts the
 * container, and the planner that tells the person how to open a shell in it. If they
 * disagreed, step one would hand someone a docker exec for a container that does not exist.
 */
export function labNameForRun(runId: string): string {
  return "project-" + runId.slice(0, 8);
}

/** The container name docker will actually show, with the prefix the renderer adds. */
export function labContainerForRun(runId: string): string {
  return "fadi-" + labNameForRun(runId);
}

// ── Installed bases and lab disks ─────────────────────────────────────────────
//
// Every Windows project used to get a fresh volume, download the 8.2 GB evaluation ISO again
// and spend an hour in Windows Setup — measured on the owner's machine, two labs, two
// downloads. dockur keeps an installed machine as plain files in /storage (data.img plus a
// few windows.* files), so a finished install can be copied: saved once as a base, then
// copied into each new lab's volume before it starts. The copy boots straight to the desktop.
//
// Copies run in a pinned helper with no network and only named volumes mounted — the same
// narrow permission the labs themselves use, never a host path. GNU cp keeps the 64 GB sparse
// disk sparse, so a copy costs what is actually written (10–18 GB here), not 64 GB.

/** Pinned helper for disk copies and measurements. */
export const DISK_HELPER_IMAGE = "debian:bookworm-slim";

/** A copy of a Windows disk takes minutes; the broker's usual minute is not enough. */
export const DISK_COPY_TIMEOUT_MS = 30 * 60 * 1000;

/** Templates whose installed state is worth keeping as a base: the VM ones. */
export function supportsBase(key: TemplateKey): boolean {
  const t = LAB_TEMPLATES[key];
  return t.needsVirtualisation && t.persistentPath === "/storage";
}

/** One base per template, shared by every project that uses it. */
export function baseVolumeFor(key: TemplateKey): string {
  return "fadi-base-" + key;
}

/** A lab's own disk, as renderTemplate names it. */
export function storageVolumeFor(containerName: string): string {
  return containerName + "-storage";
}

// The installer and the network identity stay behind: the ISO is only needed to install,
// setup.img is the unattended-answer disk, and windows.mac would give two labs one MAC.
const SAVE_BASE =
  "find /from -maxdepth 1 -type f ! -name '*.iso' ! -name setup.img ! -name windows.mac " +
  "-exec cp -a --sparse=always {} /to/ ';'";
const SEED_FROM_BASE = "cp -a --sparse=always /from/. /to/";

function helperArgs(from: string, to: string, script: string): string[] {
  return [
    "run",
    "--rm",
    "--network",
    "none",
    "-v",
    from + ":/from:ro",
    "-v",
    to + ":/to",
    DISK_HELPER_IMAGE,
    "sh",
    "-c",
    script,
  ];
}

/** Copy a lab's installed machine into the template's base. */
export function saveBaseArgs(key: TemplateKey, containerName: string): string[] {
  return helperArgs(storageVolumeFor(containerName), baseVolumeFor(key), SAVE_BASE);
}

/** Give a new lab its disk from the base, before it first starts. */
export function seedFromBaseArgs(key: TemplateKey, containerName: string): string[] {
  return helperArgs(baseVolumeFor(key), storageVolumeFor(containerName), SEED_FROM_BASE);
}


// ── Checks inside Windows labs ────────────────────────────────────────────────
//
// Fadi could not check a single Windows step: `lab.check` ran `docker exec` in dockur's Linux
// wrapper, not in Windows. dockur runs C:\OEM\install.bat at the end of Setup and looks for the
// OEM folder in /storage/oem — the lab's own volume — so before a fresh Windows lab first starts,
// Fadi writes a small script there that turns on the built-in OpenSSH server, makes PowerShell
// its shell, and authorises Fadi's lab key for the local administrator. Checks then run over SSH
// on 127.0.0.1, after approval, exactly like the Linux ones run through docker exec.


export const LAB_KEY_COMMENT = "fadi-lab";

/** Where Fadi keeps its lab key: outside the repository, readable by this user only. */
export function labKeyPath(): string {
  const base =
    process.env.FADI_LAB_KEY_DIR?.trim() ||
    `${process.env.XDG_CONFIG_HOME?.trim() || `${process.env.HOME ?? ""}/.config`}/fadi/lab-ssh`;
  return `${base}/id_ed25519`;
}

/** A public key Fadi may place in a lab: its own ed25519 key and nothing else. */
export const LAB_PUBLIC_KEY_RE = /^ssh-ed25519 [A-Za-z0-9+/]{68} fadi-lab$/;

const ENABLE_SSH_PS1 = [
  "$ErrorActionPreference = 'Continue'",
  "# Windows Server 2025 ships OpenSSH Server; older images may need the capability added.",
  "if (-not (Get-Service sshd -ErrorAction SilentlyContinue)) {",
  "  Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Out-Null",
  "}",
  "Set-Service -Name sshd -StartupType Automatic",
  "Start-Service sshd",
  "New-Item -Path 'HKLM:\\SOFTWARE\\OpenSSH' -Force | Out-Null",
  "New-ItemProperty -Path 'HKLM:\\SOFTWARE\\OpenSSH' -Name DefaultShell -Value 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' -PropertyType String -Force | Out-Null",
  "$keys = 'C:\\ProgramData\\ssh\\administrators_authorized_keys'",
  "Get-Content 'C:\\OEM\\fadi.pub' | Set-Content -Path $keys -Encoding ascii",
  "icacls $keys /inheritance:r /grant 'Administrators:F' /grant 'SYSTEM:F' | Out-Null",
  "New-NetFirewallRule -Name fadi-sshd -DisplayName 'OpenSSH (Fadi lab checks)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 -ErrorAction SilentlyContinue | Out-Null",
  "Restart-Service sshd",
].join("\r\n");

const INSTALL_BAT = [
  "@echo off",
  "powershell -NoProfile -ExecutionPolicy Bypass -File C:\\OEM\\enable-ssh.ps1",
].join("\r\n");

// The three files are passed as positional arguments, never spliced into the script text.
const WRITE_OEM =
  'mkdir -p /to/oem && printf "%s" "$1" > /to/oem/install.bat && ' +
  'printf "%s" "$2" > /to/oem/enable-ssh.ps1 && printf "%s\\n" "$3" > /to/oem/fadi.pub';

/** Write the SSH set-up into a fresh Windows lab's volume, before its first start. */
export function prepareWindowsSshArgs(containerName: string, publicKey: string): string[] {
  return [
    "run", "--rm", "--network", "none",
    "-v", storageVolumeFor(containerName) + ":/to",
    DISK_HELPER_IMAGE, "sh", "-c", WRITE_OEM, "sh",
    INSTALL_BAT, ENABLE_SSH_PS1, publicKey,
  ];
}

/** Run a read-only PowerShell check inside a Windows lab, as its local administrator. */
export function windowsCheckArgs(key: TemplateKey, command: string, marker: string): string[] {
  const user = LAB_TEMPLATES[key].signIn?.user ?? "Docker";
  return [
    "-i", labKeyPath(),
    "-p", String(WINDOWS_SSH_PORT),
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=10",
    "-o", "StrictHostKeyChecking=no",
    "-o", "UserKnownHostsFile=/dev/null",
    "-o", "LogLevel=ERROR",
    user + "@127.0.0.1",
    // $? rather than $LASTEXITCODE: cmdlets (Get-Service, Get-ADForest) never set the latter.
    command + "; if ($?) { Write-Output \"" + marker + "=0\" } else { Write-Output \"" + marker + "=1\" }",
  ];
}
