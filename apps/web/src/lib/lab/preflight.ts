import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * WHAT WILL ACTUALLY CHANGE.
 *
 * Approving a description is not approving an effect. "Start nginx" reads identically
 * whether the image is sitting on disk or about to come down a metered connection,
 * whether the name is free or already taken by something the user is relying on. The
 * summary cannot know any of that. The machine can, and it costs one read to ask.
 *
 * This is the control the pre-action-authorisation literature calls dry-run simulation,
 * and it is the one that catches the proposal whose *parameters* are perfectly valid and
 * whose *effect* is not what anybody wanted.
 *
 * THREE RULES:
 *
 *   1. READ-ONLY, always. Preflight runs without approval — it is what makes approval
 *      informed — so it must never be able to change anything. Fixed argv, no shell, and
 *      only inspection verbs.
 *   2. NEVER GUESS. If a check cannot run, the note says so. "Fadi couldn't tell whether
 *      this file exists" is useful; silence reads as "nothing to worry about", which is a
 *      claim nobody made.
 *   3. NEVER BLOCK. A failed check is a missing note, not a refused proposal. The
 *      machine being unhelpful is not grounds to stop the user doing what they asked for.
 */

export type PreflightNote = {
  /** info — worth knowing. warn — you probably want to read this before approving. */
  kind: "info" | "warn" | "unknown";
  text: string;
};

/**
 * Has the situation changed since the person read it?
 *
 * Codex's correction to the first design, and it was right: a short expiry threw away the
 * user's DECISION because the CHECK went stale. Those are different things. The proposal
 * can survive; what cannot survive is approving an effect that is no longer the effect
 * that was described.
 *
 * Material means A WARNING THAT IS THERE NOW AND WAS NOT THERE THEN. A warning that
 * disappeared is not material — "this will download the image" becoming "the image is
 * already here" is the world getting better, and forcing a re-approval for it would train
 * people to click through re-approvals.
 */
export function materialChanges(before: PreflightNote[], after: PreflightNote[]): PreflightNote[] {
  const seen = new Set(before.filter((n) => n.kind === "warn").map((n) => n.text));
  return after.filter((n) => n.kind === "warn" && !seen.has(n.text));
}

async function quiet(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run(cmd, args, { timeout: 5000, maxBuffer: 128 * 1024 });
    return stdout.trim();
  } catch {
    return null;
  }
}

const NAME_PREFIX = "fadi-";

async function containerExists(name: string): Promise<boolean | null> {
  const out = await quiet("docker", ["ps", "-a", "--filter", "name=^" + name + "$", "--format", "{{.Names}}"]);
  return out === null ? null : out.split("\n").includes(name);
}

async function containerRunning(name: string): Promise<boolean | null> {
  const out = await quiet("docker", ["ps", "--filter", "name=^" + name + "$", "--format", "{{.Names}}"]);
  return out === null ? null : out.split("\n").includes(name);
}

async function imagePresent(image: string): Promise<boolean | null> {
  const out = await quiet("docker", ["images", "-q", image]);
  return out === null ? null : out.length > 0;
}

/** Ports already published by any container, so a clash is caught before it happens. */
async function portTaken(port: number): Promise<boolean | null> {
  const out = await quiet("docker", ["ps", "--format", "{{.Ports}}"]);
  if (out === null) return null;
  return out.split("\n").some((line) => line.includes(":" + port + "->"));
}

