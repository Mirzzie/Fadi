import { describe, expect, it } from "vitest";

import { commandFailure } from "./broker";

describe("why a command failed, in the tool's own words", () => {
  it("shows vmrun's reason instead of only the command line", () => {
    const error = Object.assign(new Error("Command failed: vmrun -T ws start /vm.vmx nogui"), {
      stdout: "Error: The file is locked by another program\n",
      stderr: "",
    });
    expect(commandFailure({ cmd: "vmrun" }, error)).toBe(
      "vmrun: The file is locked by another program"
    );
  });

  it("says a slow command was given up on, and may still finish", () => {
    const error = Object.assign(new Error("Command failed"), { killed: true, signal: "SIGTERM" });
    expect(commandFailure({ cmd: "vmrun", timeoutMs: 180_000 }, error)).toMatch(
      /took longer than 180 seconds.*may still finish/
    );
  });

  it("falls back to stderr, then to the error itself", () => {
    expect(
      commandFailure(
        { cmd: "docker" },
        Object.assign(new Error("x"), { stderr: "no such container\n" })
      )
    ).toBe("docker: no such container");
    expect(commandFailure({ cmd: "docker" }, new Error("spawn docker ENOENT"))).toBe(
      "spawn docker ENOENT"
    );
  });
});
