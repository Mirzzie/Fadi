import { expect, test } from "@playwright/test";

/**
 * The golden-path smoke: sign up → onboard (classic form — no AI needed) → visit
 * every dashboard route → paste a job → open its full workspace. Each page must
 * render real content and never the error boundary. This is the net for runtime
 * crashes that compile clean (e.g. RSC "functions cannot be passed to client
 * components" — which shipped once and broke the workspace).
 */

const BOUNDARY_TEXT = "Something broke on our side";

const DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/jobs",
  "/dashboard/applications",
  "/dashboard/documents",
  "/dashboard/evidence",
  "/dashboard/interview",
  "/dashboard/learning",
  "/dashboard/network",
  "/dashboard/niche-finder",
  "/dashboard/intelligence",
  "/dashboard/profile",
  "/dashboard/settings",
];

test.describe.configure({ mode: "serial" });

test("public pages render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("The career mentor", { exact: false }).first()).toBeVisible();

  await page.goto("/auth/sign-in");
  await expect(page.locator("#email")).toBeVisible();
});

test("golden path: sign up → onboard → every route → workspace", async ({ page }) => {
  const email = `smoke+${Date.now()}@example.com`;

  // ── Sign up ──
  await page.goto("/auth/sign-up");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Sm0ke-Passw0rd!42");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding**", { timeout: 30_000 });

  // ── Onboarding via the deterministic classic form (no AI provider needed).
  //    It's a 3-step wizard: basics → history → goals, advanced with "Continue". ──
  await page.getByRole("button", { name: /prefer a form/i }).click();

  // Step 1 — basics
  await page.locator("#full-name").fill("Smoke Tester");
  await page.locator("#target-role").fill("IT Support Specialist");
  await page.locator("#location-preference").fill("Dublin, Ireland");
  await page.locator("#experience-level").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2 — career history
  await page
    .locator("#linkedin-profile")
    .fill(
      "IT professional with two years of hands-on experience in desktop support, ticket queues, Windows and Linux administration, and user onboarding. Comfortable troubleshooting hardware, networking basics, and Microsoft 365 issues for teams of 100+ users across two offices.",
    );
  await page
    .locator("#resume-text")
    .fill(
      "Smoke Tester — IT Support. Resolved 30+ tickets weekly across Windows/Linux estates; maintained laptop fleet; wrote onboarding docs used by the whole team.",
    );
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3 — goals → submit
  await page
    .locator("#career-goals")
    .fill("Land a stable IT support role in Dublin within six months.");
  await page.getByRole("button", { name: "Complete onboarding" }).click();
  await page.waitForURL("**/dashboard**", { timeout: 60_000 });

  // ── Every dashboard route renders without the error boundary ──
  for (const route of DASHBOARD_ROUTES) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(BOUNDARY_TEXT)).toHaveCount(0);
  }

  // ── Paste a job → open its FULL workspace (the RSC-crash class lives here) ──
  await page.goto("/dashboard/applications");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByPlaceholder("Role / job title").fill("Smoke Role");
  await page.getByPlaceholder("Company").fill("Smoke Co");
  await page
    .getByPlaceholder(/paste the full job description/i)
    .fill("We need an IT support specialist for ticket triage, Windows administration, and user hardware support in Dublin.");
  await page.getByRole("button", { name: "Add", exact: true }).last().click();

  await page.getByText("Smoke Role").first().click();
  await page.getByRole("link", { name: /open full workspace/i }).click();
  await page.waitForURL("**/workspace**", { timeout: 30_000 });

  // The six disclosed tool rows must render — this is exactly what crashed once.
  await expect(page.getByText("Should you apply?")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Red-pen review")).toBeVisible();
  await expect(page.getByText(BOUNDARY_TEXT)).toHaveCount(0);
});
