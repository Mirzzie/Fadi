import { describe, expect, it } from "vitest";

import { checksSetupScript } from "./vmware-checks";

const KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample fadi-lab";

describe("the setup line for checks in the person's own Windows machine", () => {
  const script = checksSetupScript(KEY, ["172.16.89.1", "192.168.156.1"]);

  it("is one line, so nothing runs until the person presses Enter", () => {
    expect(script).not.toMatch(/[\r\n]/);
  });

  it("lets only Fadi's key in, and SSH only from this computer's VMware addresses", () => {
    expect(script).toContain(`$k='${KEY}'`);
    expect(script).toContain("administrators_authorized_keys");
    expect(script).toContain("-RemoteAddress 172.16.89.1,192.168.156.1");
    expect(script).not.toMatch(/-RemoteAddress Any|0\.0\.0\.0/);
  });

  it("is safe to run twice: each change checks first", () => {
    expect(script).toContain("Select-String -Path $f -SimpleMatch $k -Quiet");
    expect(script).toContain("Get-NetFirewallRule -Name fadi-ssh");
  });

  it("cannot be broken out of by a quote in the key", () => {
    expect(
      checksSetupScript("ssh-ed25519 AAAA' ; Remove-Item C:\\ -Recurse ; '", ["172.16.89.1"])
    ).not.toContain("' ; Remove-Item");
  });
});
