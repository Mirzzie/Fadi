import "server-only";

import {
  createLabActionRequestsRepository,
  createLabObservationsRepository,
  createLabResourcesRepository,
  createProjectRunsRepository,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";

import {
  PREDICATES,
  paramsKey,
  type Observation,
  type RemedyRef,
  type Requirement,
} from "./contract";
import { conduct, requirementsFor, type ConductedState } from "./graph";
import { createObserver, OBSERVER_VERSION, type ObserveContext } from "./observe";
import { remedyView, type RemedyView } from "./remedies";

/**
 * THE CONDUCTOR (G-1): the one place that decides what a project's environment needs, what is
 * true of it now, and the single next thing to do. Observations are re-taken only when stale, or
 * when the person asked ("Check again", after a remedy) — and only once the requirement's own
 * dependencies are met, so a stopped machine is never probed over SSH.
 */

export type ConductorItem = {
  id: string;
  title: string;
  why: string;
  state: ConductedState;
  blocking: "hard" | "soft";
  verdict: Observation["verdict"] | null;
  seen: string | null;
  observedAt: string | null;
  remedy: (RemedyView & { waiting: boolean }) | null;
};

export type ConductorView = {
  items: ConductorItem[];
  next: ConductorItem | null;
  ready: boolean;
};

type ManualRemedyId = Extract<RemedyRef, { kind: "manual" }>["id"];
const DIAGNOSED_REMEDIES = new Set<string>([
  "host.vmnet_dns",
  "lab.dns_forwarder",
  "lab.dns_client",
] satisfies ManualRemedyId[]);

/** The broker recipe a remedy proposes, to tell "waiting for your approval" from "not asked". */
const RECIPE_OF: Record<string, (ctx: ObserveContext) => string> = {
  "lab.start": (ctx) => (ctx.placement === "vmware" ? "vmware.start" : "lab.start"),
  "vmware.snapshot": () => "vmware.snapshot",
  "stack.start": () => "stack.start",
  "lab.dns_forwarder": () => "vmware.guestFix",
  "lab.dns_client": () => "vmware.guestFix",
};

async function contextFor(userId: string, runId: string): Promise<ObserveContext | null> {
  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(userId, runId);
  if (!project) return null;
  const { run } = project;
  const { vmxPathOf, readVmxSummary } = await import("../vmware");
  const resource = run.resourceId
    ? await createLabResourcesRepository(db).get(userId, run.resourceId)
    : null;
  const vmx = vmxPathOf(resource?.endpoint);
  const { templateForProject } = await import("../spec-from-project");
  const { LAB_TEMPLATES, labNameForRun } = await import("../templates");
  const template = templateForProject({ title: run.title, detail: run.detail });
  const placement = vmx ? "vmware" : template ? "fadi-container" : "none";
  const windows = vmx
    ? Boolean((await readVmxSummary(vmx))?.family.startsWith("windows"))
    : template
      ? LAB_TEMPLATES[template]?.toolchain.shell === "powershell"
      : false;
  const labName = labNameForRun(run.id);
  const { STACKS, stackProject, stacksForProject, vmNetworkAddress } = await import("../stacks");
  const services = stacksForProject({ title: run.title, detail: run.detail }).map((key) => {
    const stack = STACKS[key];
    const host = placement === "vmware" ? vmNetworkAddress() : stack.agent.managerHost;
    return {
      key,
      label: stack.label,
      agentPorts: stack.agentPorts,
      diskGb: stack.diskGb,
      project: stackProject(labName, key),
      probe: `${host}:${stack.agentPorts[stack.agentPorts.length - 1]}`,
    };
  });
  return {
    userId,
    runId: run.id,
    placement,
    steps: project.steps.length,
    progressed: project.steps.some((step) => step.status === "done"),
    labName,
    template,
    windows,
    vmx,
    guestUser: resource?.guestUser ?? null,
    services,
  };
}

const subjectOf = (requirement: Requirement, runId: string) =>
  PREDICATES[requirement.predicate].scope === "host" ? "host" : `run:${runId}`;

export async function evaluateConductor(
  userId: string,
  runId: string,
  options: { recheck?: string[]; now?: Date } = {}
): Promise<ConductorView | null> {
  const context = await contextFor(userId, runId);
  if (!context) return null;
  const now = options.now ?? new Date();
  const recheck = new Set(options.recheck ?? []);
  const db = getDatabase();
  const observationsRepo = createLabObservationsRepository(db);

  const requirements = requirementsFor({
    placement: context.placement,
    hasSpec: context.placement !== "none",
    progressed: context.progressed,
    services: context.services,
  });
  const stored = await observationsRepo.forSubjects(userId, ["host", `run:${runId}`]);
  const storedFor = (requirement: Requirement) =>
    stored.find(
      (row) =>
        row.subject === subjectOf(requirement, runId) &&
        row.predicateId === requirement.predicate &&
        row.paramsKey === paramsKey(requirement.params) &&
        row.predicateVersion === PREDICATES[requirement.predicate].version
    ) ?? null;

  const observer = createObserver(context);
  const observations = new Map<string, Observation>();
  const passed = new Set<string>();
  const ids = new Set(requirements.map((r) => r.id));
  const { orderRequirements } = await import("./graph");

  for (const requirement of orderRequirements(requirements)) {
    const depsMet = requirement.dependsOn.every((d) => !ids.has(d) || passed.has(d));
    const row = storedFor(requirement);
    const age = row ? now.getTime() - row.observedAt.getTime() : Infinity;
    // A failing observation is what the person is fixing right now: look again sooner.
    const period = PREDICATES[requirement.predicate].freshnessMs;
    const fresh = age <= (row?.verdict === "pass" ? period : Math.min(period, 30_000));

    let observation: Observation | null = row
      ? {
          requirementId: requirement.id,
          predicateId: requirement.predicate,
          predicateVersion: row.predicateVersion,
          verdict: row.verdict as Observation["verdict"],
          evidence: row.evidence as Observation["evidence"],
          observerVersion: row.observerVersion,
          observedAt: row.observedAt.toISOString(),
        }
      : null;

    // Stale ones are re-taken once their dependencies hold; one the person asked about, always.
    if ((depsMet && !fresh) || recheck.has(requirement.id)) {
      const result = await observer.observe(requirement);
      const saved = await observationsRepo.record(userId, {
        subject: subjectOf(requirement, runId),
        predicateId: requirement.predicate,
        predicateVersion: PREDICATES[requirement.predicate].version,
        paramsKey: paramsKey(requirement.params),
        verdict: result.verdict,
        evidence: result.evidence,
        observerVersion: OBSERVER_VERSION,
      });
      observation = {
        requirementId: requirement.id,
        predicateId: requirement.predicate,
        predicateVersion: saved.predicateVersion,
        verdict: result.verdict,
        evidence: result.evidence,
        observerVersion: OBSERVER_VERSION,
        observedAt: saved.observedAt.toISOString(),
      };
    }
    if (observation) observations.set(requirement.id, observation);
    if (depsMet && (observation?.verdict === "pass" || requirement.blocking === "soft")) {
      passed.add(requirement.id);
    }
  }

  const result = conduct(requirements, observations);
  const requests = createLabActionRequestsRepository(db);
  const { vmNetworkAddress } = await import("../stacks");
  const vmnetIp = context.placement === "vmware" ? vmNetworkAddress() : null;
  const { vmwareNatGateway } = await import("./observe");
  const natGateway = context.placement === "vmware" ? await vmwareNatGateway() : null;

  const items = await Promise.all(
    result.items.map(async ({ requirement, observation, state }): Promise<ConductorItem> => {
      let remedy: ConductorItem["remedy"] = null;
      // The observer may name a more precise remedy from its diagnosis — only a closed id.
      const diagnosed = observation?.evidence.remedy;
      const remedyRef: RemedyRef | null =
        typeof diagnosed === "string" && DIAGNOSED_REMEDIES.has(diagnosed)
          ? { kind: "manual", id: diagnosed as ManualRemedyId }
          : requirement.remedy;
      // A machine that is ON but still booting (VMware Tools not answering yet) needs waiting,
      // not "Start the machine" — it is started. The action becomes Check again.
      const booting =
        requirement.predicate === "machine.running" &&
        typeof observation?.evidence.tools === "string";
      if (remedyRef && !booting && state !== "done" && state !== "waiting") {
        const view = remedyView(remedyRef, requirement, { vmnetIp, natGateway });
        const recipe = RECIPE_OF[remedyRef.id]?.(context);
        const last = recipe ? await requests.latestForRun(userId, runId, recipe) : null;
        remedy = { ...view, waiting: last?.status === "pending" || last?.status === "approved" };
      }
      return {
        id: requirement.id,
        title: requirement.title,
        why: requirement.why,
        state,
        blocking: requirement.blocking,
        verdict: observation?.verdict ?? null,
        seen: typeof observation?.evidence.seen === "string" ? observation.evidence.seen : null,
        observedAt: observation?.observedAt ?? null,
        remedy,
      };
    })
  );
  return {
    items,
    next: items.find((item) => item.state === "next") ?? null,
    ready: result.ready,
  };
}
