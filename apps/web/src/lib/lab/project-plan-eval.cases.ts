import type { ProjectPlanEvalCase } from "./project-plan-eval";

/**
 * Stable shapes, current scenarios. Market sources are reviewed quarterly; the scorer is stable
 * so before/after planner results remain comparable while the scenarios can be deliberately
 * versioned when the market moves.
 */
export const PROJECT_PLAN_EVAL_CASES: ProjectPlanEvalCase[] = [
  {
    id: "security-token-takeover",
    direction: "security",
    title: "Contain a stolen-session takeover",
    detail:
      "Build identity telemetry in a local lab, replay a stolen session, detect it, revoke it, and preserve the investigation trail.",
    template: "linux-ubuntu",
    conceptGroups: [
      ["session", "token"],
      ["detect", "telemetry"],
      ["revoke", "contain"],
      ["investigation", "finding"],
    ],
    market: {
      signal:
        "Session management, invalidation and reauthentication are explicit application-security verification areas.",
      sourceUrl: "https://owasp.org/www-project-application-security-verification-standard/",
      reviewBy: "2027-01-15",
    },
  },
  {
    id: "security-supply-chain",
    direction: "security",
    title: "Stop a tampered build from reaching deployment",
    detail:
      "Build a signed CI artifact flow, alter an artifact after build, prove verification blocks it, repair the pipeline and export provenance.",
    template: "linux-ubuntu",
    conceptGroups: [
      ["artifact"],
      ["sign", "signature"],
      ["tamper", "alter"],
      ["provenance", "attestation"],
    ],
    market: {
      signal: "Build provenance and tamper resistance are explicit SLSA supply-chain controls.",
      sourceUrl: "https://slsa.dev/spec/v1.2/",
      reviewBy: "2027-01-15",
    },
  },
  {
    id: "cloud-iam-drift",
    direction: "cloud",
    title: "Detect and repair cloud IAM drift",
    detail:
      "Model least-privilege roles in a local cloud emulator, introduce an excessive permission, detect the drift, remove it and document the trade-off.",
    template: "linux-ubuntu",
    conceptGroups: [
      ["iam", "permission"],
      ["least privilege"],
      ["drift"],
      ["remov", "remediat", "fix"],
    ],
    market: {
      signal: "Cloud identity and secure-by-default configuration remain acquisition concerns.",
      sourceUrl:
        "https://www.cisa.gov/sites/default/files/2024-08/SecureByDemandGuide_080624_508c.pdf",
      reviewBy: "2027-01-15",
    },
  },
  {
    id: "cloud-cost-resilience",
    direction: "cloud",
    title: "Control a cloud cost and availability incident",
    detail:
      "Instrument a container service locally, simulate a traffic spike and dependency failure, enforce a budget guardrail, recover service and report SLO impact.",
    template: "linux-ubuntu",
    conceptGroups: [
      ["cost", "budget"],
      ["traffic", "load"],
      ["failure", "outage"],
      ["slo", "availability"],
    ],
    market: {
      signal:
        "Reliability targets, error budgets and cost trade-offs are core cloud architecture practice.",
      sourceUrl: "https://cloud.google.com/architecture/framework/reliability/choose-slos",
      reviewBy: "2027-01-15",
    },
  },
  {
    id: "devops-kubernetes-release",
    direction: "devops",
    title: "Make a Kubernetes release fail safely",
    detail:
      "Deploy a small service to a local cluster, ship a broken health check, observe the failed rollout, roll back, fix it and retain deployment evidence.",
    template: "linux-ubuntu",
    conceptGroups: [
      ["kubernetes", "cluster"],
      ["health"],
      ["rollout", "release"],
      ["rollback", "recover"],
    ],
    market: {
      signal:
        "Kubernetes deployments expose rollout state, failed progress and rollback as operating controls.",
      sourceUrl: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/",
      reviewBy: "2027-01-15",
    },
  },
  {
    id: "devops-observability",
    direction: "devops",
    title: "Diagnose an unknown service slowdown",
    detail:
      "Instrument a local service with traces, metrics and logs, inject latency, locate the bottleneck, tune it and prove the SLO recovered.",
    template: "linux-ubuntu",
    conceptGroups: [["trace"], ["metric"], ["log"], ["latency", "slow"], ["slo"]],
    market: {
      signal:
        "OpenTelemetry defines correlated traces, metrics and logs as the basis for diagnosing unknown failures.",
      sourceUrl: "https://opentelemetry.io/docs/concepts/observability-primer/",
      reviewBy: "2027-01-15",
    },
  },
  {
    id: "data-quality-lineage",
    direction: "data",
    title: "Stop bad data from reaching a dashboard",
    detail:
      "Build a local ingestion pipeline, inject malformed and duplicate records, quarantine them, repair the transform and export quality and lineage evidence.",
    template: "linux-postgres",
    conceptGroups: [
      ["ingest", "pipeline"],
      ["malformed", "invalid"],
      ["duplicate"],
      ["quarantine", "reject"],
      ["lineage"],
    ],
    market: {
      signal:
        "OpenLineage defines a standard API for recording dataset, job and run lineage.",
      sourceUrl: "https://openlineage.io/docs/",
      reviewBy: "2027-01-15",
    },
  },
  {
    id: "data-postgres-recovery",
    direction: "data",
    title: "Prove a PostgreSQL recovery objective",
    detail:
      "Create a database backup locally, corrupt or delete test data, restore it, measure recovery time and write the recovery decision and runbook.",
    template: "linux-postgres",
    conceptGroups: [
      ["backup"],
      ["corrupt", "delete"],
      ["restore", "recover"],
      ["recovery time", "rto"],
      ["runbook"],
    ],
    market: {
      signal:
        "PostgreSQL documents continuous archiving and point-in-time recovery as its recoverability mechanism.",
      sourceUrl: "https://www.postgresql.org/docs/current/continuous-archiving.html",
      reviewBy: "2027-01-15",
    },
  },
  {
    id: "it-support-onboarding",
    direction: "it-support",
    title: "Automate auditable Windows onboarding and offboarding",
    detail:
      "In Windows Server, create and disable lab accounts with PowerShell, test least privilege and group removal, recover from a bad assignment and export an audit report.",
    template: "windows-server-2025",
    conceptGroups: [
      ["account", "user"],
      ["disable", "offboard"],
      ["least privilege", "group"],
      ["audit", "report"],
    ],
    market: {
      signal:
        "NIST access-control guidance covers account management, least privilege and auditability.",
      sourceUrl: "https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final",
      reviewBy: "2027-01-15",
    },
  },
  {
    id: "it-support-endpoint-policy",
    direction: "it-support",
    title: "Find and repair Windows endpoint policy drift",
    detail:
      "Apply a Windows security policy in a lab, introduce a conflicting local setting, detect the drift, restore policy, verify the effective result and keep screenshots and logs.",
    template: "windows-11",
    conceptGroups: [
      ["policy"],
      ["conflict", "drift"],
      ["restore", "repair"],
      ["effective", "result"],
      ["screenshot", "log"],
    ],
    market: {
      signal:
        "Microsoft publishes supported Windows security baselines for managed endpoint configuration.",
      sourceUrl:
        "https://learn.microsoft.com/en-us/windows/security/operating-system-security/device-management/windows-security-configuration-framework/windows-security-baselines",
      reviewBy: "2027-01-15",
    },
  },
];
