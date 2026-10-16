/**
 * THE GUIDED-LABS CONTRACT (G-1), as agreed with Codex on 15 Oct 2026
 * (docs/reviews/2026-10-15-claude-codex-guided-labs.md).
 *
 * A project's environment is a graph of REQUIREMENTS. Each one points at a PREDICATE — a fixed,
 * read-only question with a version, a place and a freshness period — and at most one REMEDY,
 * which is always a closed id: an existing broker recipe, a reviewed manual instruction, or a
 * guided flow. Never a shell string from a project or a model. An OBSERVATION is what Fadi last
 * saw; `unknown` (the probe couldn't answer) is never a failure, and never a diagnosis.
 *
 * Step checks and proof receipts (Codex X3) are meant to use this same Predicate/Observation pair,
 * so "passed" means one thing everywhere.
 */

export type Verdict = "pass" | "fail" | "unknown";

export type PredicateId =
  | "lab_spec.exists"
  | "host.vmnet_dns"
  | "host.firewall_allows"
  | "machine.baseline"
  | "machine.running"
  | "machine.check_channel"
  | "lab.internet"
  | "service.running"
  | "service.reachable_from_lab"
  | "learner_plan.exists";

export type PredicateDefinition = {
  id: PredicateId;
  version: number;
  /** Where the answer comes from. */
  place: "host" | "machine" | "lab" | "service" | "project";
  /** Host facts belong to this computer and are shared by every project. */
  scope: "host" | "run";
  /** How long an observation stays true enough to act on. 0: always observe (cheap, local). */
  freshnessMs: number;
};

export type RemedyRef =
  | { kind: "recipe"; id: "lab.start" | "vmware.snapshot" | "stack.start" }
  | {
      kind: "manual";
      id: "host.vmnet_dns" | "host.firewall_vmnet" | "lab.dns_forwarder" | "lab.dns_client";
    }
  | { kind: "flow"; id: "checks.setup" | "plan.create" | "machine.choose" };

export type Requirement = {
  id: string;
  predicate: PredicateId;
  /** Typed parameters; only numbers and closed keys, never free text. */
  params: { ports?: number[]; iface?: string; stack?: string };
  dependsOn: string[];
  /** A hard requirement holds the plan back; a soft one is shown but does not. */
  blocking: "hard" | "soft";
  remedy: RemedyRef | null;
  /** What it is, and why the project needs it — one sentence each, for the person. */
  title: string;
  why: string;
};

export type Observation = {
  requirementId: string;
  predicateId: PredicateId;
  predicateVersion: number;
  verdict: Verdict;
  /** Structured, plus `seen`: one line of what was observed, from a fixed template. */
  evidence: Record<string, unknown> & { seen?: string };
  observerVersion: string;
  observedAt: string;
};

export const PREDICATES: Record<PredicateId, PredicateDefinition> = {
  "lab_spec.exists": {
    id: "lab_spec.exists",
    version: 1,
    place: "project",
    scope: "run",
    freshnessMs: 0,
  },
  "host.vmnet_dns": {
    id: "host.vmnet_dns",
    version: 1,
    place: "host",
    scope: "host",
    freshnessMs: 10 * 60_000,
  },
  "host.firewall_allows": {
    id: "host.firewall_allows",
    version: 1,
    place: "host",
    scope: "host",
    freshnessMs: 10 * 60_000,
  },
  "machine.baseline": {
    id: "machine.baseline",
    version: 1,
    place: "machine",
    scope: "run",
    freshnessMs: 5 * 60_000,
  },
  "machine.running": {
    id: "machine.running",
    version: 1,
    place: "machine",
    scope: "run",
    freshnessMs: 15_000,
  },
  "machine.check_channel": {
    id: "machine.check_channel",
    version: 1,
    place: "lab",
    scope: "run",
    freshnessMs: 2 * 60_000,
  },
  "lab.internet": {
    id: "lab.internet",
    version: 1,
    place: "lab",
    scope: "run",
    freshnessMs: 10 * 60_000,
  },
  "service.running": {
    id: "service.running",
    version: 1,
    place: "service",
    scope: "run",
    freshnessMs: 20_000,
  },
  "service.reachable_from_lab": {
    id: "service.reachable_from_lab",
    version: 1,
    place: "lab",
    scope: "run",
    freshnessMs: 10 * 60_000,
  },
  "learner_plan.exists": {
    id: "learner_plan.exists",
    version: 1,
    place: "project",
    scope: "run",
    freshnessMs: 0,
  },
};

export function paramsKey(params: Requirement["params"]): string {
  return [params.iface ?? "", (params.ports ?? []).join(","), params.stack ?? ""]
    .filter(Boolean)
    .join(":");
}
