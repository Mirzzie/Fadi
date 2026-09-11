import { describe, expect, it } from "vitest";

import { labNeedFor, worthARepo } from "./needs-lab";

/**
 * The point of this module is RESTRAINT: it decides what not to show. So the tests are
 * mostly about what it refuses to claim.
 */

describe("only things you build need a machine", () => {
  it("a certification needs no lab, whatever its description mentions", () => {
    // "Splunk Fundamentals 1 Certification" is full of infrastructure vocabulary and is
    // still an exam. The kind settles it before any text matching begins.
    expect(
      labNeedFor({
        kind: "certification",
        title: "Splunk Fundamentals 1 Certification",
        detail: "Covers deploying Splunk servers, forwarders and indexes on Linux.",
      }).needed,
    ).toBe(false);
  });

  it("a course needs no lab either", () => {
    expect(labNeedFor({ kind: "course", title: "Windows Server administration", detail: "VMs, AD, GPO" }).needed).toBe(
      false,
    );
  });

  it("a project describing a full OS needs a virtual machine", () => {
    const need = labNeedFor({
      kind: "project",
      title: "Active Directory User-Lifecycle Automation Suite",
      detail: "Build a Windows Server domain controller and automate joiners and leavers.",
    });
    expect(need.needed).toBe(true);
    if (need.needed) {
      expect(need.kind).toBe("vms");
      // One clause. A card has room for one clause.
      expect(need.phrase.split(" ").length).toBeLessThanOrEqual(5);
    }
  });

  it("a project describing services needs a container", () => {
    const need = labNeedFor({
      kind: "project",
      title: "Log pipeline",
      detail: "Run nginx and a syslog collector in Docker containers and ship the logs.",
    });
    expect(need.needed).toBe(true);
    if (need.needed) expect(need.kind).toBe("containers");
  });

  it("a project that is only writing needs nothing", () => {
    expect(
      labNeedFor({ kind: "project", title: "Write an incident-response runbook", detail: "A document." }).needed,
    ).toBe(false);
  });
});

describe("only things that produce files are worth a repository", () => {
  it("a project is", () => {
    expect(worthARepo({ kind: "project" })).toBe(true);
  });

  it("a certification and a course are not", () => {
    // A profile of empty repos reads as someone who starts things.
    expect(worthARepo({ kind: "certification" })).toBe(false);
    expect(worthARepo({ kind: "course" })).toBe(false);
    expect(worthARepo({ kind: "practice" })).toBe(false);
  });
});
