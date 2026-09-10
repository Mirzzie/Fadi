import { mkdtemp, mkdir, readFile, readdir, symlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * WRITING TO A REAL DISK, THROUGH THE WHOLE PATH.
 *
 * Everything else about file recipes is tested with the filesystem mocked or absent, which
 * proves the validation and proves nothing about whether a write lands where it should —
 * or, more to the point, whether it *stays* where it should when a symlink is in the way.
 *
 * Requires FADI_E2E_FS=1 and FADI_TEST_DATABASE_URL. Off by default: a test that writes to
 * directories on someone's laptop should be asked for, not discovered.
 */
const ENABLED = process.env.FADI_E2E_FS === "1" && !!process.env.FADI_TEST_DATABASE_URL;
const suite = ENABLED ? describe : describe.skip;

suite("Fadi writes inside the workspace and nowhere else", () => {
  let pool: import("pg").Pool;
  let userId: string;
  let base: string;
  let root: string;
  let outside: string;

  beforeAll(async () => {
    base = await mkdtemp(join(tmpdir(), "fadi-e2e-"));
    root = join(base, "workspace");
    outside = join(base, "outside");
    await mkdir(root, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "secret.txt"), "original");
    await symlink(outside, join(root, "escape"));

    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: process.env.FADI_TEST_DATABASE_URL });
    const { rows } = await pool.query(`insert into users (email) values ($1) returning id`, [
      `fs-${Date.now()}@example.test`,
    ]);
    userId = rows[0].id as string;
    await pool.query(`insert into lab_settings (user_id, workspace_root) values ($1, $2)`, [
      userId,
      root,
    ]);
  }, 120_000);

  afterAll(async () => {
    if (userId) await pool.query(`delete from users where id = $1`, [userId]);
    await pool?.end();
    if (base) await rm(base, { recursive: true, force: true });
  });

  async function runNow(recipe: string, params: Record<string, unknown>, confirmation?: string) {
    const { proposeAction, approveAndRun } = await import("./broker");
    const proposal = await proposeAction({ userId, recipe, params, actor: "model", origin: "e2e" });
    if (!proposal.ok) return { proposed: false as const, message: proposal.message };
    const result = await approveAndRun({ userId, requestId: proposal.requestId, confirmation });
    return { proposed: true as const, result };
  }

  it("writes a file where it said it would", async () => {
    const out = await runNow("file.write", {
      path: "ad-lab/provision.ps1",
      content: "Write-Host 'hello'",
    });
    expect(out.proposed).toBe(true);
    if (out.proposed) expect(out.result.ok, out.result.ok ? "" : out.result.message).toBe(true);

    expect(await readFile(join(root, "ad-lab/provision.ps1"), "utf8")).toBe("Write-Host 'hello'");
  }, 60_000);

  it("keeps the previous version when overwriting, so the undo is real", async () => {
    await runNow("file.write", { path: "notes.md", content: "first" });
    await runNow("file.write", { path: "notes.md", content: "second" });

    expect(await readFile(join(root, "notes.md"), "utf8")).toBe("second");
    // The claim in the reversal line is "the old version is kept next to it". Here it is.
    const backups = (await readdir(root)).filter((f) => f.startsWith("notes.md.fadi-bak-"));
    expect(backups).toHaveLength(1);
    expect(await readFile(join(root, backups[0]), "utf8")).toBe("first");
  }, 60_000);

  it("THE ESCAPE: refuses to write through a symlink that leaves the workspace", async () => {
    const out = await runNow("file.write", { path: "escape/secret.txt", content: "overwritten" });

    // Refused at proposal, so the person is never asked to approve it.
    expect(out.proposed).toBe(true);
    if (out.proposed) expect(out.result.ok).toBe(false);
    // And the file outside is untouched — the assertion that actually matters.
    expect(await readFile(join(outside, "secret.txt"), "utf8")).toBe("original");
  }, 60_000);

  it("deletes only inside the workspace, and only when the name is typed", async () => {
    await runNow("file.write", { path: "scratch.txt", content: "bye" });

    const wrongWord = await runNow("file.remove", { path: "scratch.txt" }, "yes");
    expect(wrongWord.proposed).toBe(true);
    if (wrongWord.proposed) expect(wrongWord.result.ok).toBe(false);
    expect(await readFile(join(root, "scratch.txt"), "utf8")).toBe("bye");

    const typed = await runNow("file.remove", { path: "scratch.txt" }, "scratch.txt");
    expect(typed.proposed).toBe(true);
    if (typed.proposed) expect(typed.result.ok, typed.result.ok ? "" : typed.result.message).toBe(true);
    await expect(readFile(join(root, "scratch.txt"), "utf8")).rejects.toThrow();
  }, 60_000);

  it("has no filesystem at all when no workspace is set", async () => {
    await pool.query(`update lab_settings set workspace_root = null where user_id = $1`, [userId]);
    const out = await runNow("file.write", { path: "anywhere.txt", content: "x" });
    expect(out.proposed).toBe(true);
    if (out.proposed) expect(out.result.ok).toBe(false);
    await pool.query(`update lab_settings set workspace_root = $2 where user_id = $1`, [userId, root]);
  }, 60_000);
});
