import { describe, expect, it } from "vitest";

import {
  powershellCheck,
  powershellRemote,
  powershellRunThenCheck,
  readablePowershell,
  shRunThenCheck,
} from "./windows-shell";

const decode = (command: string) =>
  Buffer.from(command.split(" -EncodedCommand ")[1]!, "base64").toString("utf16le");

describe("commands to a Windows machine", () => {
  it("start PowerShell explicitly, whatever the machine's default shell", () => {
    const command = powershellRemote("Get-Service WazuhSvc");
    expect(command.startsWith("powershell.exe -NoProfile -NonInteractive")).toBe(true);
    expect(command).not.toContain("Get-Service");
    expect(decode(command)).toContain("Get-Service WazuhSvc");
  });

  it("carry quotes and semicolons inside the encoding, never to cmd.exe", () => {
    const command = powershellCheck(
      `Get-Content "C:\\Program Files (x86)\\ossec-agent\\ossec.conf" | Select-String '<address>'`,
      "FADI_CHECK"
    );
    expect(command).toMatch(/^[\w.\s-]+ -EncodedCommand [A-Za-z0-9+/=]+$/);
    expect(decode(command)).toContain('Write-Output "FADI_CHECK=0"');
  });

  it("refuse a script too long for cmd.exe", () => {
    expect(() => powershellRemote("x".repeat(4000))).toThrow(/too long/);
  });

  it("show the person the script they approve, not the encoding", () => {
    expect(readablePowershell(powershellRemote("Get-Service WazuhSvc"))).toBe(
      "powershell: Get-Service WazuhSvc"
    );
    expect(readablePowershell("-p")).toBe("-p");
  });
});

describe("Run in lab: the step's script, then its check", () => {
  it("stops at the first error and only checks after a clean run", () => {
    const body = powershellRunThenCheck(
      "Invoke-WebRequest x\nmsiexec /i y",
      "Get-Service WazuhSvc"
    );
    expect(body).toContain("$ErrorActionPreference = 'Stop'; Invoke-WebRequest x\nmsiexec /i y");
    expect(body).toMatch(
      /if \(\$fadiRunOk\) \{ Write-Output "FADI_RUN=0"; Get-Service WazuhSvc \}/
    );
  });

  it("does the same in sh", () => {
    const body = shRunThenCheck("apt-get install -y x", "systemctl is-active x");
    expect(body.startsWith("( set -e\napt-get install -y x\n)")).toBe(true);
    expect(body).toContain("then\nsystemctl is-active x\nelse\nfalse\nfi");
  });
});
