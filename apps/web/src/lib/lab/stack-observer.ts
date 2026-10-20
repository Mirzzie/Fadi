import { execFile } from "node:child_process";
import { createConnection } from "node:net";
import { promisify } from "node:util";

import { STACKS, type StackKey } from "./stacks";

/**
 * Is a project's stack up? Docker Compose says which containers run; the stack is "up" only
 * when every one of its services runs AND the place the person opens answers. A dashboard
 * container that is running but still starting its web server is "starting", not "up".
 */

const run = promisify(execFile);

export type StackState = {
  state: "absent" | "starting" | "running" | "stopped" | "partial";
  running: number;
  total: number;
  /** The dashboard (or equivalent) answers on this computer. */
  reachable: boolean;
};

type PsRow = { Service?: string; State?: string };

/** `docker compose ps --format json`: one object per line (Compose 2.21+) or one array (older). */
export function parsePs(stdout: string): PsRow[] {
  const text = stdout.trim();
  if (!text) return [];
  if (text.startsWith("[")) return JSON.parse(text) as PsRow[];
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PsRow);
}

export function summariseStack(rows: PsRow[], services: string[], reachable: boolean): StackState {
  const total = services.length;
  if (rows.length === 0) return { state: "absent", running: 0, total, reachable: false };
  const running = services.filter((service) =>
    rows.some((row) => row.Service === service && row.State === "running")
  ).length;
  if (running === 0) return { state: "stopped", running, total, reachable: false };
  if (running < total) return { state: "partial", running, total, reachable };
  return { state: reachable ? "running" : "starting", running, total, reachable };
}

async function portAnswers(url: string): Promise<boolean> {
  const { hostname, port } = new URL(url);
  if (!port && !url.startsWith("https:")) return false;
  return new Promise((resolve) => {
    const socket = createConnection({ host: hostname, port: Number(port) || 443 });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(700);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export async function observeStack(project: string, key: StackKey): Promise<StackState | null> {
  const stack = STACKS[key];
  try {
    const { stdout } = await run(
      "docker",
      ["compose", "-p", project, "ps", "--all", "--format", "json"],
      {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      }
    );
    // Up means usable: the dashboard answers here AND the first agent port answers where the
    // lab machine connects. The manager was "running" before its agent service listened.
    const { vmNetworkAddress } = await import("./stacks");
    const [dashboard, agents] = await Promise.all([
      portAnswers(stack.open.url),
      portAnswers(`tcp://${vmNetworkAddress()}:${stack.agentPorts[0]}`),
    ]);
    return summariseStack(parsePs(stdout), stack.services, dashboard && agents);
  } catch {
    return null; // Docker not answering: say so, rather than "absent"
  }
}
