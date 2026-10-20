import type { Observation, Requirement } from "./contract";

/**
 * WHICH REQUIREMENTS A PROJECT HAS, AND WHICH ONE IS NEXT. Pure.
 *
 * The graph is the truth; the person sees it in one order (topological, ties by declaration).
 * The order for a SIEM on the person's VMware machine is the one Codex set: computer
 * prerequisites, a known baseline before anything changes the machine, the machine and its
 * check channel, the service, the service as seen from the machine, then the plan.
 */

export type LabSpec = {
  /** Where the project's lab runs; "none" when the work needs no lab machine. */
  placement: "vmware" | "fadi-container" | "none";
  /** A plan can be made at all (a lab template or a chosen machine exists). */
  hasSpec: boolean;
  services: Array<{ key: string; label: string; agentPorts: number[]; diskGb?: number }>;
  /**
   * The project already has finished steps. Then a snapshot is no longer a clean start — the
   * machine has the project's changes in it — so it is advice, not a gate: it held the owner's
   * Next card on "Save clean start" while the real blocker was the machine's DNS (16 Oct 2026).
   */
  progressed?: boolean;
};

export function requirementsFor(spec: LabSpec): Requirement[] {
  const list: Requirement[] = [];
  const add = (requirement: Requirement) => list.push(requirement);

  add({
    id: "lab-spec",
    predicate: "lab_spec.exists",
    params: {},
    dependsOn: [],
    blocking: "hard",
    remedy: { kind: "flow", id: "machine.choose" },
    title: "Choose where the lab runs",
    why: "Fadi can only prepare and plan a lab it knows: Fadi's own lab on this computer or one of your VMware machines.",
  });
  if (spec.placement === "none") {
    add(planRequirement(["lab-spec"]));
    return list;
  }

  const vmware = spec.placement === "vmware";
  // Room on this computer, before anything writes to it — split by the disk each thing lands on
  // (Codex VM-safety review, 17 Oct 2026): the services' data and Fadi's own lab disk go to
  // Docker's data-root; a VM snapshot goes beside the .vmx. With 1.3 GB free the owner's next
  // Wazuh start would simply have failed, and nothing said why (17 Oct 2026).
  const serviceGb = spec.services.reduce((sum, s) => sum + (s.diskGb ?? 0), 0);
  const vmGb = vmware ? 10 : 0;
  const dockerGb = serviceGb + (vmware ? 0 : 12);
  const needGb = vmGb + dockerGb;
  add({
    id: "host-disk",
    predicate: "host.disk_room",
    params: { gb: needGb, vmGb, dockerGb },
    dependsOn: ["lab-spec"],
    blocking: "hard",
    remedy: { kind: "manual", id: "host.disk_room" },
    title: `This computer has room for the lab (about ${needGb} GB)`,
    why: "Snapshots, lab disks and the services' data all need space; without it they fail halfway.",
  });
  if (vmware) {
    add({
      id: "host-dns",
      predicate: "host.vmnet_dns",
      params: {},
      dependsOn: ["lab-spec"],
      blocking: "hard",
      remedy: { kind: "manual", id: "host.vmnet_dns" },
      title: "VMware's network gives the machine working DNS",
      why: "Without it the machine can't download anything — agents, packages or updates.",
    });
    const ports = [...new Set(spec.services.flatMap((s) => s.agentPorts))].sort((a, b) => a - b);
    if (ports.length) {
      add({
        id: "host-firewall",
        predicate: "host.firewall_allows",
        params: { iface: "vmnet8", ports },
        dependsOn: ["lab-spec"],
        blocking: "hard",
        remedy: { kind: "manual", id: "host.firewall_vmnet" },
        title: `This computer's firewall lets the machine reach port${ports.length > 1 ? "s" : ""} ${ports.join(" and ")}`,
        why: "The services run on this computer; an agent in the machine that can't reach them never enrols.",
      });
    }
    add({
      id: "baseline",
      predicate: "machine.baseline",
      params: {},
      dependsOn: ["lab-spec", "host-disk"],
      blocking: spec.progressed ? "soft" : "hard",
      // Once the project has changed the machine, a snapshot would not be a clean start: offer
      // none (16 Oct 2026 — one was saved mid-project and the reset brought the session back).
      remedy: spec.progressed ? null : { kind: "recipe", id: "vmware.snapshot" },
      title: "A clean start of the machine is saved",
      why: "Before the project changes anything, so “Start the project over” can put it back exactly.",
    });
  }

  add({
    id: "machine",
    predicate: "machine.running",
    params: {},
    dependsOn: vmware && !spec.progressed ? ["baseline"] : ["lab-spec", "host-disk"],
    blocking: "hard",
    remedy: { kind: "recipe", id: "lab.start" },
    title: "The lab machine is running",
    why: "Fadi plans against the machine as it really is, so it has to be on.",
  });
  add({
    id: "channel",
    predicate: "machine.check_channel",
    params: {},
    dependsOn: ["machine"],
    blocking: "hard",
    remedy: vmware ? { kind: "flow", id: "checks.setup" } : null,
    title: "Fadi can look inside the machine",
    why: "So it can see what's installed before planning, and check each step for you.",
  });
  add({
    id: "internet",
    predicate: "lab.internet",
    params: {},
    dependsOn: vmware ? ["channel", "host-dns"] : ["channel"],
    // Hard: an agent step after a failed download was the owner's first failure (16 Oct 2026).
    blocking: "hard",
    remedy: vmware ? { kind: "manual", id: "host.vmnet_dns" } : null,
    title: "The machine reaches the internet",
    why: "Most steps download something — an agent, a package, an update. Without it they fail one after another.",
  });

  const reach: string[] = [];
  for (const service of spec.services) {
    const running = `service-${service.key}`;
    add({
      id: running,
      predicate: "service.running",
      params: { stack: service.key },
      dependsOn: vmware && spec.services.length ? ["host-firewall", "host-disk"] : ["host-disk"],
      blocking: "hard",
      remedy: { kind: "recipe", id: "stack.start" },
      title: `${service.label} is running`,
      why: "It runs beside the machine on this computer; the machine connects to it.",
    });
    const reachable = `reach-${service.key}`;
    reach.push(reachable);
    add({
      id: reachable,
      predicate: "service.reachable_from_lab",
      params: { stack: service.key, ports: service.agentPorts },
      dependsOn: [running, "channel"],
      blocking: "hard",
      remedy: vmware ? { kind: "manual", id: "host.firewall_vmnet" } : null,
      title: `The machine can reach ${service.label}`,
      why: "Checked from inside the machine — the only place where it matters.",
    });
  }

  add(planRequirement(["channel", "internet", ...reach]));
  return list;
}

