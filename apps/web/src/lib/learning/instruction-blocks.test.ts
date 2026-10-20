import { describe, expect, it } from "vitest";

import { parseInline, parseInstruction, stepScript } from "./instruction-blocks";

describe("finding the commands in a step", () => {
  it("THE REPORTED STEP: an indented command becomes a copyable block", () => {
    const step =
      "On your Linux laptop, open the default web browser with:\n\n    xdg-open https://developer.servicenow.com\n\nCreate a free Personal Developer account.";
    const blocks = parseInstruction(step);
    expect(blocks.map((b) => b.type)).toEqual(["text", "code", "text"]);
    const code = blocks[1];
    if (code.type === "code") expect(code.code).toBe("xdg-open https://developer.servicenow.com");
  });

  it("a fenced block keeps its language and its inner indentation", () => {
    const step =
      "Create the config:\n\n```nginx\nserver {\n    listen 443 ssl;\n}\n```\nThen reload.";
    const blocks = parseInstruction(step);
    const code = blocks.find((b) => b.type === "code");
    expect(code).toBeDefined();
    if (code?.type === "code") {
      expect(code.lang).toBe("nginx");
      // The nginx indentation is the config's own and must survive.
      expect(code.code).toBe("server {\n    listen 443 ssl;\n}");
    }
  });

  it("keeps a multi-line indented command together across a blank line", () => {
    const step = "Run:\n\n    apk update\n\n    apk add nginx\n\nDone.";
    const blocks = parseInstruction(step);
    const code = blocks.find((b) => b.type === "code");
    if (code?.type === "code") expect(code.code).toBe("apk update\n\napk add nginx");
  });

  it("THE STORED NGINX STEP: a heredoc body at column 0 stays inside its command block", () => {
    const step = [
      "Create a jail:",
      "",
      "    mkdir -p /etc/fail2ban/jail.d",
      "    cat > /etc/fail2ban/jail.d/nginx.conf <<'EOF'",
      "[nginx-http]",
      "enabled = true",
      "EOF",
      "    rc-service fail2ban start",
    ].join("\n");
    const blocks = parseInstruction(step);
    expect(blocks.map((b) => b.type)).toEqual(["text", "code"]);
    const code = blocks[1];
    if (code.type === "code") {
      expect(code.code).toBe(
        "mkdir -p /etc/fail2ban/jail.d\ncat > /etc/fail2ban/jail.d/nginx.conf <<'EOF'\n[nginx-http]\nenabled = true\nEOF\nrc-service fail2ban start"
      );
    }
  });

  it("THE STORED OPENSSL STEP: deeper-indented continuation lines stay in the command", () => {
    const step =
      'Generate a cert:\n\n    openssl req -newkey rsa:2048 \\\n        -x509 -days 365 \\\n        -subj "/CN=localhost"\n    ls -l /etc/nginx/ssl';
    const blocks = parseInstruction(step);
    expect(blocks.map((b) => b.type)).toEqual(["text", "code"]);
    const code = blocks[1];
    if (code.type === "code") {
      expect(code.code).toBe(
        'openssl req -newkey rsa:2048 \\\n    -x509 -days 365 \\\n    -subj "/CN=localhost"\nls -l /etc/nginx/ssl'
      );
    }
  });

  it("an unclosed fence does not swallow the rest of the step into nothing", () => {
    const blocks = parseInstruction("Run this:\n```sh\necho hi");
    const code = blocks.find((b) => b.type === "code");
    if (code?.type === "code") expect(code.code).toBe("echo hi");
  });

  it("plain prose with no commands stays one text block", () => {
    const blocks = parseInstruction("Log in with the admin credentials from the email.");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
  });
});

describe("inline marks", () => {
  it("renders **bold** as bold instead of literal asterisks", () => {
    // Reported: "click **Request Instance**" showed the asterisks.
    expect(parseInline("click **Request Instance** and wait")).toEqual([
      { type: "text", value: "click " },
      { type: "bold", value: "Request Instance" },
      { type: "text", value: " and wait" },
    ]);
  });

  it("marks `inline code`", () => {
    expect(parseInline("run `cat file.txt` now")[1]).toEqual({
      type: "code",
      value: "cat file.txt",
    });
  });

  it("never turns markup into HTML — a script tag is just characters", () => {
    const parts = parseInline("<script>alert(1)</script>");
    expect(parts).toEqual([{ type: "text", value: "<script>alert(1)</script>" }]);
  });
});

