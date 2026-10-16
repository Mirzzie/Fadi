import "server-only";

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { promisify } from "node:util";

import type { PredicateId, Requirement, Verdict } from "./contract";

/**
 * THE FIXED OBSERVERS (G-1). One per predicate; each read-only, bounded in time, owner-scoped
 * through the project it is given, with a declared target. Nothing here comes from a model or a
 * request: the only inputs are the project's own machine, lab name and services. The probes that
 * go inside the machine use the same channel "Check it for me" does, and only the fixed
 * lab-facts script (Codex, answer 2: fixed probes reuse the lab session; model-written
 * commands never do).
 */

const run = promisify(execFile);

export const OBSERVER_VERSION = "g1-2026-10-16";

export type ObserveContext = {
  userId: string;
  runId: string;
  placement: "vmware" | "fadi-container" | "none";
  steps: number;
  progressed: boolean;
  labName: string;
  template: string | null;
  windows: boolean;
  vmx: string | null;
  guestUser: string | null;
  services: Array<{
    key: string;
    label: string;
    agentPorts: number[];
    project: string;
    probe: string;
  }>;
};

export type Observed = { verdict: Verdict; evidence: Record<string, unknown> & { seen: string } };

const said = (verdict: Verdict, seen: string, extra: Record<string, unknown> = {}): Observed => ({
  verdict,
  evidence: { seen, ...extra },
});

type Channel =
  | { kind: "ssh"; user: string; host: string; port: number }
  | { kind: "docker"; container: string };

type SshAnswer = { ok: true; stdout: string } | { ok: false; denied: boolean };

/** One command over Fadi's lab key, bounded in time and output. */
async function sshRun(
  c: { user: string; host: string; port: number },
  remote: string,
  timeoutMs: number
): Promise<SshAnswer> {
  const { labKeyPath } = await import("../templates");
  try {
    const { stdout } = await run(
      "ssh",
      [
        "-i",
        labKeyPath(),
        "-p",
        String(c.port),
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=6",
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "UserKnownHostsFile=/dev/null",
        "-o",
        "LogLevel=ERROR",
        `${c.user}@${c.host}`,
        remote,
      ],
      { timeout: timeoutMs, maxBuffer: 64 * 1024 }
    );
    return { ok: true, stdout };
  } catch (error) {
    const stderr = String((error as { stderr?: string }).stderr ?? "");
    return { ok: false, denied: /Permission denied|publickey/i.test(stderr) };
  }
}

/** VMware NAT's gateway on this computer, from its own nat.conf ([host] ip). */
export async function vmwareNatGateway(): Promise<string | null> {
  const text = await readFile("/etc/vmware/vmnet8/nat/nat.conf", "utf8").catch(() => null);
  const ip = text?.match(/^\s*ip\s*=\s*((?:\d{1,3}\.){3}\d{1,3})\s*$/m)?.[1];
  return ip ?? null;
}

