import { describe, expect, it } from "vitest";

import { DEFAULT_WORKSPACE, deservesWorkspace, workspaceSlug } from "./workspace-choice";

describe("where work lives is the person's choice", () => {
  it("defaults to local, not to someone's GitHub account", () => {
    // Creating a repository is an outward action on an account, taken for a project that
    // might be abandoned within the hour. Local needs no account and nothing leaves the
    // machine, which is what this product claims to be.
    expect(DEFAULT_WORKSPACE).toBe("local");
  });
});

describe("naming a workspace", () => {
  it("turns a title into something a filesystem and a git host both accept", () => {
    expect(workspaceSlug("Active Directory User-Lifecycle Automation Suite")).toBe(
      "active-directory-user-lifecycle-automati",
    );
    expect(workspaceSlug("IBM QRadar Community Edition SIEM Lab")).toBe("ibm-qradar-community-edition-siem-lab");
  });

  it("strips what would break a path", () => {
    expect(workspaceSlug("Bob's lab / round #2")).toBe("bob-s-lab-round-2");
    expect(workspaceSlug("../../etc/passwd")).toBe("etc-passwd");
    expect(workspaceSlug("  spaced   out  ")).toBe("spaced-out");
  });

  it("never returns an empty name", () => {
    // A title of only punctuation, or of a script this strips entirely, still has to
    // produce a directory.
    for (const title of ["", "   ", "!!!", "。。。"]) {
      expect(workspaceSlug(title)).toBe("project");
    }
  });

  it("does not end in a dash after truncation", () => {
    const long = "a".repeat(38) + " something";
    expect(workspaceSlug(long).endsWith("-")).toBe(false);
  });
});

describe("only builds deserve a workspace", () => {
  it("a project does; a certification and a course do not", () => {
    expect(deservesWorkspace("project")).toBe(true);
    expect(deservesWorkspace("certification")).toBe(false);
    expect(deservesWorkspace("course")).toBe(false);
  });
});
