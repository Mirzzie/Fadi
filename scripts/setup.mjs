#!/usr/bin/env node
// One-command bootstrap for a fresh machine (Windows / macOS / Linux).
//
//   npm run setup
//
// It is cross-platform on purpose — pure Node, no `cp`/`openssl`/bash — so a developer on
// a fresh Windows laptop can go from `git clone` to a running database with one command.
// Every step is idempotent: re-running it never clobbers your work.
//
//   1. create apps/web/.env.local from the template (if missing)
//   2. generate a strong BETTER_AUTH_SECRET and write it in (if still the placeholder)
//   3. start local PostgreSQL in Docker and wait until it is healthy
//   4. apply migrations + seed job data
//
// Flags:  --skip-db   env-only (no Docker/migrations) — useful for CI or a hosted DB.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skipDb = process.argv.includes("--skip-db");
const CONTAINER = "careeros-postgres";

const c = { reset: "\x1b[0m", bold: "\x1b[1m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", dim: "\x1b[2m" };
const step = (m) => console.log(`\n${c.bold}▶ ${m}${c.reset}`);
const ok = (m) => console.log(`  ${c.green}✓${c.reset} ${m}`);
const warn = (m) => console.log(`  ${c.yellow}!${c.reset} ${m}`);
const die = (m) => { console.error(`\n${c.red}✗ ${m}${c.reset}\n`); process.exit(1); };

// spawn with shell:true so `npm`/`docker` resolve to npm.cmd/docker.exe on Windows.
function run(cmd, { capture = false, allowFail = false } = {}) {
  const r = spawnSync(cmd, { cwd: root, shell: true, stdio: capture ? "pipe" : "inherit", encoding: "utf8" });
  if (r.status !== 0 && !allowFail) die(`Command failed: ${cmd}`);
  return { code: r.status ?? 1, out: (r.stdout || "").trim() };
}

console.log(`${c.bold}Fadi — project setup${c.reset}`);

// ── 1 & 2. Environment file + auth secret ────────────────────────────────────
step("Environment (apps/web/.env.local)");
const envPath = join(root, "apps", "web", ".env.local");
const examplePath = join(root, "apps", "web", ".env.example");
if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) die(`Template missing: ${examplePath}`);
  copyFileSync(examplePath, envPath);
  ok("created apps/web/.env.local from .env.example");
} else {
  ok("apps/web/.env.local already exists — left as-is");
}

let env = readFileSync(envPath, "utf8");
const secretLine = env.match(/^BETTER_AUTH_SECRET=(.*)$/m);
const placeholder = !secretLine || secretLine[1].trim() === "" || secretLine[1].includes("replace-with");
if (placeholder) {
  const secret = randomBytes(32).toString("base64");
  env = secretLine
    ? env.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`)
    : `${env}\nBETTER_AUTH_SECRET=${secret}\n`;
  writeFileSync(envPath, env);
  ok("generated a strong BETTER_AUTH_SECRET");
} else {
  ok("BETTER_AUTH_SECRET already set — left as-is");
}

const hasAiKey = /^(GROQ|GOOGLE|ANTHROPIC|OPENAI)_API_KEY=\S/m.test(env);
if (!hasAiKey) {
  warn("No AI key set yet. The app runs, but Fadi's AI features stay off until you add one.");
  warn("Add a free Groq key (https://console.groq.com/keys) to GROQ_API_KEY in apps/web/.env.local.");
}

// ── 3 & 4. Database ──────────────────────────────────────────────────────────
if (skipDb) {
  step("Database — skipped (--skip-db)");
} else {
  step("Database (PostgreSQL in Docker)");
  if (run("docker --version", { capture: true, allowFail: true }).code !== 0) {
    die("Docker isn't available. Install Docker Desktop (Windows: enable WSL2), start it, then re-run `npm run setup`.\n" +
        "  No Docker? Point DATABASE_URL in apps/web/.env.local at any PostgreSQL 17 and run `npm run setup -- --skip-db` then `npm run db:migrate`.");
  }
  if (run("docker info", { capture: true, allowFail: true }).code !== 0) {
    die("Docker is installed but not running. Start Docker Desktop and re-run `npm run setup`.");
  }
  ok("Docker is running");

  run("npm run db:up");
  ok("PostgreSQL container starting");

  process.stdout.write("  waiting for PostgreSQL to be healthy");
  let healthy = false;
  for (let i = 0; i < 60; i++) {
    const { out } = run(`docker inspect --format "{{.State.Health.Status}}" ${CONTAINER}`, { capture: true, allowFail: true });
    if (out === "healthy") { healthy = true; break; }
    process.stdout.write(".");
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},1000)"]); // portable ~1s sleep
  }
  console.log("");
  if (!healthy) die("PostgreSQL didn't become healthy in time. Check `docker compose -f infrastructure/docker/docker-compose.yml logs postgres`.");
  ok("PostgreSQL is healthy");

  run("npm run db:migrate");
  ok("migrations applied");
  run("npm run db:seed:jobs");
  ok("job data seeded");
}

// ── Done ─────────────────────────────────────────────────────────────────────
console.log(`\n${c.green}${c.bold}Setup complete.${c.reset}`);
console.log(`${c.dim}Next:${c.reset}`);
if (!hasAiKey) console.log(`  • Add an AI key to apps/web/.env.local (GROQ_API_KEY — free tier)`);
console.log(`  • Start the app:  ${c.bold}npm run dev${c.reset}   → http://localhost:3000  (sign up to begin)\n`);
