import { describe, expect, it } from "vitest";
import { z } from "zod";

import { extractionSchemaShape, normKind } from "./pool";

/**
 * Regression guard for the bug that kept `evidence_items` at 0 rows for every user.
 *
 * Structured output is only ENFORCED in strict mode, and strict mode requires every
 * property to be `required`. A single `.optional()` or `.default()` silently demotes the
 * request to a non-strict schema, where the model is merely advised of the shape — and
 * it then returned an object with no `items` key, failing 100% of calls.
 *
 * Deliberately a PURE schema test, not a live API call: the invariant that broke is
 * "no optional fields", and that can be asserted in a millisecond with no key, no
 * network and no flakiness. Testing the API call would be slower, costlier and would
 * still not state the actual rule.
 */
function assertNoOptionalFields(shape: Record<string, unknown>, path = ""): string[] {
  const offenders: string[] = [];
  for (const [key, raw] of Object.entries(shape)) {
    const schema = raw as z.ZodType;
    const here = path ? `${path}.${key}` : key;
    // `.nullable()` is fine — the field stays required, its VALUE may be null.
    // `.optional()` / `.default()` are not: they remove it from `required`, which is
    // what drops the whole request out of strict mode.
    if (schema.safeParse(undefined).success) offenders.push(here);

    // Walk through arrays/nullables to reach any nested object shape.
    let inner: z.ZodType = schema;
    while (inner instanceof z.ZodNullable || inner instanceof z.ZodArray) {
      inner = inner instanceof z.ZodArray ? (inner.element as z.ZodType) : (inner.unwrap() as z.ZodType);
    }
    if (inner instanceof z.ZodObject) {
      offenders.push(...assertNoOptionalFields(inner.shape as Record<string, unknown>, here));
    }
  }
  return offenders;
}

describe("evidence extraction schema", () => {
  it("has no optional or defaulted fields anywhere", () => {
    // If this fails, extraction will silently return zero items in production.
    // Use `.nullable()` instead — the field stays required, the value may be null.
    expect(assertNoOptionalFields(extractionSchemaShape)).toEqual([]);
  });

  it("accepts nulls for every non-title field", () => {
    const schema = z.object(extractionSchemaShape);
    const parsed = schema.parse({
      items: [
        {
          kind: null,
          title: "Home lab",
          organization: null,
          attribution: null,
          period: null,
          detail: null,
          metrics: null,
          tags: [],
          marketTags: [],
        },
      ],
    });
    expect(parsed.items[0].title).toBe("Home lab");
  });

  it("rejects a payload missing items — the exact production failure", () => {
    const schema = z.object(extractionSchemaShape);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("what kind of record this is", () => {
  it("THE REPORTED DEFECT: a certification is not employment", () => {
    // pool.ts had five kinds with no `certification`, and normKind fell back to `experience`,
    // so a credential extracted from a CV became employment-shaped data downstream — while the
    // portfolio showed the same thing as a certification.
    expect(normKind("certification")).toBe("certification");
    expect(normKind("Certificate")).toBe("certification");
    expect(normKind("credential")).toBe("certification");
  });

  it("an unreadable kind is held as unclassified, never filed as a job", () => {
    expect(normKind("volunteering")).toBe("unclassified");
    expect(normKind("")).toBe("unclassified");
    expect(normKind(null)).toBe("unclassified");
    expect(normKind(undefined)).toBe("unclassified");
  });

  it("the words people actually use still land on the right kind", () => {
    expect(normKind("job")).toBe("experience");
    expect(normKind("Employment")).toBe("experience");
    expect(normKind("degree")).toBe("education");
    expect(normKind("award")).toBe("achievement");
    expect(normKind("project")).toBe("project");
  });
});