function planRequirement(dependsOn: string[]): Requirement {
  return {
    id: "plan",
    predicate: "learner_plan.exists",
    params: {},
    dependsOn,
    blocking: "hard",
    remedy: { kind: "flow", id: "plan.create" },
    title: "The steps are planned",
    why: "Planned against what Fadi observed — the machine, its tools and its services.",
  };
}

/** Topological order, stable by declaration. Unknown dependency ids are ignored. */
export function orderRequirements(requirements: Requirement[]): Requirement[] {
  const ids = new Set(requirements.map((r) => r.id));
  const done = new Set<string>();
  const ordered: Requirement[] = [];
  while (ordered.length < requirements.length) {
    const ready = requirements.find(
      (r) => !done.has(r.id) && r.dependsOn.every((d) => !ids.has(d) || done.has(d))
    );
    if (!ready) throw new Error("Lab requirements have a cycle");
    done.add(ready.id);
    ordered.push(ready);
  }
  return ordered;
}

export type ConductedState =
  /** Observed true and fresh. */
  | "done"
  /** The one thing to do now. */
  | "next"
  /** Its own dependencies aren't met yet. */
  | "waiting"
  /** Ready to be met but not met (not the first such) — or a soft one that failed. */
  | "open";

export type Conducted = {
  requirement: Requirement;
  observation: Observation | null;
  state: ConductedState;
};

/**
 * Decide each requirement's state from the latest observations. A requirement whose
 * dependencies aren't all done is "waiting", whatever was observed of it earlier — a stopped
 * machine means its check channel is not something the person can act on.
 */
export function conduct(
  requirements: Requirement[],
  observations: Map<string, Observation>
): { items: Conducted[]; next: Conducted | null; ready: boolean } {
  const ordered = orderRequirements(requirements);
  const ids = new Set(requirements.map((r) => r.id));
  const passed = new Set<string>();
  const items: Conducted[] = [];
  let next: Conducted | null = null;

  for (const requirement of ordered) {
    const observation = observations.get(requirement.id) ?? null;
    const depsDone = requirement.dependsOn.every((d) => !ids.has(d) || passed.has(d));
    // A soft requirement counts as met for its dependants: it warns, it doesn't block.
    const met = observation?.verdict === "pass";
    let state: ConductedState;
    if (!depsDone) state = "waiting";
    else if (met) state = "done";
    else if (!next && requirement.blocking === "hard") state = "next";
    else state = "open";
    if (state === "done" || (depsDone && requirement.blocking === "soft"))
      passed.add(requirement.id);
    const item = { requirement, observation, state };
    if (state === "next") next = item;
    items.push(item);
  }

  const ready = items.every((i) => i.state === "done" || i.requirement.blocking === "soft");
  return { items, next, ready };
}
