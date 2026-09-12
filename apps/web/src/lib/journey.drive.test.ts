import { beforeAll, describe, it, vi } from "vitest";

/**
 * A REAL USER JOURNEY through the server actions the Learning hub's buttons call, against
 * the real database, the real AI provider and the real Docker daemon. Only the session is
 * stubbed. Observes and reports; it does not assert, because the point is to find what
 * breaks. Opt-in: FADI_JOURNEY=1.
 */
const ENABLED = process.env.FADI_JOURNEY === "1";
const suite = ENABLED ? describe : describe.skip;
const USER = "b9c09bc9-5556-43ec-9cb7-4f4f607918f1";

vi.mock("@/lib/auth/session", () => ({
  getCurrentAuthUser: async () => ({ id: USER, email: "owner", name: "Owner" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const log = (...a: unknown[]) => console.log("  ", ...a);

suite("journey", () => {
  beforeAll(async () => {
    const { readFileSync } = await import("node:fs");
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  });

  it("walks the hub", async () => {
    const step = process.env.FADI_JOURNEY_STEP ?? "suggest";
    const learning = await import("@/app/dashboard/learning/actions");
    const lab = await import("@/app/dashboard/learning/lab-actions");

    if (step === "suggest") {
      console.log("\n=== 1. SUGGEST: what does Fadi propose for a gap? ===");
      const res = await learning.suggestForGapAction({
        gapTitle: "Linux web server hardening",
        gapDetail: "Configure and harden an nginx reverse proxy with TLS on Linux",
      });
      if (!res.ok) return log("FAILED:", res.message);
      const { labNeedFor, worthARepo } = await import("@/lib/learning/needs-lab");
      for (const s of res.suggestions) {
        const need = labNeedFor(s);
        log(`[${s.kind}] ${s.title}`);
        log(`     lab: ${need.needed ? need.phrase : "none"} · repo: ${worthARepo(s) ? "yes" : "no"}`);
      }
      const { writeFileSync } = await import("node:fs");
      writeFileSync("/tmp/claude-1000/journey/suggestions.json", JSON.stringify(res.suggestions, null, 2));
    }

    if (step === "commit") {
      const { readFileSync } = await import("node:fs");
      const suggestions = JSON.parse(readFileSync("/tmp/claude-1000/journey/suggestions.json", "utf8"));
      const pick = suggestions.find((s: { kind: string }) => s.kind === "project") ?? suggestions[0];
      console.log("\n=== 2. COMMIT to:", pick.title, "===");
      const res = await learning.commitToProjectAction({
        gap: "Linux web server hardening",
        title: pick.title,
        detail: pick.detail,
        kind: pick.kind,
        searchQuery: pick.searchQuery,
      });
      log("ok:", res.ok, "· runId:", res.runId ?? "(none)", res.message ?? "");
      const { writeFileSync } = await import("node:fs");
      writeFileSync("/tmp/claude-1000/journey/run.txt", res.runId ?? "");
    }

    if (step === "open") {
      const { readFileSync } = await import("node:fs");
      const runId = readFileSync("/tmp/claude-1000/journey/run.txt", "utf8").trim();
      console.log("\n=== 3. OPEN the project ===");
      const { runs } = await lab.listProjectRuns();
      // What the workspace uses to decide whether any lab UI appears at all.
      (await import("node:fs")).writeFileSync("/tmp/claude-1000/journey/decisions.txt", runs.map((r) => `${r.title} → ${r.labTemplate ?? "no machine"}`).join("\n"));
      const run = runs.find((r) => r.id === runId);
      if (!run) return log("PROJECT NOT FOUND in the list");
      log("title:", run.title);
      log("placed on:", run.resourceLabel ?? "(no machine)");
      log("steps:", run.steps.length);
      for (const s of run.steps.slice(0, 3)) log(`  ${s.ordinal}. ${s.title}\n       ${s.instruction.slice(0, 110)}`);
      const { templateForProject } = await import("@/lib/lab/spec-from-project");
      log("lab template Fadi would pick:", templateForProject({ title: run.title, detail: null }) ?? "none");
    }

    if (step === "lab") {
      const { readFileSync } = await import("node:fs");
      const runId = readFileSync("/tmp/claude-1000/journey/run.txt", "utf8").trim();
      console.log("\n=== 4. PREPARE LAB ===");
      const res = await lab.proposeProjectLabAction({ runId });
      log("ok:", res.ok, "·", res.message);
      if ("requestId" in res && res.requestId) {
        const { writeFileSync } = await import("node:fs");
        writeFileSync("/tmp/claude-1000/journey/request.txt", String(res.requestId));
      }
    }

    if (step === "approve") {
      const { readFileSync } = await import("node:fs");
      const requestId = readFileSync("/tmp/claude-1000/journey/request.txt", "utf8").trim();
      console.log("\n=== 5. APPROVE (as the person) ===");
      const perms = await import("@/app/dashboard/learning/permission-actions");
      const pending = await perms.listPendingActions();
      const card = pending.pending?.find((p) => p.id === requestId);
      log("card:", card?.summary.slice(0, 90));
      log("confirm:", card?.confirm, "· token:", card?.confirmToken);
      log("preflight:", card?.preflight.map((n) => `[${n.kind}] ${n.text}`).join(" | "));
      const res = await perms.approveAction({ requestId, confirmation: card?.confirmToken });
      log("approved ok:", res.ok, "·", res.message?.slice(0, 160));
    }

    if (step === "runtime") {
      const { readFileSync } = await import("node:fs");
      const runId = readFileSync("/tmp/claude-1000/journey/run.txt", "utf8").trim();
      console.log("\n=== 6. RUNTIME: what does the machine surface show? ===");
      const res = await lab.projectRuntimeAction({ runId });
      log(JSON.stringify(res, null, 2).slice(0, 900));
    }
  }, 300_000);
});
