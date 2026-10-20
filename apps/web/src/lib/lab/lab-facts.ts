import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { powershellRemote } from "./windows-shell";

/**
 * WHAT THE LAB ACTUALLY IS — observed, not assumed (verified-labs V-1).
 *
 * A plan told the owner to open Chrome inside a Windows lab that has no Chrome, to reach a
 * dashboard that lived on their own computer (15 Oct 2026). Before planning, Fadi now asks the
 * lab itself: its OS and build, its shell, which common tools exist, whether it has internet,
 * and whether each service beside it is reachable FROM the lab. One fixed, read-only script
 * over the same channel "Check it for me" uses; nothing in it comes from a model or a request.
 */

const run = promisify(execFile);

export type LabFacts = {
  observed: true;
  os: string;
  build: string | null;
  shell: "powershell" | "sh";
  shellVersion: string | null;
  account: string | null;
  /** Tool name → present in the lab. */
  has: Record<string, boolean>;
  internet: boolean | null;
  /** "host:port" → reachable from the lab. */
  reaches: Record<string, boolean>;
};

/** What a Windows lab is checked for. Browsers by path: they are rarely on PATH. */
const WINDOWS_TOOLS: Record<string, string> = {
  winget: "[bool](Get-Command winget -ErrorAction SilentlyContinue)",
  curl: "[bool](Get-Command curl.exe -ErrorAction SilentlyContinue)",
  msiexec: "[bool](Get-Command msiexec -ErrorAction SilentlyContinue)",
  git: "[bool](Get-Command git -ErrorAction SilentlyContinue)",
  python: "[bool](Get-Command python -ErrorAction SilentlyContinue)",
  docker: "[bool](Get-Command docker -ErrorAction SilentlyContinue)",
  choco: "[bool](Get-Command choco -ErrorAction SilentlyContinue)",
  chrome:
    '(Test-Path "$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe") -or (Test-Path "${env:ProgramFiles(x86)}\\Google\\Chrome\\Application\\chrome.exe")',
  edge: '(Test-Path "${env:ProgramFiles(x86)}\\Microsoft\\Edge\\Application\\msedge.exe")',
  firefox: '(Test-Path "$env:ProgramFiles\\Mozilla Firefox\\firefox.exe")',
};

const TARGET_RE = /^[A-Za-z0-9.-]{1,100}:\d{1,5}$/;

/** One line of PowerShell that prints the facts as JSON. Pure, so its contents are tested. */
export function windowsFactsScript(targets: string[]): string {
  const safe = targets.filter((t) => TARGET_RE.test(t));
  const tools = Object.entries(WINDOWS_TOOLS)
    .map(([name, test]) => `$h['${name}']=${test}`)
    .join("; ");
  const reach = safe.length
    ? `foreach($t in @(${safe.map((t) => `'${t}'`).join(",")})){ $p=$t.Split(':'); $c=New-Object Net.Sockets.TcpClient; try { $ok=$c.ConnectAsync($p[0],[int]$p[1]).Wait(2500) -and $c.Connected } catch { $ok=$false }; $c.Close(); $r[$t]=$ok }`
    : "";
  return [
    "$o=Get-CimInstance Win32_OperatingSystem",
    "$h=@{}",
    tools,
    "$r=@{}",
    reach,
    "$net=[bool](Resolve-DnsName example.com -ErrorAction SilentlyContinue)",
    "[ordered]@{os=$o.Caption; build=$o.BuildNumber; shellVersion=$PSVersionTable.PSVersion.ToString(); account=$env:USERNAME; has=$h; internet=$net; reaches=$r} | ConvertTo-Json -Compress",
  ]
    .filter(Boolean)
    .join("; ");
}

/** The same for a Linux container lab, in plain sh. */
export function linuxFactsScript(): string {
  const tools = ["curl", "wget", "git", "python3", "apt-get", "apk", "systemctl", "sudo", "bash"];
  return [
    ". /etc/os-release 2>/dev/null",
    'printf \'{"os":"%s","build":null,"shellVersion":null,"account":"%s","has":{\' "$PRETTY_NAME" "$(id -un)"',
    tools
      .map(
        (tool, i) =>
          `printf '${i ? "," : ""}"${tool}":%s' "$(command -v ${tool} >/dev/null 2>&1 && echo true || echo false)"`
      )
      .join("; "),
    'printf \'},"internet":%s,"reaches":{}}\' "$(getent hosts example.com >/dev/null 2>&1 && echo true || echo false)"',
  ].join("; ");
}

export type FactsChannel =
  | { kind: "ssh"; user: string; host: string; port: number }
  | { kind: "docker"; container: string };

/** Ask the lab. Null when it can't be reached (not running, checks not set up). */
export async function probeLabFacts(
  channel: FactsChannel,
  shell: "powershell" | "sh",
  targets: string[]
): Promise<LabFacts | null> {
  try {
    let stdout: string;
    if (channel.kind === "ssh") {
      const { labKeyPath } = await import("./templates");
      ({ stdout } = await run(
        "ssh",
        [
          "-i",
          labKeyPath(),
          "-p",
          String(channel.port),
          "-o",
          "BatchMode=yes",
          "-o",
          "ConnectTimeout=8",
          "-o",
          "StrictHostKeyChecking=no",
          "-o",
          "UserKnownHostsFile=/dev/null",
          "-o",
          "LogLevel=ERROR",
          `${channel.user}@${channel.host}`,
          powershellRemote(windowsFactsScript(targets)),
        ],
        { timeout: 45_000, maxBuffer: 64 * 1024 }
      ));
    } else {
      ({ stdout } = await run(
        "docker",
        ["exec", channel.container, "sh", "-c", linuxFactsScript()],
        {
          timeout: 20_000,
          maxBuffer: 64 * 1024,
        }
      ));
    }
    const raw = JSON.parse(stdout.trim().split("\n").pop() ?? "{}") as Partial<LabFacts>;
    if (!raw.os) return null;
    return {
      observed: true,
      os: String(raw.os).trim(),
      build: raw.build ? String(raw.build) : null,
      shell,
      shellVersion: raw.shellVersion ? String(raw.shellVersion) : null,
      account: raw.account ? String(raw.account) : null,
      has: Object.fromEntries(Object.entries(raw.has ?? {}).map(([k, v]) => [k, v === true])),
      internet: typeof raw.internet === "boolean" ? raw.internet : null,
      reaches: Object.fromEntries(
        Object.entries(raw.reaches ?? {}).map(([k, v]) => [k, v === true])
      ),
    };
  } catch {
    return null;
  }
}
