import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { connect } from "node:net";
import type { Duplex } from "node:stream";

import { logger } from "@/lib/observability/logger";

/**
 * A VMWARE MACHINE'S SCREEN, INSIDE THE PROJECT PAGE.
 *
 * VMware can share a VM's screen over VNC, a plain TCP protocol a browser cannot speak. The
 * browser speaks WebSocket. This is the smallest bridge between them: a WebSocket server on
 * this computer that forwards bytes to one VM's VNC port and back. The screen itself is drawn
 * by noVNC (`public/novnc`, `public/lab-screen.html`).
 *
 * Who can reach a screen through it, and why that is enough:
 * - It listens on 127.0.0.1 only, and each VM's VNC listens on 127.0.0.1 only.
 * - A connection needs a TICKET, issued by Fadi to the signed-in owner of a project whose
 *   machine it is, naming exactly one VM port. The bridge never takes a port from the browser.
 * - A ticket is single-use (Codex review, 15 Oct 2026: it was a 30-minute bearer token any
 *   local page could replay). Unclaimed, it dies in two minutes; the first connection claims
 *   it; when that connection closes it is spent. While the connection lives, Fadi hands out the
 *   same ticket, so the screen doesn't reload on every refresh; once spent, the next refresh
 *   brings a new one. Moving a project off its machine or starting it over revokes its tickets
 *   and closes the screen. Signing out closes the page, which spends it.
 * - The page must come from the exact origin the ticket was issued to (or, when that is
 *   unknown, from this computer), so a website in another tab can't connect with it.
 * - VMware still asks for the machine's own screen password.
 *
 * One bridge per Fadi process, kept on globalThis so a hot reload in development does not try
 * to open the port twice.
 */

export const SCREEN_BRIDGE_PORT = Number(process.env.FADI_SCREEN_BRIDGE_PORT) || 6089;
/** How long an issued ticket waits to be claimed by its one connection. */
const CLAIM_WINDOW_MS = 2 * 60_000;
const MAX_CONNECTIONS = 8;
const MAX_FRAME_PAYLOAD = 16 * 1024 * 1024;
const VNC_CONNECT_TIMEOUT_MS = 10_000;

type Ticket = {
  userId: string;
  vncPort: number;
  /** The project it was issued for: revoking a project's screen names this. */
  scope: string;
  /** The page origin it was issued to; null when it couldn't be known (then: this computer). */
  origin: string | null;
  claimBy: number;
  state: "unused" | "live" | "spent";
  /** Closes its live connection. */
  close: (() => void) | null;
};
type BridgeState = {
  server: Server | null;
  listening: boolean;
  tickets: Map<string, Ticket>;
  connections: number;
};

const state: BridgeState = ((
  globalThis as { __fadiScreenBridge?: BridgeState }
).__fadiScreenBridge ??= { server: null, listening: false, tickets: new Map(), connections: 0 });

/**
 * The ticket for this owner, project and VM port: the live one while its connection lasts, an
 * unclaimed one while it can still be claimed, otherwise a new one.
 */
export function screenTicket(
  input: { userId: string; vncPort: number; scope: string; origin: string | null },
  now = Date.now()
): string {
  for (const [token, ticket] of state.tickets) {
    if (ticket.state === "spent" || (ticket.state === "unused" && ticket.claimBy <= now)) {
      state.tickets.delete(token);
    } else if (
      ticket.userId === input.userId &&
      ticket.vncPort === input.vncPort &&
      ticket.scope === input.scope &&
      ticket.origin === input.origin &&
      (ticket.state === "live" || ticket.claimBy - now > 30_000)
    ) {
      return token;
    }
  }
  const token = randomBytes(24).toString("hex");
  state.tickets.set(token, {
    ...input,
    claimBy: now + CLAIM_WINDOW_MS,
    state: "unused",
    close: null,
  });
  return token;
}

/** Revoke an owner's screen tickets — for one project, or all — and close their screens. */
export function revokeScreenTickets(match: { userId: string; scope?: string }): number {
  let revoked = 0;
  for (const [token, ticket] of state.tickets) {
    if (ticket.userId !== match.userId || (match.scope && ticket.scope !== match.scope)) continue;
    ticket.close?.();
    state.tickets.delete(token);
    revoked += 1;
  }
  return revoked;
}

/** Start the bridge if it is not running. Resolves false when the port is held by something else. */
export function ensureScreenBridge(): Promise<boolean> {
  if (state.listening) return Promise.resolve(true);
  if (state.server)
    return new Promise((resolve) => state.server!.once("listening", () => resolve(true)));
  const server = createServer((_req, res) => {
    res.writeHead(426, { "content-type": "text/plain" }).end("WebSocket only.");
  });
  server.on("upgrade", (req, socket) => handleUpgrade(req, socket));
  state.server = server;
  return new Promise((resolve) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      logger.warn("lab.screen_bridge_unavailable", { code: error.code ?? "unknown" });
      state.server = null;
      resolve(false);
    });
    server.listen(SCREEN_BRIDGE_PORT, "127.0.0.1", () => {
      state.listening = true;
      resolve(true);
    });
  });
}

/** A page served from this computer — Fadi itself, on whatever port it runs. */
export function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function refuse(socket: Duplex, status: string) {
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
}

