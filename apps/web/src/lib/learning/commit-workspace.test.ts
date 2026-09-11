import { mkdtemp, readdir, rm, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveInWorkspace } from "@/lib/lab/workspace";
import { workspaceSlug } from "@/lib/learning/workspace-choice";

/** The folder a commit would make, resolved and created the same way the action does. */
describe("a committed project gets a real folder", () => {
  it("creates it inside the workspace and nowhere else", async () => {
    const base = await mkdtemp(join(tmpdir(), "fadi-commit-"));
    const root = join(base, "labs");
    await mkdir(root, { recursive: true });
    await mkdir(join(base, "outside"), { recursive: true });
    await symlink(join(base, "outside"), join(root, "escape"));

    try {
      const slug = workspaceSlug("Splunk Enterprise SIEM Lab");
      const resolved = await resolveInWorkspace(root, slug);
      expect(resolved.ok).toBe(true);
      if (resolved.ok) {
        const fs = await import("node:fs/promises");
        await fs.mkdir(resolved.path, { recursive: true });
        expect(await readdir(root)).toContain("splunk-enterprise-siem-lab");
        // Nothing landed outside.
        expect(await readdir(join(base, "outside"))).toHaveLength(0);
      }

      // A title that resolves through a symlink out of the workspace is refused before
      // anything is created.
      const bad = await resolveInWorkspace(root, "escape/elsewhere");
      expect(bad.ok).toBe(false);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
