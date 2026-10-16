import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server, type Socket } from "node:net";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * "Type into lab", end to end in a real browser: the project page's lab-screen.html, through
 * Fadi's bridge, to a VNC server that records every key. The fake server stands in for VMware
 * so nothing is typed into anyone's real machine.
 *
 * Needs a running Fadi on :3000 (it serves lab-screen.html) and Chromium. FADI_TEST_BROWSER=1.
 */
const suite = process.env.FADI_TEST_BROWSER === "1" ? describe : describe.skip;

vi.hoisted(() => {
  process.env.FADI_SCREEN_BRIDGE_PORT = "6191";
});

const VNC_PORT = 5996;
const SHIFT = 0xffe1;

/** The smallest RFB 3.8 server noVNC will connect to: no auth, 800x600, records KeyEvents. */
function fakeVnc(keys: Array<{ down: boolean; keysym: number }>): Server {
  return createServer((socket: Socket) => {
    let stage = 0;
    let buffer = Buffer.alloc(0);
    socket.write("RFB 003.008\n");
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        if (stage === 0) {
          if (buffer.length < 12) return;
          buffer = buffer.subarray(12);
          socket.write(Buffer.from([1, 1])); // one security type: None
          stage = 1;
        } else if (stage === 1) {
          if (buffer.length < 1) return;
          buffer = buffer.subarray(1);
          socket.write(Buffer.from([0, 0, 0, 0])); // SecurityResult OK
          stage = 2;
        } else if (stage === 2) {
          if (buffer.length < 1) return;
          buffer = buffer.subarray(1); // ClientInit
          const name = Buffer.from("fake");
          const init = Buffer.alloc(24);
          init.writeUInt16BE(800, 0);
          init.writeUInt16BE(600, 2);
          Buffer.from([32, 24, 0, 1, 0, 255, 0, 255, 0, 255, 16, 8, 0, 0, 0, 0]).copy(init, 4);
          init.writeUInt32BE(name.length, 20);
          socket.write(Buffer.concat([init, name]));
          stage = 3;
        } else {
          if (buffer.length < 1) return;
          const type = buffer[0]!;
          const need =
            type === 0
              ? 20
              : type === 2
                ? buffer.length >= 4
                  ? 4 + 4 * buffer.readUInt16BE(2)
                  : Infinity
                : type === 3
                  ? 10
                  : type === 4
                    ? 8
                    : type === 5
                      ? 6
                      : type === 6
                        ? buffer.length >= 8
                          ? 8 + buffer.readUInt32BE(4)
                          : Infinity
                        : 1;
          if (buffer.length < need) return;
          if (type === 4) keys.push({ down: buffer[1] === 1, keysym: buffer.readUInt32BE(4) });
          buffer = buffer.subarray(need);
        }
      }
    });
  });
}

suite("typing a command into the lab's screen", () => {
  const keys: Array<{ down: boolean; keysym: number }> = [];
  let vnc: Server;
  let browser: ChildProcess;
  let send: (
    method: string,
    params?: object
  ) => Promise<{ result?: { result?: { value?: unknown } } }>;

  beforeAll(async () => {
    vnc = fakeVnc(keys);
    await new Promise<void>((resolve) => vnc.listen(VNC_PORT, "127.0.0.1", resolve));
    const { ensureScreenBridge, screenTicket } = await import("./vnc-bridge");
    expect(await ensureScreenBridge()).toBe(true);
    const ticket = screenTicket({ userId: "owner", vncPort: VNC_PORT, scope: "typing", origin: null });

    browser = spawn(
      "chromium",
      [
        "--headless=new",
        "--disable-gpu",
        "--remote-debugging-port=9334",
        "--user-data-dir=/tmp/claude-1000/cdp-typing",
        "about:blank",
      ],
      { stdio: "ignore" }
    );
    let targets: Array<{ type: string; webSocketDebuggerUrl: string }> = [];
    for (let i = 0; i < 40 && targets.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 250));
      targets = await fetch("http://127.0.0.1:9334/json")
        .then((r) => r.json())
        .catch(() => []);
    }
    const ws = new WebSocket(targets.find((t) => t.type === "page")!.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));
    let id = 0;
    const waiting = new Map<number, (value: never) => void>();
    ws.onmessage = (m) => {
      const data = JSON.parse(String(m.data));
      waiting.get(data.id)?.(data as never);
    };
    send = (method, params = {}) =>
      new Promise((resolve) => {
        waiting.set(++id, resolve as never);
        ws.send(JSON.stringify({ id, method, params }));
      });
    await send("Page.navigate", {
      url: `http://localhost:3000/lab-screen.html#port=6191&t=${ticket}&p=x`,
    });
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const r = await send("Runtime.evaluate", {
        expression: "document.getElementById('status').hidden",
        returnByValue: true,
      });
      if (r.result?.result?.value === true) break;
    }
  }, 30_000);

  afterAll(() => {
    browser?.kill();
    vnc?.close();
  });

  it("types the command exactly, shifted where a US keyboard needs it, and does not press Enter", async () => {
    const command = 'Get-ChildItem C:\\LabWazuh | Select "Name"';
    await send("Runtime.evaluate", {
      expression: `window.postMessage({ type: "fadi-type", text: ${JSON.stringify(command + "\n")} }, location.origin)`,
    });
    await new Promise((r) => setTimeout(r, 2000));

    // Rebuild the text from the presses (ignoring Shift itself), and check Shift wrapped each
    // character that needs it.
    const presses = keys.filter((k) => k.down && k.keysym !== SHIFT);
    expect(String.fromCharCode(...presses.map((k) => k.keysym))).toBe(command);
    expect(presses.some((k) => k.keysym === 0xff0d)).toBe(false); // no Enter at the end
    const shiftedG = keys.findIndex((k) => k.down && k.keysym === "G".charCodeAt(0));
    expect(keys[shiftedG - 1]).toEqual({ down: true, keysym: SHIFT });
    const colon = keys.findIndex((k) => k.down && k.keysym === ":".charCodeAt(0));
    expect(keys[colon - 1]).toEqual({ down: true, keysym: SHIFT });
    const backslash = keys.findIndex((k) => k.down && k.keysym === "\\".charCodeAt(0));
    // No Shift held for a backslash (the event before it is the colon's Shift being released).
    expect(keys[backslash - 1]).not.toEqual({ down: true, keysym: SHIFT });
  }, 20_000);

  it("types a repeated request only once while it is still typing (a double press)", async () => {
    keys.length = 0;
    const text = "abcdefghijklmnopqrstuvwxyz0123456789";
    await send("Runtime.evaluate", {
      expression: `for (let i = 0; i < 3; i++) window.postMessage({ type: "fadi-type", text: ${JSON.stringify(text)} }, location.origin)`,
    });
    await new Promise((r) => setTimeout(r, 2500));
    const typed = String.fromCharCode(
      ...keys.filter((k) => k.down && k.keysym !== SHIFT).map((k) => k.keysym)
    );
    expect(typed).toBe(text);
  }, 20_000);

  it("has no buttons of its own on the screen — nothing there can take the keyboard", async () => {
    const r = await send("Runtime.evaluate", {
      expression: "document.querySelectorAll('button').length",
      returnByValue: true,
    });
    expect(r.result?.result?.value).toBe(0);
  });

  it("reports the machine's resolution so the panel takes its shape", async () => {
    const r = await send("Runtime.evaluate", {
      expression:
        "(() => { const c = document.querySelector('#screen canvas'); return c.width + 'x' + c.height })()",
      returnByValue: true,
    });
    expect(r.result?.result?.value).toBe("800x600");
  });
});
