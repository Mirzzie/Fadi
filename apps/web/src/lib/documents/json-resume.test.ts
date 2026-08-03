import { describe, expect, it } from "vitest";

import { fromJsonResume, parseJsonResume, toJsonResume } from "./json-resume";
import type { ResumeData } from "./resume";

const sample: ResumeData = {
  personal: {
    name: "Mirzad Ismail",
    headline: "TechOps Engineer",
    email: "m@gmail.com",
    phone: "+353 1 555",
    location: "Dublin, Ireland",
    links: "linkedin.com/in/mirzad · github.com/mirzad",
  },
  summary: "MSc Cybersecurity graduate with IT operations experience.",
  experiences: [
    { id: "a", title: "Junior DevOps Engineer", company: "Crozaint", location: "India", period: "01/2024 – 06/2024", bullets: "Cut deploy time 40%\nAutomated backups" },
  ],
  education: [{ id: "e", degree: "MSc, Cybersecurity", school: "Dublin City University", location: "Ireland", period: "2024 – 2025" }],
  certifications: [{ id: "c", name: "CompTIA Security+", issuer: "CompTIA", date: "2024" }],
  skills: "Cloud: AWS, Azure\nLanguages: Python, Bash",
  projects: [{ id: "p", title: "Home Lab", url: "https://lab.dev", description: "Self-hosted k8s cluster." }],
  order: ["summary", "experiences", "projects", "education", "certifications", "skills"],
};

describe("JSON Resume bridge", () => {
  it("maps ResumeData → JSON Resume", () => {
    const jr = toJsonResume(sample);
    expect(jr.basics?.name).toBe("Mirzad Ismail");
    expect(jr.basics?.location?.city).toBe("Dublin, Ireland");
    expect(jr.basics?.profiles?.map((p) => p.network)).toEqual(["LinkedIn", "GitHub"]);
    expect(jr.work?.[0]).toMatchObject({ name: "Crozaint", position: "Junior DevOps Engineer", startDate: "01/2024", endDate: "06/2024" });
    expect(jr.work?.[0]?.highlights).toEqual(["Cut deploy time 40%", "Automated backups"]);
    expect(jr.skills?.[0]).toMatchObject({ name: "Cloud", keywords: ["AWS", "Azure"] });
    expect(jr.meta?.careeros?.order).toEqual(sample.order);
  });

  it("round-trips meaningful content", () => {
    const back = fromJsonResume(toJsonResume(sample));
    expect(back.personal.name).toBe(sample.personal.name);
    expect(back.personal.location).toBe("Dublin, Ireland");
    expect(back.summary).toBe(sample.summary);
    expect(back.experiences[0].period).toBe("01/2024 – 06/2024");
    expect(back.experiences[0].bullets).toBe("Cut deploy time 40%\nAutomated backups");
    expect(back.skills).toBe("Cloud: AWS, Azure\nLanguages: Python, Bash");
    expect(back.order).toEqual(sample.order);
  });

  it("imports an external jsonresume.org-shaped file", () => {
    const ext = parseJsonResume(
      JSON.stringify({
        basics: { name: "Jane Doe", label: "Designer", location: { city: "Berlin", countryCode: "DE" } },
        work: [{ name: "Acme", position: "Designer", startDate: "2021-01", endDate: "2023-06", highlights: ["Shipped X"] }],
        skills: [{ name: "Design", keywords: ["Figma", "UX"] }],
      }),
    );
    const imported = fromJsonResume(ext);
    expect(imported.personal.name).toBe("Jane Doe");
    expect(imported.personal.location).toBe("Berlin, DE");
    expect(imported.experiences[0].period).toBe("2021-01 – 2023-06");
    expect(imported.skills).toBe("Design: Figma, UX");
    expect(imported.order).toHaveLength(6);
  });
});