export async function preflightFor(input: {
  userId: string;
  recipe: string;
  params: Record<string, unknown>;
}): Promise<PreflightNote[]> {
  const notes: PreflightNote[] = [];

  try {
    if (input.recipe === "container.run") {
      const name = NAME_PREFIX + String(input.params.name);
      const image = String(input.params.image);

      const exists = await containerExists(name);
      if (exists === null) {
        notes.push({ kind: "unknown", text: "Couldn't reach Docker to check anything below." });
        return notes;
      }
      if (exists) {
        // The failure this catches: docker refuses a duplicate name, so the whole action
        // would fail after approval. Better to know now than to approve a no-op.
        notes.push({
          kind: "warn",
          text: "A container called " + name + " already exists. This will fail unless you remove it first.",
        });
      }

      const pulled = await imagePresent(image);
      if (pulled === false) {
        notes.push({
          kind: "warn",
          text: "That image isn't on this machine yet — approving will download it, which needs a connection and some disk.",
        });
      } else if (pulled === true) {
        notes.push({ kind: "info", text: "The image is already here, so nothing will be downloaded." });
      }

      const port = input.params.port;
      if (typeof port === "number") {
        const taken = await portTaken(port);
        if (taken) {
          notes.push({
            kind: "warn",
            text: "Port " + port + " is already published by another container. This will fail.",
          });
        }
      }
      return notes;
    }

    if (input.recipe === "container.stop" || input.recipe === "container.remove") {
      const name = NAME_PREFIX + String(input.params.name);
      const running = await containerRunning(name);
      if (running === null) {
        notes.push({ kind: "unknown", text: "Couldn't reach Docker to check whether it is running." });
      } else if (!running) {
        notes.push({ kind: "info", text: name + " isn't running right now." });
      } else {
        notes.push({
          kind: "warn",
          text: name + " is running. Whatever is using it will stop working.",
        });
      }
      return notes;
    }

    if (input.recipe === "file.write" || input.recipe === "file.remove" || input.recipe === "dir.create") {
      const { createLabSettingsRepository } = await import("@careeros/database");
      const { getDatabase } = await import("@/lib/database/client");
      const { resolveInWorkspace } = await import("./workspace");
      const fs = await import("node:fs/promises");

      const root = await createLabSettingsRepository(getDatabase()).workspaceRoot(input.userId);
      const resolved = await resolveInWorkspace(root, String(input.params.path));
      if (!resolved.ok) {
        notes.push({ kind: "warn", text: resolved.reason });
        return notes;
      }

      let stat: Awaited<ReturnType<typeof fs.stat>> | null = null;
      try {
        stat = await fs.stat(resolved.path);
      } catch {
        stat = null;
      }

      if (input.recipe === "file.write") {
        notes.push(
          stat
            ? {
                // The single most useful thing preflight can say: this is not a new file.
                kind: "warn",
                text:
                  "That file already exists (" +
                  stat.size +
                  " bytes). It will be replaced, and the current version kept alongside it as a .fadi-bak file.",
              }
            : { kind: "info", text: "That file doesn't exist yet — this creates it." },
        );
      } else if (input.recipe === "file.remove") {
        notes.push(
          stat
            ? { kind: "warn", text: "This deletes " + stat.size + " bytes. No copy is kept." }
            : { kind: "info", text: "There's nothing at that path — this will do nothing." },
        );
      } else {
        notes.push(
          stat
            ? { kind: "info", text: "That folder already exists — this will do nothing." }
            : { kind: "info", text: "This creates a new empty folder." },
        );
      }
      return notes;
    }

    if (input.recipe === "lab.start") {
      const { LAB_TEMPLATES, isTemplateKey } = await import("./templates");
      const key = String(input.params.template);
      if (!isTemplateKey(key)) return [{ kind: "unknown", text: "Unknown lab template." }];
      const t = LAB_TEMPLATES[key];

      // THE CHECK THAT MAKES THIS A LAB ENGINE RATHER THAN A LAUNCHER.
      //
      // Starting a 4GB Windows VM on a laptop with 4GB free is not a failure the person
      // finds out about in an error message — it is an hour of thrashing, a swap storm and
      // a machine they cannot use while it happens. The numbers are knowable beforehand, so
      // they are said beforehand.
      const os = await import("node:os");
      const totalMb = Math.round(os.totalmem() / (1024 * 1024));
      const freeMb = Math.round(os.freemem() / (1024 * 1024));
      const { formatMemory } = await import("./sizes");
      const gb = formatMemory;

      // TWO DIFFERENT QUESTIONS, and the first version conflated them.
      //
      //   "Can this machine do it?"   — total memory. A property of the hardware.
      //   "Is now a good moment?"     — free memory. A property of what is open.
      //
      // Reporting 4GB free on a 24GB laptop as though it were a limit tells the owner
      // their machine is too small when it is nothing of the kind — the answer is to close
      // something, not to buy a computer. Only the first is a reason not to try.
      if (totalMb < t.ramMb + 1024) {
        notes.push({
          kind: "warn",
          text:
            "This machine has " +
            gb(totalMb) +
            " in total and this needs " +
            gb(t.ramMb) +
            ". There isn't room for it here even with everything closed — it wants a bigger host.",
        });
      } else if (freeMb < t.ramMb) {
        notes.push({
          kind: "warn",
          text:
            "Not right now: " +
            gb(freeMb) +
            " is free and this needs " +
            gb(t.ramMb) +
            ". The machine has " +
            gb(totalMb) +
            ", so closing a few things is enough — starting it as things stand would push into swap.",
        });
      } else if (freeMb - t.ramMb < 1024) {
        notes.push({
          kind: "warn",
          text:
            "That leaves under a gigabyte spare (" +
            gb(freeMb) +
            " free of " +
            gb(totalMb) +
            ", " +
            gb(t.ramMb) +
            " needed). It will run, but the machine will feel slow while it does.",
        });
      } else {
        notes.push({
          kind: "info",
          text: gb(freeMb) + " free of " + gb(totalMb) + ", and this needs " + gb(t.ramMb) + ".",
        });
      }

      // DISK, which the first version simply did not check — and a Windows template that
      // wants 40GB on a disk with 41GB free is the exact case where silence is worst: it
      // downloads for twenty minutes and then fills the machine.
      try {
        const fsp = await import("node:fs/promises");
        const stat = await fsp.statfs(os.homedir());
        const freeGb = Math.round((stat.bsize * stat.bavail) / 1024 ** 3);
        if (freeGb < t.diskGb) {
          notes.push({
            kind: "warn",
            text:
              "This wants about " +
              t.diskGb +
              "GB and only " +
              freeGb +
              "GB is free. It would fail partway through, after the download.",
          });
        } else if (freeGb - t.diskGb < 10) {
          notes.push({
            kind: "warn",
            text:
              "That leaves " +
              (freeGb - t.diskGb) +
              "GB spare on a " +
              freeGb +
              "GB margin. Tight — the disk grows as the machine is used.",
          });
        } else {
          notes.push({ kind: "info", text: freeGb + "GB free, about " + t.diskGb + "GB needed." });
        }
      } catch {
        notes.push({ kind: "unknown", text: "Couldn't check how much disk is free." });
      }

      if (t.needsVirtualisation) {
        const fsp = await import("node:fs/promises");
        try {
          await fsp.access("/dev/kvm");
          notes.push({ kind: "info", text: "KVM is available, so this will run at a usable speed." });
        } catch {
          notes.push({
            kind: "warn",
            // Without KVM this is software emulation: technically working, practically
            // unusable, and worth knowing before an hour disappears.
            text: "No access to /dev/kvm on this machine. Windows would be emulated in software, which is too slow to work in.",
          });
        }
      }

      const pulled = await imagePresent(t.image);
      if (pulled === false) {
        notes.push({
          kind: "warn",
          text:
            t.needsVirtualisation
              ? "The image isn't here yet, and Windows itself is downloaded on first boot — several gigabytes and a long wait before anything is usable."
              : "The image isn't here yet, so approving will download it.",
        });
      }

      for (const port of t.ports) {
        if (await portTaken(port.host)) {
          notes.push({
            kind: "warn",
            text: "Port " + port.host + " (" + port.what + ") is already in use. This will fail.",
          });
        }
      }

      const name = NAME_PREFIX + String(input.params.name);
      if (await containerExists(name)) {
        notes.push({ kind: "warn", text: "A container called " + name + " already exists." });
      }
      return notes;
    }

    if (input.recipe === "network.sweep") {
      const hosts = Number(input.params.hosts) || 0;
      notes.push({
        kind: "info",
        // Rough, and said as rough. 32 at a time with a one-second timeout.
        text: hosts + " addresses, about " + Math.max(1, Math.ceil(hosts / 32)) + " seconds.",
      });
      notes.push({
        kind: "warn",
        text: "Every device in the range sees a packet from this machine. Only do this on a network you own.",
      });
      return notes;
    }
  } catch {
    // Preflight must never be the reason something cannot be proposed.
    return [{ kind: "unknown", text: "Fadi couldn't check what this would change." }];
  }

  return notes;
}
