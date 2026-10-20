import { connect, createServer, type Server } from "node:net";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Its own port, so the test never meets a bridge a running Fadi already holds.
vi.hoisted(() => {
  process.env.FADI_SCREEN_BRIDGE_PORT = "6189";
});

import {
  acceptKey,
  encodeFrame,
  ensureScreenBridge,
  FrameReader,
  isLocalOrigin,
  SCREEN_BRIDGE_PORT,
  revokeScreenTickets,
  screenTicket,
} from "./vnc-bridge";

/** A client frame, masked as a browser sends it. */
function clientFrame(payload: Buffer, opcode = 0x2, fin = true): Buffer {
  const mask = Buffer.from([1, 2, 3, 4]);
  const masked = Buffer.from(payload.map((byte, i) => byte ^ mask[i % 4]!));
  const head =
    payload.length < 126
      ? Buffer.from([(fin ? 0x80 : 0) | opcode, 0x80 | payload.length])
      : Buffer.from([
          (fin ? 0x80 : 0) | opcode,
          0x80 | 126,
          payload.length >> 8,
          payload.length & 0xff,
        ]);
  return Buffer.concat([head, mask, masked]);
}

describe("WebSocket framing", () => {
  it("answers the handshake the way RFC 6455 specifies", () => {
    expect(acceptKey("dGhlIHNhbXBsZSBub25jZQ==")).toBe("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
  });

  it("unmasks frames, including ones split across reads and long ones", () => {
    const reader = new FrameReader();
    const long = Buffer.alloc(300, 7);
    const both = Buffer.concat([clientFrame(Buffer.from("RFB")), clientFrame(long)]);
    expect(reader.push(both.subarray(0, 5))).toEqual([]);
    const frames = reader.push(both.subarray(5));
    expect(frames.map((f) => f.payload.toString("latin1").slice(0, 3))).toEqual([
      "RFB",
      "\x07\x07\x07",
    ]);
    expect(frames[1]!.payload.length).toBe(300);
  });

  it("joins a fragmented message", () => {
    const reader = new FrameReader();
    const frames = reader.push(
      Buffer.concat([
        clientFrame(Buffer.from("ab"), 0x2, false),
        clientFrame(Buffer.from("cd"), 0x0, true),
      ])
    );
    expect(frames).toEqual([{ opcode: 0x2, payload: Buffer.from("abcd") }]);
  });

  it("rejects invalid and unbounded fragmented messages", () => {
    expect(() => new FrameReader().push(clientFrame(Buffer.from("orphan"), 0x0))).toThrow(
      /continuation/i
    );

    const reader = new FrameReader();
    reader.push(clientFrame(Buffer.alloc(65_535), 0x2, false));
    for (let i = 0; i < 255; i += 1) {
      reader.push(clientFrame(Buffer.alloc(65_535), 0x0, false));
    }
    expect(() => reader.push(clientFrame(Buffer.alloc(65_535), 0x0, false))).toThrow(/too large/i);
  });

  it("refuses unmasked client frames", () => {
    expect(() => new FrameReader().push(Buffer.from([0x82, 0x01, 0x41]))).toThrow();
  });

  it("encodes server frames of every length class", () => {
    expect(encodeFrame(Buffer.from("x")).subarray(0, 2)).toEqual(Buffer.from([0x82, 1]));
    expect(encodeFrame(Buffer.alloc(200))[1]).toBe(126);
    expect(encodeFrame(Buffer.alloc(70000))[1]).toBe(127);
  });
});

describe("who may connect", () => {
  it("only pages served from this computer", () => {
    expect(isLocalOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalOrigin("https://evil.example")).toBe(false);
    expect(isLocalOrigin(undefined)).toBe(false);
  });

  const t = (userId: string, vncPort: number, scope = "run-1", origin: string | null = null) =>
    screenTicket({ userId, vncPort, scope, origin });

  it("reuses an unclaimed ticket for the same owner, project, machine and page — nothing else", () => {
    const a = t("user-a", 5931);
    expect(t("user-a", 5931)).toBe(a);
    expect(t("user-b", 5931)).not.toBe(a);
    expect(t("user-a", 5932)).not.toBe(a);
    expect(t("user-a", 5931, "run-2")).not.toBe(a);
    expect(t("user-a", 5931, "run-1", "http://localhost:3000")).not.toBe(a);
  });

  it("forgets an unclaimed ticket after its two-minute window", () => {
    const now = Date.now();
    const a = screenTicket({ userId: "u", vncPort: 5933, scope: "r", origin: null }, now);
    const later = screenTicket({ userId: "u", vncPort: 5933, scope: "r", origin: null }, now + 3 * 60_000);
    expect(later).not.toBe(a);
  });
});

/** End to end: a fake VNC server behind the real bridge. */
describe("the bridge", () => {
  let vnc: Server;
  const VNC_PORT = 5997;

  beforeAll(async () => {
    vnc = createServer((socket) => {
      socket.write("RFB 003.008\n");
      socket.on("data", (data) => socket.write(Buffer.concat([Buffer.from("echo:"), data])));
    });
    await new Promise<void>((resolve) => vnc.listen(VNC_PORT, "127.0.0.1", resolve));
    expect(await ensureScreenBridge()).toBe(true);
  });

  afterAll(() => vnc.close());

  const open = (ticket: string, origin: string) =>
    new Promise<{ status: string; data: Buffer; send: (b: Buffer) => void; end: () => void }>(
      (resolve) => {
        const socket = connect(SCREEN_BRIDGE_PORT, "127.0.0.1", () => {
          socket.write(
            [
              `GET /screen?t=${ticket} HTTP/1.1`,
              `Host: 127.0.0.1:${SCREEN_BRIDGE_PORT}`,
              "Upgrade: websocket",
              "Connection: Upgrade",
              "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
              "Sec-WebSocket-Version: 13",
              "Sec-WebSocket-Protocol: binary",
              `Origin: ${origin}`,
              "",
              "",
            ].join("\r\n")
          );
        });
        let data = Buffer.alloc(0);
        socket.on("data", (chunk) => {
          data = Buffer.concat([data, chunk]);
          const text = data.toString("latin1");
          if (
            text.includes("\r\n\r\n") &&
            (!text.startsWith("HTTP/1.1 101") || text.includes("RFB"))
          ) {
            resolve({
              status: text.split("\r\n")[0]!,
              data,
              send: (b) => socket.write(clientFrame(b)),
              end: () => socket.destroy(),
            });
          }
        });
      }
    );

  const ticket = (scope: string, origin: string | null = "http://localhost:3000") =>
    screenTicket({ userId: "owner", vncPort: VNC_PORT, scope, origin });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 400));

  it("carries the VM's screen both ways for a valid ticket from its page", async () => {
    const conn = await open(ticket("carry"), "http://localhost:3000");
    expect(conn.status).toBe("HTTP/1.1 101 Switching Protocols");
    expect(conn.data.toString("latin1")).toContain("RFB 003.008");
    conn.end();
  });

  it("refuses a made-up ticket and a page from another site", async () => {
    expect((await open("not-a-ticket", "http://localhost:3000")).status).toBe(
      "HTTP/1.1 401 Unauthorized"
    );
    expect((await open(ticket("evil"), "https://evil.example")).status).toBe(
      "HTTP/1.1 403 Forbidden"
    );
  });

  it("refuses another local page than the one the ticket was issued to", async () => {
    expect((await open(ticket("other-port"), "http://localhost:4000")).status).toBe(
      "HTTP/1.1 403 Forbidden"
    );
  });

  it("SINGLE USE: a second connection is refused; while the first lives, the page keeps its ticket; once it closes, it is spent", async () => {
    const token = ticket("once");
    const first = await open(token, "http://localhost:3000");
    expect(first.status).toBe("HTTP/1.1 101 Switching Protocols");
    expect((await open(token, "http://localhost:3000")).status).toBe("HTTP/1.1 401 Unauthorized");
    expect(ticket("once")).toBe(token); // the screen doesn't reload while it's connected
    first.end();
    await settle();
    expect((await open(token, "http://localhost:3000")).status).toBe("HTTP/1.1 401 Unauthorized");
    expect(ticket("once")).not.toBe(token);
  });

  it("revoking a project's screen closes it and kills its ticket", async () => {
    const token = ticket("moved");
    const live = await open(token, "http://localhost:3000");
    expect(live.status).toBe("HTTP/1.1 101 Switching Protocols");
    expect(revokeScreenTickets({ userId: "owner", scope: "moved" })).toBe(1);
    await settle();
    expect(ticket("moved")).not.toBe(token);
    expect(revokeScreenTickets({ userId: "someone-else", scope: "moved" })).toBe(0);
  });
});