describe("a closing fence with the next sentence on the same line", () => {
  it("ends the command there and keeps the sentence as text (15 Oct 2026)", () => {
    const blocks = parseInstruction(
      [
        "In the lab machine, execute:",
        "```powershell",
        '$msi = "C:\\LabWazuh\\wazuh-agent.msi"',
        'Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn" -Wait',
        "```The `/qn` flag installs without UI.",
      ].join("\n")
    );
    expect(blocks.map((b) => b.type)).toEqual(["text", "code", "text"]);
    const code = blocks[1] as { type: "code"; code: string };
    expect(code.code).not.toContain("flag installs");
    expect(code.code.split("\n")).toHaveLength(2);
  });
});

describe("bare commands at the start of a line (16 Oct 2026)", () => {
  it("pulls the owner's step 3 apart: the sentence is text, the commands one script", () => {
    const blocks = parseInstruction(
      'In PowerShell run:\nInvoke-WebRequest -Uri "https://packages.wazuh.com/4.x/windows/wazuh-agent-4.14.9-1.msi" -OutFile "C:\\LabSetup\\wazuh-agent.msi"\nmsiexec.exe /i "C:\\LabSetup\\wazuh-agent.msi" /qn WAZUH_MANAGER="172.16.89.1"'
    );
    // One script: "Run in lab" stops at its first error, so the installer never runs after a
    // failed download — splitting it for the person to sequence by hand isn't needed.
    expect(blocks.map((b) => b.type)).toEqual(["text", "code"]);
    expect(blocks[1]).toMatchObject({ lang: "powershell" });
    const lines = (blocks[1] as { code: string }).code.split("\n");
    expect(lines[1]!.startsWith("msiexec.exe /i")).toBe(true);
  });

  it("keeps a here-string as one command, XML and all", () => {
    const blocks = parseInstruction(
      'Create a test directory and add an integrity rule:\nNew-Item -ItemType Directory -Force -Path "C:\\RansomTest"\n$conf = @"\n<ossec_config>\n  <syscheck>\n</ossec_config>\n"@\nAdd-Content -Path "C:\\x.conf" -Value $conf'
    );
    expect(blocks.map((b) => b.type)).toEqual(["text", "code"]);
    expect((blocks[1] as { code: string }).code).toContain('</ossec_config>\n"@\nAdd-Content');
  });

  it("leaves sentences alone", () => {
    for (const line of [
      "Open the Wazuh dashboard in your browser.",
      "Restart the agent and wait a minute.",
      "In PowerShell run:",
      "Wait until the agent shows Active.",
    ]) {
      expect(parseInstruction(line).map((b) => b.type)).toEqual(["text"]);
    }
  });

  it("keeps the owner's step 5 whole: foreach, comments and piped strings are the script", () => {
    const step5 = [
      "Run the following PowerShell script to create and encrypt 5 files and write a fake LSASS dump:",
      '$files = 1..5 | ForEach-Object { "C:\\RansomTest\\secret$_.txt" }',
      'foreach ($f in $files) { "Sensitive data $((Get-Random))" | Set-Content $f }',
      "foreach ($f in $files) { $bytes = [System.IO.File]::ReadAllBytes($f) }",
      "# fake credential dump",
      '"LSASS dump" | Set-Content "C:\\RansomTest\\lsass.dmp"',
    ].join("\n");
    expect(stepScript(step5)!.split("\n")).toHaveLength(5);
    expect(stepScript(step5)).toContain('"LSASS dump" | Set-Content');
  });

  it("ends a script at a sentence", () => {
    const blocks = parseInstruction(
      "Restart-Service WazuhSvc\nThen open the dashboard and look for the alert."
    );
    expect(blocks.map((b) => b.type)).toEqual(["code", "text"]);
  });
});
