import { createHash, randomInt } from "node:crypto";

/**
 * READING AND CHANGING A VMWARE MACHINE'S SETTINGS, without guessing.
 *
 * A `.vmx` file is VMware's own settings for one VM: `key = "value"` lines. Fadi reads it to
 * describe a machine the person already has, and changes it in exactly one way — turning on
 * VMware's built-in screen sharing (VNC), on this computer only, so the machine can be shown
 * inside a project. Every other line is kept exactly as VMware wrote it.
 *
 * Pure, so what is read and what is written is pinned by tests.
 */

export type VmxEntries = Map<string, string>;

const LINE = /^\s*([A-Za-z0-9_.:-]+)\s*=\s*"(.*)"\s*$/;

/** Keys are case-insensitive in VMware; they are stored lower-cased here. */
export function parseVmx(text: string): VmxEntries {
  const out: VmxEntries = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(LINE);
    if (match) out.set(match[1]!.toLowerCase(), match[2]!);
  }
  return out;
}

/** Set keys, replacing an existing line in place or appending; every other line is untouched. */
export function setVmxEntries(text: string, entries: Record<string, string>): string {
  const pending = new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), [k, v]]));
  const lines = text.split(/\r?\n/);
  const kept = lines.map((line) => {
    const match = line.match(LINE);
    const key = match?.[1]?.toLowerCase();
    if (!key || !pending.has(key)) return line;
    const [name, value] = pending.get(key)!;
    pending.delete(key);
    return `${name} = "${value}"`;
  });
  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  for (const [name, value] of pending.values()) kept.push(`${name} = "${value}"`);
  return kept.join("\n") + "\n";
}

export type VmxSummary = {
  name: string;
  guestOs: string;
  /** A plain family for matching projects: windows-server, windows, linux, other. */
  family: "windows-server" | "windows" | "linux" | "other";
  memoryMb: number | null;
  cpus: number | null;
  screen: VmxScreen | null;
};

export type VmxScreen = { port: number; password: string };

export function summariseVmx(entries: VmxEntries, fallbackName: string): VmxSummary {
  const guestOs = entries.get("guestos") ?? "";
  const number = (key: string) => {
    const n = Number(entries.get(key));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    name: entries.get("displayname")?.trim() || fallbackName,
    guestOs,
    family: familyOf(guestOs),
    memoryMb: number("memsize"),
    cpus: number("numvcpus"),
    screen: screenOf(entries),
  };
}

/** VMware's guestOS ids: "windows2022srvnext-64", "windows11-64", "debian12-64", … */
export function familyOf(guestOs: string): VmxSummary["family"] {
  const id = guestOs.toLowerCase();
  if (/^win.*(srv|server)|^longhorn|^winnet/.test(id)) return "windows-server";
  if (/^win/.test(id)) return "windows";
  if (/linux|ubuntu|debian|rhel|centos|fedora|suse|kali|other.*linux|oracle|rocky|alma/.test(id))
    return "linux";
  return "other";
}

/** The screen Fadi turned on, when it is on and on this computer only. */
export function screenOf(entries: VmxEntries): VmxScreen | null {
  if (entries.get("remotedisplay.vnc.enabled")?.toUpperCase() !== "TRUE") return null;
  // Listening beyond this computer is not a screen Fadi will show: someone else set that up.
  if ((entries.get("remotedisplay.vnc.ip") ?? "") !== "127.0.0.1") return null;
  const port = Number(entries.get("remotedisplay.vnc.port"));
  const password = entries.get("remotedisplay.vnc.password") ?? "";
  if (!Number.isInteger(port) || port < 5900 || port > 5999 || !password) return null;
  return { port, password };
}

/**
 * A port for this machine's screen: stable per machine (so it survives restarts) and in
 * 5901–5999, avoiding ports other machines already use.
 */
export function screenPortFor(resourceId: string, taken: Set<number>): number {
  const start = 5901 + (createHash("sha256").update(resourceId).digest().readUInt16BE(0) % 99);
  for (let i = 0; i < 99; i++) {
    const port = 5901 + ((start - 5901 + i) % 99);
    if (!taken.has(port)) return port;
  }
  throw new Error("No free screen port between 5901 and 5999.");
}

/** VNC passwords are at most eight characters; letters and digits only, so nothing needs escaping. */
export function newScreenPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

/** The lines that turn the screen on, on this computer only. */
export function screenEntries(screen: VmxScreen): Record<string, string> {
  return {
    "RemoteDisplay.vnc.enabled": "TRUE",
    "RemoteDisplay.vnc.ip": "127.0.0.1",
    "RemoteDisplay.vnc.port": String(screen.port),
    "RemoteDisplay.vnc.password": screen.password,
  };
}

