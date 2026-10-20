import { describe, expect, it } from "vitest";
import { z } from "zod";

import { describeSchema } from "./openai";

describe("the schema a model is told to follow", () => {
  it("is the real shape of a Zod 4 schema, not an empty object", () => {
    const schema = z.object({
      steps: z
        .array(
          z.object({
            title: z.string(),
            instruction: z.string(),
            where: z.enum(["lab", "browser", "fadi"]).optional(),
          })
        )
        .min(1),
    });
    const described = describeSchema(schema, "project_plan") as {
      properties: { steps: { items: { properties: Record<string, unknown>; required: string[] } } };
    };
    expect(Object.keys(described.properties.steps.items.properties)).toEqual([
      "title",
      "instruction",
      "where",
    ]);
    expect(described.properties.steps.items.required).toEqual(["title", "instruction"]);
  });
});
