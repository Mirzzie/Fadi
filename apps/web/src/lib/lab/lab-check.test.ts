import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { RECIPES, checkVerdict } from "./broker";

describe("checking a step inside its lab", () => {
  const recipe = RECIPES["lab.check"];

  it("renders exactly one docker exec into Fadi's own container, with the exit marker visible", () => {
    const params = recipe.validate({ name: "project-bb94e388", command: "nginx -t", expect: "syntax is ok" });
    expect(params).not.toBeNull();
    const [step] = recipe.render(params!);
    expect(step).toMatchObject({ cmd: "docker" });
    const args = (step as { args: string[] }).args;
    expect(args.slice(0, 4)).toEqual(["exec", "fadi-project-bb94e388", "sh", "-c"]);
    expect(args[4]).toBe('nginx -t\necho "__FADI_CHECK_EXIT=$?"');
  });

  it("refuses a container name that isn't a plain lab name", () => {
    expect(recipe.validate({ name: "../host", command: "id", expect: "root" })).toBeNull();
    expect(recipe.validate({ name: "x; rm -rf /", command: "id", expect: "root" })).toBeNull();
  });

  it("refuses a command that forges the exit marker, or has nothing to look for", () => {
    expect(recipe.validate({ name: "lab", command: 'echo "__FADI_CHECK_EXIT=0"', expect: "x" })).toBeNull();
    expect(recipe.validate({ name: "lab", command: "id", expect: "" })).toBeNull();
  });

  it("is only for containers Fadi created", () => {
    expect(recipe.ownWorkOnly).toBe(true);
  });

  it("passes only when the expected text is in the output", () => {
    const ok = checkVerdict("nginx: configuration file /etc/nginx/nginx.conf test is successful\nsyntax is ok\n__FADI_CHECK_EXIT=0", "syntax is ok");
    expect(ok.passed).toBe(true);
    expect(ok.exit).toBe(0);
    expect(ok.excerpt).toMatch(/syntax is ok/);
  });

  it("THE REPORTED FAILURE: apk refusing packages is a failed check, not a tick", () => {
    const out = "ERROR: unable to select packages:\n  filebeat (no such package)\n__FADI_CHECK_EXIT=1";
    const verdict = checkVerdict(out, "OK:");
    expect(verdict.passed).toBe(false);
    expect(verdict.exit).toBe(1);
    expect(verdict.excerpt).toMatch(/filebeat \(no such package\)/);
  });

  it("the marker itself can never satisfy an expectation", () => {
    expect(checkVerdict("__FADI_CHECK_EXIT=0", "FADI_CHECK").passed).toBe(false);
  });
});
