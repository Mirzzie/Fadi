import { describe, expect, it } from "vitest";

import {
  placesBrief,
  placeViolations,
  stepCoherenceViolations,
  usableCheck,
  type PlacesInput,
} from "./places";

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

describe("a step that expects a service running must start it (16 Oct 2026)", () => {
  const step3 = {
    title: "Download and install Wazuh agent",
    instruction:
      'In PowerShell run:\nInvoke-WebRequest -Uri "https://packages.wazuh.com/4.x/windows/wazuh-agent-4.14.9-1.msi" -OutFile "C:\\LabSetup\\wazuh-agent.msi"\nmsiexec.exe /i "C:\\LabSetup\\wazuh-agent.msi" /qn WAZUH_MANAGER="172.16.89.1"',
    check: {
      command: "Get-Service WazuhSvc | Select-Object -ExpandProperty Status",
      expect: "Running",
    },
  };

  it("sends the owner's step 3 back: installed, checked for Running, never started", () => {
    expect(stepCoherenceViolations([step3])).toEqual([
      expect.stringContaining('add "Start-Service WazuhSvc"'),
    ]);
  });

  it("accepts it once the step starts the service", () => {
    const fixed = { ...step3, instruction: `${step3.instruction}\nStart-Service WazuhSvc` };
    expect(stepCoherenceViolations([fixed])).toEqual([]);
    const net = { ...step3, instruction: `${step3.instruction}\nnet start WazuhSvc` };
    expect(stepCoherenceViolations([net])).toEqual([]);
  });

  it("leaves steps alone that install nothing or don't expect Running", () => {
    expect(stepCoherenceViolations([{ ...step3, instruction: "Open the dashboard." }])).toEqual([]);
    expect(
      stepCoherenceViolations([
        { ...step3, check: { command: "Get-Service WazuhSvc", expect: "WazuhSvc" } },
      ])
    ).toEqual([]);
  });
});
