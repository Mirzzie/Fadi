import "server-only";

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  WAZUH_DEMO_SECRETS,
  type WazuhSecrets,
  newWazuhSecrets,
  parseHashes,
} from "./stack-secrets-core";

/**
 * EACH PROJECT'S WAZUH HAS ITS OWN PASSWORDS (Codex scan P1, 15 Oct 2026: every stack shipped
 * wazuh-docker's published demo credentials).
 *
 * They are made the first time a stack's files are written, kept beside them in `secrets.json`
 * (owner-only), and fixed from then on: Wazuh bakes them into its data on first start. So a stack
 * that was first started with the demo credentials keeps them — recorded as such, never silently
 * changed under running data — and a stack whose data was removed (`down -v`) gets new ones.
 */

const run = promisify(execFile);
const FILE = "secrets.json";
const INDEXER_IMAGE = "wazuh/wazuh-indexer:4.14.9";

/** What the stack in this folder uses, or null when it has none yet. Read-only. */
export async function readStackSecrets(dir: string): Promise<WazuhSecrets | null> {
  try {
    return JSON.parse(await readFile(join(dir, FILE), "utf8")) as WazuhSecrets;
  } catch {
    return null;
  }
}

/**
 * The secrets to write this stack's files with. Existing files without a record were started
 * with the demo credentials: keep and record those. Otherwise make new ones, with bcrypt hashes
 * from Wazuh's own tool — run in its image, offline, the passwords passed on stdin.
 */
export async function stackSecretsForFiles(dir: string): Promise<WazuhSecrets> {
  const existing = await readStackSecrets(dir);
  if (existing) return existing;
  const secrets = existsSync(join(dir, "docker-compose.yml"))
    ? WAZUH_DEMO_SECRETS
    : await withHashes(newWazuhSecrets(() => randomBytes(24)));
  await writeFile(join(dir, FILE), JSON.stringify(secrets, null, 2), { mode: 0o600 });
  await chmod(join(dir, FILE), 0o600);
  return secrets;
}

/**
 * The stack's data is gone (`down -v`): its credentials go with it, and so does its compose file
 * — otherwise the next start would find files without a record and take them for a demo-era
 * stack. Every file is written again on the next start.
 */
export async function forgetStackSecrets(dir: string): Promise<void> {
  await rm(join(dir, FILE), { force: true });
  await rm(join(dir, "docker-compose.yml"), { force: true });
}

async function withHashes(secrets: WazuhSecrets): Promise<WazuhSecrets> {
  // The image is the stack's own; pulling it here only moves that download earlier.
  await run("docker", ["image", "inspect", INDEXER_IMAGE], { timeout: 15_000 }).catch(() =>
    run("docker", ["pull", INDEXER_IMAGE], { timeout: 900_000 })
  );
  const script =
    "T=/usr/share/wazuh-indexer/plugins/opensearch-security/tools/hash.sh; " +
    'while IFS= read -r FADI_PW; do export FADI_PW; bash "$T" -env FADI_PW </dev/null 2>&1 | tail -1; done';
  const child = execFile(
    "docker",
    [
      "run", "--rm", "-i", "--network", "none",
      "-e", "OPENSEARCH_JAVA_HOME=/usr/share/wazuh-indexer/jdk",
      "--entrypoint", "bash", INDEXER_IMAGE, "-c", script,
    ],
    { timeout: 120_000, maxBuffer: 64 * 1024 }
  );
  const output = new Promise<string>((resolve, reject) => {
    let stdout = "";
    child.stdout?.on("data", (chunk) => (stdout += String(chunk)));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`Wazuh's hash tool exited ${code}`))
    );
  });
  child.stdin?.end(`${secrets.admin}\n${secrets.kibanaserver}\n`);
  const [adminHash, kibanaserverHash] = parseHashes(await output);
  if (!adminHash || !kibanaserverHash) {
    throw new Error("Wazuh's hash tool didn't return the password hashes.");
  }
  return { ...secrets, adminHash, kibanaserverHash };
}
