import { describe, expect, it } from "vitest";

import { FadiScraperSource } from "./index";
import { RECIPES, buildKeywords, recordToPosting } from "./recipes";

const recipe = RECIPES[0];

describe("fadi-scraper recipes", () => {
  it("builds searchable keywords from a verbose query", () => {
    expect(buildKeywords({ keywords: ["Senior Cloud Engineer", "AWS", "Terraform", "Kubernetes", "extra"] } as never)).toBe(
      "Senior Cloud Engineer AWS Terraform Kubernetes",
    );
    expect(buildKeywords({ keywords: [] } as never)).toBe("jobs");
  });

  it("normalizes a scraped record into a JobPosting", () => {
    const p = recordToPosting(
      { title: "  Registered Nurse ", company: "Mater Hospital", location: "Dublin (Remote)", url: "/listings/abc" },
      recipe,
    );
    expect(p).not.toBeNull();
    expect(p!.title).toBe("Registered Nurse");
    expect(p!.company).toBe("Mater Hospital");
    expect(p!.sourceId).toBe(`fadi-scraper:${recipe.id}`);
    expect(p!.url).toBe(`${recipe.origin}/listings/abc`); // relative link resolved to origin
    expect(p!.remote).toBe(true); // inferred from "(Remote)"
  });

  it("drops records missing a title or company", () => {
    expect(recordToPosting({ title: "", company: "Acme" }, recipe)).toBeNull();
    expect(recordToPosting({ title: "Role", company: "  " }, recipe)).toBeNull();
  });

  it("is dormant (returns no jobs) when disabled", async () => {
    const src = new FadiScraperSource(false);
    expect(src.isConfigured).toBe(false);
    expect(await src.fetchJobs({ keywords: ["nurse"], limit: 5 } as never)).toEqual([]);
  });
});
