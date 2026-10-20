import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { replaceTextFileAtomically } from "./vmware";

let folder: string | null = null;

afterEach(async () => {
  if (folder) await rm(folder, { recursive: true, force: true });
  folder = null;
});

describe("atomic VMware configuration writes", () => {
  it("publishes the complete replacement with the prior file mode and no temporary file", async () => {
    folder = await mkdtemp(path.join(tmpdir(), "fadi-vmx-atomic-"));
    const target = path.join(folder, "machine.vmx");
    await writeFile(target, 'displayName = "Before"\n', { mode: 0o640 });

    await replaceTextFileAtomically(target, 'displayName = "After"\nmemsize = "4096"\n');

    expect(await readFile(target, "utf8")).toBe('displayName = "After"\nmemsize = "4096"\n');
    expect((await stat(target)).mode & 0o777).toBe(0o640);
    expect((await readdir(folder)).filter((name) => name.includes("fadi-tmp"))).toEqual([]);
  });
});