/**
 * VMware's library (`~/.vmware/inventory.vmls`): every machine the person has opened in
 * Workstation, by its .vmx path and the name they gave it.
 */
export function parseInventory(text: string): Array<{ vmxPath: string; name: string }> {
  const byId = new Map<string, { vmxPath?: string; name?: string }>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(vmlist\d+)\.(config|DisplayName)\s*=\s*"(.*)"\s*$/);
    if (!match) continue;
    const entry = byId.get(match[1]!) ?? {};
    if (match[2] === "config") entry.vmxPath = match[3];
    else entry.name = match[3];
    byId.set(match[1]!, entry);
  }
  return [...byId.values()]
    .filter((entry): entry is { vmxPath: string; name?: string } =>
      Boolean(entry.vmxPath && entry.vmxPath.toLowerCase().endsWith(".vmx"))
    )
    .map((entry) => ({ vmxPath: entry.vmxPath, name: entry.name ?? "" }));
}

/**
 * WHAT CAN BE CHANGED ABOUT A MACHINE FROM FADI, AND TO WHAT. A closed set: every value is one
 * of these, so nothing a caller says becomes a line in a settings file.
 */
export const MACHINE_CHOICES = {
  cpus: [1, 2, 4, 6, 8],
  memoryMb: [2048, 3072, 4096, 6144, 8192],
  /** nat: internet and this computer. hostonly: this computer only — no internet. */
  network: ["nat", "hostonly"],
  /** auto: VMware decides (small, when it runs in the background). */
  screen: ["auto", "1600x900", "1920x1080"],
} as const;

export type MachineSettings = {
  cpus: number | null;
  memoryMb: number | null;
  network: string | null;
  screen: string;
};

export type MachineChanges = Partial<{
  cpus: (typeof MACHINE_CHOICES.cpus)[number];
  memoryMb: (typeof MACHINE_CHOICES.memoryMb)[number];
  network: (typeof MACHINE_CHOICES.network)[number];
  screen: (typeof MACHINE_CHOICES.screen)[number];
}>;

export function readMachineSettings(entries: VmxEntries): MachineSettings {
  const n = (key: string) => {
    const value = Number(entries.get(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  const fixed = entries.get("svga.autodetect")?.toUpperCase() === "FALSE";
  const w = n("svga.maxwidth");
  const h = n("svga.maxheight");
  return {
    cpus: n("numvcpus") ?? 1,
    memoryMb: n("memsize"),
    network: entries.get("ethernet0.connectiontype") ?? null,
    screen: fixed && w && h ? `${w}x${h}` : "auto",
  };
}

/** Only values from MACHINE_CHOICES survive; anything else is dropped. */
export function validMachineChanges(raw: Record<string, unknown>): MachineChanges {
  const out: MachineChanges = {};
  const pick = <K extends keyof typeof MACHINE_CHOICES>(key: K) => {
    const value = raw[key];
    if ((MACHINE_CHOICES[key] as readonly unknown[]).includes(value)) {
      (out as Record<string, unknown>)[key] = value;
    }
  };
  pick("cpus");
  pick("memoryMb");
  pick("network");
  pick("screen");
  return out;
}

/** The .vmx lines a set of changes writes. */
export function machineChangeEntries(changes: MachineChanges): Record<string, string> {
  const entries: Record<string, string> = {};
  if (changes.cpus) {
    entries.numvcpus = String(changes.cpus);
    entries["cpuid.coresPerSocket"] = String(changes.cpus);
  }
  if (changes.memoryMb) entries.memsize = String(changes.memoryMb);
  if (changes.network) entries["ethernet0.connectionType"] = changes.network;
  if (changes.screen) {
    if (changes.screen === "auto") entries["svga.autodetect"] = "TRUE";
    else {
      const [w, h] = changes.screen.split("x");
      entries["svga.autodetect"] = "FALSE";
      entries["svga.maxWidth"] = w!;
      entries["svga.maxHeight"] = h!;
    }
  }
  return entries;
}

export function describeChanges(changes: MachineChanges): string[] {
  const out: string[] = [];
  if (changes.cpus) out.push(`${changes.cpus} CPU core${changes.cpus === 1 ? "" : "s"}`);
  if (changes.memoryMb) out.push(`${changes.memoryMb / 1024} GB memory`);
  if (changes.network)
    out.push(
      changes.network === "nat"
        ? "network: NAT (internet and this computer)"
        : "network: host-only (this computer only, no internet)"
    );
  if (changes.screen)
    out.push(
      changes.screen === "auto"
        ? "screen: VMware decides"
        : `screen: up to ${changes.screen.replace("x", "×")}`
    );
  return out;
}