/** Per evaluation: the channel and the lab-facts probe are asked once, then shared. */
export function createObserver(context: ObserveContext) {
  let channel: Promise<Channel | null> | null = null;
  let facts: Promise<Awaited<ReturnType<typeof import("../lab-facts").probeLabFacts>>> | null =
    null;

  async function channelOf(): Promise<Channel | null> {
    if (context.placement === "vmware" && context.vmx) {
      if (!context.guestUser) return null;
      const { guestAddress } = await import("../vmware");
      const host = await guestAddress(context.vmx);
      return host ? { kind: "ssh", user: context.guestUser, host, port: 22 } : null;
    }
    if (context.placement === "fadi-container") {
      if (context.windows) {
        const { LAB_TEMPLATES, WINDOWS_SSH_PORT } = await import("../templates");
        const user =
          (context.template && LAB_TEMPLATES[context.template]?.signIn?.user) || "Docker";
        return { kind: "ssh", user, host: "127.0.0.1", port: WINDOWS_SSH_PORT };
      }
      return { kind: "docker", container: `fadi-${context.labName}` };
    }
    return null;
  }

  const labFacts = () =>
    (facts ??= (async () => {
      const c = await (channel ??= channelOf());
      if (!c) return null;
      const { probeLabFacts } = await import("../lab-facts");
      return probeLabFacts(
        c,
        context.windows ? "powershell" : "sh",
        context.services.map((s) => s.probe)
      );
    })());

  async function observe(requirement: Requirement): Promise<Observed> {
    const id: PredicateId = requirement.predicate;
    switch (id) {
      case "lab_spec.exists":
        return context.placement === "none"
          ? said(
              "pass",
              "This project is done in your browser or on your own computer — no lab machine."
            )
          : said(
              "pass",
              context.placement === "vmware"
                ? "It runs on your VMware machine."
                : "It runs in Fadi's own lab on this computer."
            );

      case "host.vmnet_dns": {
        const { natDnsAnswers } = await import("../readiness-facts");
        const works = await natDnsAnswers();
        return works === null
          ? said("unknown", "Fadi can't read VMware's network settings on this computer.")
          : works
            ? said("pass", "VMware's NAT forwards lookups to real DNS servers.")
            : said(
                "fail",
                "VMware's NAT forwards lookups to this computer's local-only resolver, which the machine can't use."
              );
      }

      case "host.firewall_allows": {
        const { firewallVerdict } = await import("./firewall");
        const read = (path: string) => readFile(path, "utf8").catch(() => null);
        const [ufwConf, defaults, userRules] = await Promise.all([
          read("/etc/ufw/ufw.conf"),
          read("/etc/default/ufw"),
          read("/etc/ufw/user.rules"),
        ]);
        const iface = requirement.params.iface ?? "vmnet8";
        const address = networkInterfaces()[iface]?.find((a) => a.family === "IPv4");
        const result = firewallVerdict(
          { ufwConf, defaults, userRules },
          {
            ports: requirement.params.ports ?? [],
            iface,
            hostIp: address?.address ?? null,
            subnet: address?.cidr ?? null,
          }
        );
        return said(result.verdict, result.seen, { missing: result.missing });
      }

      case "machine.baseline": {
        if (!context.vmx) return said("unknown", "No VMware machine is chosen.");
        const { hasCleanSnapshot, CLEAN_SNAPSHOT } = await import("../vmware");
        const has = await hasCleanSnapshot(context.vmx);
        return has === null
          ? said("unknown", "VMware didn't answer, so Fadi can't list the machine's snapshots.")
          : has
            ? said("pass", `The machine has the snapshot “${CLEAN_SNAPSHOT}”.`)
            : said("fail", `The machine has no “${CLEAN_SNAPSHOT}” snapshot yet.`);
      }

      case "machine.running": {
        if (context.placement === "vmware" && context.vmx) {
          const { guestToolsState, runningVmxPaths } = await import("../vmware");
          const running = await runningVmxPaths();
          if (running === null) return said("unknown", "VMware isn't answering on this computer.");
          if (!running.has(context.vmx)) return said("fail", "The machine is off or suspended.");
          const tools = await guestToolsState(context.vmx);
          return tools === "running"
            ? said(
                "pass",
                "The machine is on and its operating system is up (VMware Tools answers).",
                { tools }
              )
            : said(
                "fail",
                "The machine is on, but its operating system hasn't finished starting.",
                { tools }
              );
        }
        const { observeProjectRuntime } = await import("../runtime-observer");
        const runtime = await observeProjectRuntime(context.userId, context.runId);
        if (!runtime) return said("fail", "Fadi's lab for this project doesn't exist yet.");
        return runtime.phase === "ready"
          ? said("pass", "Fadi's lab is up and ready.", { phase: runtime.phase })
          : said("fail", `Fadi's lab is ${runtime.phase}.`, { phase: runtime.phase });
      }

      case "machine.check_channel": {
        if (context.placement === "vmware" && !context.guestUser) {
          return said(
            "fail",
            "Checks aren't set up for this machine yet, so Fadi can't sign in to it."
          );
        }
        const c = await (channel ??= channelOf());
        if (!c)
          return said(
            "fail",
            "VMware doesn't report the machine's address on its own network yet."
          );
        const target = c.kind === "ssh" ? `${c.user}@${c.host}:${c.port}` : c.container;
        if (c.kind === "docker") {
          try {
            await run("docker", ["exec", c.container, "true"], { timeout: 8000 });
            return said("pass", "Fadi reaches the lab.", { target });
          } catch {
            return said("fail", "Fadi can't reach inside the lab.", { target });
          }
        }
        // Proven, not assumed: sign in with Fadi's key, run a fixed harmless probe, and see
        // PowerShell answer — a saved account name is only intent (Codex review, 16 Oct 2026).
        const { powershellRemote } = await import("../windows-shell");
        const answer = await sshRun(
          c,
          powershellRemote("Write-Output ('fadi-ok ' + $PSVersionTable.PSVersion.Major)"),
          15_000
        );
        if (!answer.ok) {
          return said(
            "fail",
            answer.denied
              ? `The machine is at ${c.host}, but Fadi's key isn't accepted there as ${c.user} — the setup line hasn't run yet, or ran in a window that wasn't Administrator.`
              : `Fadi can't open a connection to ${c.host} — the machine's SSH server isn't running or its firewall blocks this computer.`,
            { target }
          );
        }
        const version = answer.stdout.match(/fadi-ok (\d+)/)?.[1];
        return version
          ? said(
              "pass",
              `Fadi signs in as ${c.user} at ${c.host}; PowerShell ${version} answers.`,
              {
                target,
                shell: `powershell ${version}`,
              }
            )
          : said("fail", `Fadi signs in at ${c.host}, but PowerShell doesn't answer there.`, {
              target,
            });
      }

      case "lab.internet": {
        const c = await (channel ??= channelOf());
        if (c?.kind === "ssh" && context.windows) {
          const { powershellRemote } = await import("../windows-shell");
          const { WINDOWS_DNS_SCRIPT, diagnoseLabDns, parseLabDns } = await import("./lab-dns");
          const answer = await sshRun(c, powershellRemote(WINDOWS_DNS_SCRIPT), 45_000);
          const facts = answer.ok ? parseLabDns(answer.stdout) : null;
          if (!facts) return said("unknown", "Fadi couldn't ask the machine.");
          const gateway = await vmwareNatGateway();
          const result = diagnoseLabDns(facts, context.placement === "vmware" ? gateway : null);
          return said(result.verdict, result.seen, {
            ...facts,
            ...(result.remedy ? { remedy: result.remedy } : {}),
          });
        }
        const f = await labFacts();
        if (!f || f.internet === null) return said("unknown", "Fadi couldn't ask the machine.");
        return f.internet
          ? said("pass", "From inside the machine, example.com resolves.")
          : said(
              "fail",
              "From inside the machine, names don't resolve — it can't download anything."
            );
      }

      case "service.running": {
        const service = context.services.find((s) => s.key === requirement.params.stack);
        if (!service) return said("unknown", "That service isn't part of this project.");
        const { observeStack } = await import("../stack-observer");
        const { isStackKey } = await import("../stacks");
        if (!isStackKey(service.key)) return said("unknown", "Unknown service.");
        const state = await observeStack(service.project, service.key);
        if (!state) return said("unknown", "Docker isn't answering, so Fadi can't see it.");
        const counts = { running: state.running, total: state.total, state: state.state };
        switch (state.state) {
          case "running":
            return said(
              "pass",
              `${service.label}: all ${state.total} parts run and it answers.`,
              counts
            );
          case "absent":
            return said("fail", `${service.label} hasn't been started for this project.`, counts);
          case "starting":
            return said(
              "fail",
              `${service.label} is starting — ${state.running} of ${state.total} parts run, it doesn't answer yet.`,
              counts
            );
          default:
            return said(
              "fail",
              `${service.label} is ${state.state} — ${state.running} of ${state.total} parts run.`,
              counts
            );
        }
      }

      case "service.reachable_from_lab": {
        const service = context.services.find((s) => s.key === requirement.params.stack);
        if (!service) return said("unknown", "That service isn't part of this project.");
        const f = await labFacts();
        const reached = f?.reaches[service.probe];
        if (!f || reached === undefined) return said("unknown", "Fadi couldn't ask the machine.");
        return reached
          ? said("pass", `From inside the machine, ${service.probe} answers.`, {
              target: service.probe,
            })
          : said("fail", `From inside the machine, ${service.probe} doesn't answer.`, {
              target: service.probe,
            });
      }

      case "learner_plan.exists":
        return context.steps > 0
          ? said("pass", `${context.steps} steps are planned.`)
          : said("fail", "No steps yet.");
    }
  }

  return { observe };
}
