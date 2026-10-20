import { describe, expect, it } from "vitest";

import { linksIn, planQueries, rankSources, relevantExcerpt } from "./plan-research";

describe("planning from today's documentation", () => {
  it("looks up the project and each tool's install docs", () => {
    expect(
      planQueries({
        title: "Open-Source SIEM for an SME",
        labLabel: "Windows Server 2025",
        tools: ["Wazuh 4.14.9 agent Windows"],
      })
    ).toEqual([
      "Open-Source SIEM for an SME step by step guide Windows Server 2025",
      "Wazuh 4.14.9 agent Windows official documentation installation",
    ]);
  });

  it("prefers the vendor's documentation over blogs and video", () => {
    const ranked = rankSources(
      [
        { url: "https://medium.com/x/wazuh", title: "blog" },
        {
          url: "https://documentation.wazuh.com/current/installation-guide/wazuh-agent/",
          title: "docs",
        },
        { url: "https://www.youtube.com/watch?v=1", title: "video" },
      ] as never,
      ["documentation.wazuh.com"]
    );
    expect(ranked[0]!.url).toContain("documentation.wazuh.com");
    expect(ranked.at(-1)!.url).toMatch(/medium|youtube/);
  });

  it("finds every link a step mentions, without trailing punctuation", () => {
    expect(
      linksIn([
        'Invoke-WebRequest -Uri "https://packages.wazuh.com/4.x/windows/wazuh-agent-4.14.9-1.msi" -OutFile $msi',
        "See https://documentation.wazuh.com/current/index.html.",
      ])
    ).toEqual([
      "https://packages.wazuh.com/4.x/windows/wazuh-agent-4.14.9-1.msi",
      "https://documentation.wazuh.com/current/index.html",
    ]);
  });
});

describe("the part of a documentation page a plan needs", () => {
  it("keeps short command lines, like the one naming the Windows service", () => {
    const page = [
      ...Array.from({ length: 200 }, (_, i) => `Navigation item number ${i} with some words`),
      "Run the following command to install the agent:",
      '> msiexec.exe /i wazuh-agent-4.14.9-1.msi /q WAZUH_MANAGER="10.0.0.2"',
      "Start the service:",
      "> NET START WazuhSvc",
    ].join("\n");
    const excerpt = relevantExcerpt(page, 1500);
    expect(excerpt).toContain("NET START WazuhSvc");
    expect(excerpt).toContain("wazuh-agent-4.14.9-1.msi");
  });
});

describe("links that are names, not pages", () => {
  it("skips XML namespaces, however they are written", () => {
    expect(
      linksIn([
        '<Subscription xmlns="http://schemas.microsoft.com/2006/03/windows/events/subscription">',
        "Namespace: http://schemas.microsoft.com/win/2004/08/events/eventlog",
        '<svg xmlns="http://www.w3.org/2000/svg">',
        "Download https://packages.wazuh.com/4.x/windows/wazuh-agent-4.14.9-1.msi",
      ])
    ).toEqual(["https://packages.wazuh.com/4.x/windows/wazuh-agent-4.14.9-1.msi"]);
  });
});