function handleUpgrade(req: IncomingMessage, socket: Duplex) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const token = url.searchParams.get("t") ?? "";
  const ticket = state.tickets.get(token);
  const key = req.headers["sec-websocket-key"];
  if (url.pathname !== "/screen" || typeof key !== "string")
    return refuse(socket, "400 Bad Request");
  if (!isLocalOrigin(req.headers.origin)) return refuse(socket, "403 Forbidden");
  // Single use: only an unclaimed ticket, inside its window, from the origin it was issued to.
  if (!ticket || ticket.state !== "unused" || ticket.claimBy <= Date.now()) {
    return refuse(socket, "401 Unauthorized");
  }
  if (ticket.origin && req.headers.origin !== ticket.origin) return refuse(socket, "403 Forbidden");
  if (state.connections >= MAX_CONNECTIONS) return refuse(socket, "503 Service Unavailable");

  const offered = String(req.headers["sec-websocket-protocol"] ?? "")
    .split(",")
    .map((p) => p.trim());
  const vnc = connect({ host: "127.0.0.1", port: ticket.vncPort });
  vnc.setTimeout(VNC_CONNECT_TIMEOUT_MS, () => close());
  state.connections += 1;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    state.connections -= 1;
    ticket.state = "spent";
    ticket.close = null;
    state.tickets.delete(token);
    vnc.destroy();
    socket.destroy();
  };
  ticket.state = "live";
  ticket.close = close;

  vnc.once("connect", () => {
    vnc.setTimeout(0);
    socket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${acceptKey(key)}`,
        ...(offered.includes("binary") ? ["Sec-WebSocket-Protocol: binary"] : []),
        "",
        "",
      ].join("\r\n")
    );
    const reader = new FrameReader();
    socket.on("data", (chunk: Buffer) => {
      let frames: Frame[];
      try {
        frames = reader.push(chunk);
      } catch {
        return close();
      }
      for (const frame of frames) {
        if (frame.opcode === 0x8) return close();
        if (frame.opcode === 0x9) socket.write(encodeFrame(frame.payload, 0xa));
        else if (frame.opcode === 0x1 || frame.opcode === 0x2) vnc.write(frame.payload);
      }
    });
    vnc.on("data", (chunk: Buffer) => socket.write(encodeFrame(chunk)));
  });
  vnc.on("error", () => close());
  vnc.on("close", () => close());
  socket.on("error", () => close());
  socket.on("close", () => close());
  // An upgraded socket is half-open: the page hanging up arrives as "end", and "close" only
  // follows once this side ends too — which it never did, so a left screen held its VNC
  // connection (and now its ticket) until the VM side closed.
  socket.on("end", () => close());
  vnc.on("end", () => close());
}

/* ── WebSocket framing (RFC 6455), the parts a VNC stream needs ───────────── */

export function acceptKey(key: string): string {
  return createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
}

/** A server frame: final, unmasked. */
export function encodeFrame(payload: Buffer, opcode = 0x2): Buffer {
  const length = payload.length;
  const head =
    length < 126
      ? Buffer.from([0x80 | opcode, length])
      : length < 65536
        ? Buffer.from([0x80 | opcode, 126, length >> 8, length & 0xff])
        : (() => {
            const b = Buffer.alloc(10);
            b[0] = 0x80 | opcode;
            b[1] = 127;
            b.writeBigUInt64BE(BigInt(length), 2);
            return b;
          })();
  return Buffer.concat([head, payload]);
}

export type Frame = { opcode: number; payload: Buffer };

/** Client frames, which arrive masked and possibly split across reads or fragmented. */
export class FrameReader {
  private buffer = Buffer.alloc(0);
  private fragments: Buffer[] = [];
  private fragmentBytes = 0;
  private fragmentOpcode = 0;

  push(chunk: Buffer): Frame[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const out: Frame[] = [];
    for (;;) {
      if (this.buffer.length < 2) break;
      const fin = (this.buffer[0]! & 0x80) !== 0;
      const opcode = this.buffer[0]! & 0x0f;
      const masked = (this.buffer[1]! & 0x80) !== 0;
      if (!masked) throw new Error("Client frames must be masked.");
      let length = this.buffer[1]! & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (this.buffer.length < 4) break;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) break;
        const big = this.buffer.readBigUInt64BE(2);
        if (big > BigInt(MAX_FRAME_PAYLOAD)) throw new Error("Frame too large.");
        length = Number(big);
        offset = 10;
      }
      if (this.buffer.length < offset + 4 + length) break;
      const mask = this.buffer.subarray(offset, offset + 4);
      const payload = Buffer.from(this.buffer.subarray(offset + 4, offset + 4 + length));
      for (let i = 0; i < payload.length; i++) payload[i]! ^= mask[i % 4]!;
      this.buffer = this.buffer.subarray(offset + 4 + length);

      if (opcode >= 0x8) {
        out.push({ opcode, payload });
      } else if (opcode === 0x0) {
        if (this.fragments.length === 0) throw new Error("Unexpected continuation frame.");
        this.fragmentBytes += payload.length;
        if (this.fragmentBytes > MAX_FRAME_PAYLOAD)
          throw new Error("Fragmented message too large.");
        this.fragments.push(payload);
        if (fin) {
          out.push({ opcode: this.fragmentOpcode, payload: Buffer.concat(this.fragments) });
          this.fragments = [];
          this.fragmentBytes = 0;
        }
      } else if (fin) {
        if (this.fragments.length > 0) throw new Error("Incomplete fragmented message.");
        out.push({ opcode, payload });
      } else {
        if (this.fragments.length > 0) throw new Error("Incomplete fragmented message.");
        this.fragmentOpcode = opcode;
        this.fragments = [payload];
        this.fragmentBytes = payload.length;
      }
    }
    return out;
  }
}
