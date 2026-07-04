import { defineConfig } from "@playwright/test";

/**
 * Route smokes — the layer that catches what tsc/build can't: runtime crashes
 * like RSC serialization errors ("functions cannot be passed to client
 * components"), broken auth redirects, and dead routes. Runs against a real
 * `next start` with a real Postgres (CI spins one up; locally it reuses your
 * dev server on :3000 if it's running).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
