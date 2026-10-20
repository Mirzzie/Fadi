import { describe, expect, it } from "vitest";

import { classifyExit } from "./runtime-observer";

describe("why a lab container is not running", () => {
  it("THE REPORTED LAB: exit 143 (docker stop) is stopped, not failed", () => {
    expect(classifyExit({ exitCode: 143, oomKilled: false, error: "" }).phase).toBe("stopped");
  });

  it("exit 137 after a stop timeout is still a stop", () => {
    expect(classifyExit({ exitCode: 137, oomKilled: false, error: "" }).phase).toBe("stopped");
  });

  it("an out-of-memory kill is a failure and says so", () => {
    const exit = classifyExit({ exitCode: 137, oomKilled: true, error: "" });
    expect(exit.phase).toBe("failed");
    expect(exit.detail).toMatch(/out of memory/);
  });

  it("a signal is reported with its code, without inventing who stopped it", () => {
    const exit = classifyExit({ exitCode: 143, oomKilled: false, error: "" });
    expect(exit.detail).toMatch(/signal \(exit 143\)/);
    expect(exit.detail).not.toMatch(/you|docker stop|reboot/i);
  });

  it("an error Docker recorded wins over a stop-looking exit code", () => {
    const exit = classifyExit({ exitCode: 137, oomKilled: false, error: "failed to mount volume" });
    expect(exit.phase).toBe("failed");
    expect(exit.detail).toBe("failed to mount volume");
  });

  it("a program that exits with an error is a failure", () => {
    expect(classifyExit({ exitCode: 1, oomKilled: false, error: "" }).phase).toBe("failed");
  });
});
