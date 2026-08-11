// Verified Greenhouse boards the Web Surfer sweeps as an always-on source. Each was probed
// live (boards-api.greenhouse.io returned 200 with current jobs) — no dead tokens. ATS boards
// list only OPEN roles, so results are inherently fresh (unlike a stale aggregator pool).
// Tech-leaning by design; Stripe + Intercom are Dublin-HQ'd so they carry real Ireland roles.
// Users can add their own boards later; this is the zero-config starter set.

export type AtsSeed = { kind: "greenhouse" | "lever"; token: string; company: string };

export const ATS_SEED: AtsSeed[] = [
  { kind: "greenhouse", token: "stripe", company: "Stripe" },
  { kind: "greenhouse", token: "intercom", company: "Intercom" },
  { kind: "greenhouse", token: "gitlab", company: "GitLab" },
  { kind: "greenhouse", token: "datadog", company: "Datadog" },
  { kind: "greenhouse", token: "databricks", company: "Databricks" },
  { kind: "greenhouse", token: "cloudflare", company: "Cloudflare" },
  { kind: "greenhouse", token: "mongodb", company: "MongoDB" },
  { kind: "greenhouse", token: "elastic", company: "Elastic" },
  { kind: "greenhouse", token: "monzo", company: "Monzo" },
];
