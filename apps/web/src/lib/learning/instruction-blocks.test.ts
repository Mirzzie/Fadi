import { describe, expect, it } from "vitest";

import { parseInline, parseInstruction } from "./instruction-blocks";

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
    const step = "Create the config:\n\n```nginx\nserver {\n    listen 443 ssl;\n}\n```\nThen reload.";
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
        "mkdir -p /etc/fail2ban/jail.d\ncat > /etc/fail2ban/jail.d/nginx.conf <<'EOF'\n[nginx-http]\nenabled = true\nEOF\nrc-service fail2ban start",
      );
    }
  });

  it("THE STORED OPENSSL STEP: deeper-indented continuation lines stay in the command", () => {
    const step = "Generate a cert:\n\n    openssl req -newkey rsa:2048 \\\n        -x509 -days 365 \\\n        -subj \"/CN=localhost\"\n    ls -l /etc/nginx/ssl";
    const blocks = parseInstruction(step);
    expect(blocks.map((b) => b.type)).toEqual(["text", "code"]);
    const code = blocks[1];
    if (code.type === "code") {
      expect(code.code).toBe(
        'openssl req -newkey rsa:2048 \\\n    -x509 -days 365 \\\n    -subj "/CN=localhost"\nls -l /etc/nginx/ssl',
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
    expect(parseInline("run `cat file.txt` now")[1]).toEqual({ type: "code", value: "cat file.txt" });
  });

  it("never turns markup into HTML — a script tag is just characters", () => {
    const parts = parseInline("<script>alert(1)</script>");
    expect(parts).toEqual([{ type: "text", value: "<script>alert(1)</script>" }]);
  });
});
