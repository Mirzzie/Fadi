import { describe, expect, it } from "vitest";

import { placesBrief, placeViolations, usableCheck, type PlacesInput } from "./places";

const OBSERVED: PlacesInput = {
  labLabel: "Windows Server 2025",
  expectedOs: "Windows Server 2025",
  hostOs: "Linux",
  facts: {
    observed: true,
    os: "Microsoft Windows Server 2025 Standard Evaluation",
    build: "26100",
    shell: "powershell",
    shellVersion: "5.1.26100.7462",
    account: "docker",
    has: { winget: true, edge: true, chrome: false, git: false, docker: false },
    internet: true,
    reaches: { "wazuh.manager:1515": false },
  },
  services: [
    {
      label: "Wazuh dashboard",
      browserUrl: "https://127.0.0.1:5443",
      signIn: "admin / SecretPassword",
      fromLab: "wazuh.manager:1514/1515",
    },
  ],
};

describe("places: where each step happens", () => {
  it("tells the planner what the lab really has, and where the dashboard opens", () => {
    const brief = placesBrief(OBSERVED);
    expect(brief).toContain(
      "OBSERVED just now: Microsoft Windows Server 2025 Standard Evaluation (build 26100)"
    );
    expect(brief).toMatch(/NOT installed[^\n]*chrome/);
    expect(brief).toContain("Wazuh dashboard at https://127.0.0.1:5443");
    expect(brief).toContain("Inside the lab, 127.0.0.1 and localhost are the lab itself");
    expect(brief).toContain("From the lab, Wazuh dashboard is reached at wazuh.manager:1514/1515");
  });

  it("assumes only built-in tools when the lab could not be observed", () => {
    expect(placesBrief({ ...OBSERVED, facts: null })).toContain(
      "Assume a clean Windows Server 2025 with only its built-in tools: no Chrome"
    );
  });

  it("catches the owner's real failing step: Chrome in the lab, to the computer's dashboard", () => {
    const violations = placeViolations(
      [
        {
          title: "Start the external Wazuh containers",
          instruction: 'Start-Process "chrome.exe" "https://127.0.0.1:5443" -WindowStyle Normal',
          where: "lab",
        },
      ],
      OBSERVED
    );
    expect(violations).toEqual([
      "chrome in the lab, which is not installed there",
      expect.stringContaining("127.0.0.1:5443 in a lab step"),
    ]);
  });

  it("leaves a browser step alone, and allows installing a tool before using it", () => {
    expect(
      placeViolations(
        [
          {
            title: "Open the dashboard",
            instruction: "Open https://127.0.0.1:5443",
            where: "browser",
          },
          {
            title: "Get git",
            instruction: "winget install Git.Git; git clone https://x/y",
            where: "lab",
          },
        ],
        OBSERVED
      )
    ).toEqual([]);
  });
});

describe("a planned check Fadi can actually run", () => {
  it("keeps a self-contained check with literal expected text", () => {
    expect(
      usableCheck({
        command: "Get-Service -Name WazuhSvc | Select-Object -ExpandProperty Status",
        expect: "Running",
      })
    ).toEqual({
      command: "Get-Service -Name WazuhSvc | Select-Object -ExpandProperty Status",
      expect: "Running",
    });
    expect(usableCheck({ command: "$p = 'C:\\x'; Test-Path $p", expect: "True" })).not.toBeNull();
  });

  it("drops a comparison as expected text, and a variable the check never sets", () => {
    expect(
      usableCheck({ command: "Get-ChildItem C:\\x | Measure-Object", expect: ">=1" })
    ).toBeNull();
    expect(
      usableCheck({ command: "Select-String -Path $log -Pattern 'x'", expect: "x" })
    ).toBeNull();
    expect(usableCheck(null)).toBeNull();
  });
});
