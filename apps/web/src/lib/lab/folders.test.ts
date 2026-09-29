import { describe, expect, it } from "vitest";

import { missingFolders, withFoldersCreated } from "./host-and-lab";

// The owner's plan, 29 Sep 2026: step 2 wrote into C:\LabSetup, which nothing had created.
const owners = [
  {
    instruction: "Open the lab and sign in.",
    verify: "A screenshot saved as C:\\LabSetup\\01_VM_Desktop.png",
  },
  {
    instruction:
      "Install-WindowsFeature -Name AD-Domain-Services -IncludeManagementTools -Verbose | Out-File C:\\LabSetup\\02_ADDS_Install.log -Encoding utf8",
    verify: 'The file contains "Success".',
  },
  { instruction: "Get-ADForest | Out-File C:\\LabSetup\\03_forest.txt" },
];

describe("folders a plan writes into", () => {
  it("finds the first step that writes into a folder nothing created", () => {
    expect(missingFolders(owners, "windows")).toEqual([{ step: 1, dir: "C:\\LabSetup" }]);
  });

  it("repairs the plan by creating the folder at that step, once", () => {
    const fixed = withFoldersCreated(owners, "windows");
    expect(fixed[1]!.instruction.startsWith("First create the folder")).toBe(true);
    expect(fixed[1]!.instruction).toContain(
      'New-Item -ItemType Directory -Force -Path "C:\\LabSetup"'
    );
    expect(fixed[2]!.instruction).toBe(owners[2]!.instruction);
    expect(missingFolders(fixed, "windows")).toEqual([]);
  });

  it("leaves a plan alone when an earlier step made the folder, or a deeper one with -Force", () => {
    const made = [
      { instruction: 'New-Item -ItemType Directory -Force -Path "C:\\LabSetup\\logs"' },
      owners[1]!,
    ];
    expect(missingFolders(made, "windows")).toEqual([]);
  });

  it("does not ask for folders a fresh machine already has", () => {
    expect(
      missingFolders(
        [{ instruction: "Get-Service | Out-File C:\\Users\\Docker\\svc.txt" }],
        "windows"
      )
    ).toEqual([]);
    expect(
      missingFolders([{ instruction: "echo hi > /etc/motd && ls > /tmp/x/list" }], "linux")
    ).toEqual([]);
  });

  it("repairs a Linux plan with mkdir -p", () => {
    const fixed = withFoldersCreated(
      [{ instruction: "nmap -sV host > /lab/scans/out.txt" }],
      "linux"
    );
    expect(fixed[0]!.instruction).toContain("mkdir -p /lab/scans");
  });
});
