import { describe, expect, it } from "vitest";

import { formatStoryAsAnswer, pickBestStory, type StoryView } from "./story-format";

const story = (over: Partial<StoryView>): StoryView => ({
  id: Math.random().toString(36).slice(2),
  origin: "manual",
  title: "Untitled",
  competencies: [],
  situation: "",
  task: "",
  action: "",
  result: "",
  reflection: "",
  ...over,
});

const conflict = story({
  title: "Defused a team standoff",
  competencies: ["conflict", "communication"],
  situation: "Two senior engineers had stopped speaking",
  result: "Shipped the release a week early",
});
const leadership = story({
  title: "Led the migration",
  competencies: ["leadership", "ownership"],
  situation: "Inherited a stalled platform migration",
  result: "Cut infra cost 40%",
});
const failure = story({
  title: "Shipped a regression",
  competencies: ["failure", "learning"],
  situation: "A bad deploy took checkout down",
  result: "Added the test suite that caught the next three",
});

describe("pickBestStory", () => {
  it("returns null on an empty bank", () => {
    expect(pickBestStory([], "tell me about conflict")).toBeNull();
  });

  it("matches a question to the story whose competency it names", () => {
    const stories = [leadership, conflict, failure];
    expect(pickBestStory(stories, "Tell me about a time you handled conflict on a team")?.title).toBe(
      "Defused a team standoff",
    );
    expect(pickBestStory(stories, "Describe a failure you learned from")?.title).toBe(
      "Shipped a regression",
    );
    expect(pickBestStory(stories, "When did you show leadership?")?.title).toBe("Led the migration");
  });

  it("falls back to the first story when nothing meaningful overlaps", () => {
    const stories = [leadership, conflict];
    expect(pickBestStory(stories, "the of a")).toBe(leadership);
  });
});

describe("formatStoryAsAnswer", () => {
  it("renders the STAR+R shape and omits an empty reflection", () => {
    const out = formatStoryAsAnswer(conflict);
    expect(out).toContain('"Defused a team standoff"');
    expect(out).toContain("Situation: Two senior engineers had stopped speaking");
    expect(out).toContain("Result: Shipped the release a week early");
    expect(out).not.toContain("Reflection:"); // empty → omitted

    const withReflection = formatStoryAsAnswer(story({ title: "X", reflection: "I now over-communicate early." }));
    expect(withReflection).toContain("Reflection: I now over-communicate early.");
  });
});
