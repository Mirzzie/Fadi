import { describe, expect, it } from "vitest";

import { RECIPES } from "./broker";

const argvOf = (steps: unknown[]) =>
  steps.map((s) => s as { id: string; args: string[]; timeoutMs?: number });

describe("starting a lab from a saved base", () => {
  it("copies the base into the new lab's disk first, with a long timeout, then starts it", () => {
    const params = RECIPES["lab.start"].validate({
      template: "windows-server-2025",
      name: "project-abc12345",
      fromBase: true,
    })!;
    const steps = argvOf(RECIPES["lab.start"].render(params));
    expect(steps.map((s) => s.id)).toEqual(["seed", "start"]);
    expect(steps[0]!.args).toContain("fadi-base-windows-server-2025:/from:ro");
    expect(steps[0]!.args).toContain("fadi-project-abc12345-storage:/to");
    expect(steps[0]!.args).toContain("--network");
    expect(steps[0]!.timeoutMs).toBeGreaterThan(60_000);
  });

  it("ignores fromBase for a template that keeps no base", () => {
    const params = RECIPES["lab.start"].validate({
      template: "linux-ubuntu",
      name: "project-abc12345",
      fromBase: true,
    })!;
    expect(argvOf(RECIPES["lab.start"].render(params)).map((s) => s.id)).toEqual(["start"]);
  });
});

describe("saving a base", () => {
  it("is only for Windows templates and valid names", () => {
    expect(
      RECIPES["lab.saveBase"].validate({ template: "linux-ubuntu", name: "project-a" })
    ).toBeNull();
    expect(
      RECIPES["lab.saveBase"].validate({ template: "windows-server-2025", name: "../../etc" })
    ).toBeNull();
    const steps = argvOf(
      RECIPES["lab.saveBase"].render(
        RECIPES["lab.saveBase"].validate({ template: "windows-server-2025", name: "project-a" })!
      )
    );
    expect(steps[0]!.args).toContain("fadi-project-a-storage:/from:ro");
    expect(steps[0]!.args.join(" ")).toContain("! -name '*.iso'");
  });
});

describe("removing a lab", () => {
  it("removes the container when there is one, then the disk, never the image", () => {
    const withContainer = argvOf(
      RECIPES["lab.remove"].render(
        RECIPES["lab.remove"].validate({ name: "project-a", container: true })!
      )
    );
    expect(withContainer.map((s) => s.args.join(" "))).toEqual([
      "rm -f fadi-project-a",
      "volume rm fadi-project-a-storage",
    ]);
    const diskOnly = argvOf(
      RECIPES["lab.remove"].render(RECIPES["lab.remove"].validate({ name: "project-a" })!)
    );
    expect(diskOnly.map((s) => s.id)).toEqual(["remove-disk"]);
    expect(withContainer.some((s) => s.args.includes("rmi"))).toBe(false);
  });

  it("asks for the lab's name typed, because it cannot be undone", () => {
    expect(RECIPES["lab.remove"].reversibility).toBe("irreversible");
    expect(RECIPES["lab.remove"].ownWorkOnly).toBe(true);
  });
});

describe("Windows checks", () => {
  const key = "ssh-ed25519 " + "A".repeat(68) + " fadi-lab";

  it("sets up SSH before a fresh Windows install, and not when starting from a base", () => {
    const fresh = argvOf(
      RECIPES["lab.start"].render(
        RECIPES["lab.start"].validate({
          template: "windows-server-2025",
          name: "project-a",
          sshKey: key,
        })!
      )
    );
    expect(fresh.map((s) => s.id)).toEqual(["prepare-checks", "start"]);
    expect(fresh[0]!.args).toContain(key);
    const fromBase = argvOf(
      RECIPES["lab.start"].render(
        RECIPES["lab.start"].validate({
          template: "windows-server-2025",
          name: "project-a",
          sshKey: key,
          fromBase: true,
        })!
      )
    );
    expect(fromBase.map((s) => s.id)).toEqual(["seed", "start"]);
  });

  it("refuses any key that is not Fadi's own ed25519 lab key, and any key for a Linux lab", () => {
    for (const sshKey of [
      "ssh-rsa AAAA fadi-lab",
      key + "; rm -rf /",
      key.replace("fadi-lab", "x"),
    ]) {
      const params = RECIPES["lab.start"].validate({
        template: "windows-server-2025",
        name: "project-a",
        sshKey,
      })!;
      expect(params.sshKey).toBeNull();
    }
    expect(
      RECIPES["lab.start"].validate({ template: "linux-ubuntu", name: "project-a", sshKey: key })!
        .sshKey
    ).toBeNull();
  });

  it("runs a Windows check over SSH on 127.0.0.1 as the lab account, not docker exec", () => {
    const params = RECIPES["lab.check"].validate({
      name: "project-a",
      command: "Get-Service sshd",
      expect: "Running",
      shell: "powershell",
      template: "windows-server-2025",
    })!;
    const [step] = RECIPES["lab.check"].render(params) as Array<{ cmd: string; args: string[] }>;
    expect(step!.cmd).toBe("ssh");
    expect(step!.args).toContain("Docker@127.0.0.1");
    expect(step!.args.at(-1)).toMatch(/^Get-Service sshd; if \(\$\?\)/);
  });

  it("will not run a Windows check without knowing the lab", () => {
    expect(
      RECIPES["lab.check"].validate({
        name: "project-a",
        command: "x",
        expect: "y",
        shell: "powershell",
      })
    ).toBeNull();
  });
});
