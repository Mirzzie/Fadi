import { describe, expect, it } from "vitest";

import { describeWhere, placeOf, routeTarget } from "./where";

describe("placeOf", () => {
  it("names the screen in words a person would use", () => {
    expect(placeOf("/dashboard/jobs")).toContain("jobs board");
    expect(placeOf("/dashboard/evidence")).toContain("career record");
    expect(placeOf("/dashboard")).toContain("dashboard");
  });

  it("prefers the more specific route", () => {
    expect(placeOf("/dashboard/documents/11111111-1111-4111-8111-111111111111")).toContain(
      "open in the editor"
    );
    expect(placeOf("/dashboard/documents")).toContain("documents library");
  });

  it("ignores query strings and trailing slashes", () => {
    expect(placeOf("/dashboard/jobs/?q=support")).toContain("jobs board");
    expect(placeOf("/dashboard/portfolio/")).toContain("portfolio");
  });

  it("says nothing about a route it does not know", () => {
    expect(placeOf("/somewhere-else")).toBeNull();
    expect(placeOf("")).toContain("dashboard");
  });
});

describe("routeTarget", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("finds the record the route is about", () => {
    expect(routeTarget(`/dashboard/documents/${id}`)).toEqual({ kind: "document", id });
    expect(routeTarget(`/dashboard/applications/${id}/workspace`)).toEqual({
      kind: "application",
      id,
    });
    expect(routeTarget(`/dashboard/learning/projects/${id}`)).toEqual({ kind: "project", id });
  });

  it("is null where there is nothing specific open", () => {
    expect(routeTarget("/dashboard/documents")).toBeNull();
    expect(routeTarget("/dashboard/jobs")).toBeNull();
  });
});

describe("describeWhere", () => {
  it("tells Fadi what 'this' means", () => {
    const line = describeWhere({
      place: "one of their documents, open in the editor",
      entity: { kind: "document", id: "x", label: "IT Support CV" },
    });
    expect(line).toContain("IT Support CV");
    expect(line).toContain('If they say "this"');
  });

  it("says nothing when it knows nothing", () => {
    expect(describeWhere(null)).toBe("");
    expect(describeWhere({ place: "" })).toBe("");
  });
});
