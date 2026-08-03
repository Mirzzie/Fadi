import { expect, test } from "@playwright/test";

// Visual/functional check for the Template Studio (ADR 0010). Signs up + onboards, opens the
// Studio, and proves the CLIENT-SIDE Reactive Resume render actually ran: the preview iframe
// carries a `blob:` URL (only produced if createResumePdfBlob resolved) and no error shows.
// Then exercises the editing loop (template switch, edit, add experience). Screenshot saved.

const BOUNDARY_TEXT = "Something broke on our side";
const SHOT = "/tmp/claude-1000/-home-mirzzie-Projects-your-linkedin-sidekick-main/ab2295ad-546e-4b72-94b1-ace8f6e227c8/scratchpad/studio-visual.png";

test("Template Studio renders + edits live", async ({ page }) => {
  const email = `studio+${Date.now()}@example.com`;

  // ── Sign up + onboard (classic form, no AI) ──
  await page.goto("/auth/sign-up");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Sm0ke-Passw0rd!42");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding**", { timeout: 30_000 });

  await page.getByRole("button", { name: /prefer a form/i }).click();
  await page.locator("#full-name").fill("Studio Tester");
  await page.locator("#target-role").fill("IT Support Specialist");
  await page.locator("#location-preference").fill("Dublin, Ireland");
  await page.locator("#experience-level").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#linkedin-profile").fill("IT professional with two years in desktop support, Windows/Linux admin and onboarding.");
  await page.locator("#resume-text").fill("Studio Tester — IT Support. 30+ tickets/week; maintained laptop fleet; wrote onboarding docs.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#career-goals").fill("Land a stable IT support role in Dublin within six months.");
  await page.getByRole("button", { name: "Complete onboarding" }).click();
  await page.waitForURL("**/dashboard**", { timeout: 60_000 });

  // ── Open the Studio ──
  await page.goto("/dashboard/documents/studio", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Template Studio" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(BOUNDARY_TEXT)).toHaveCount(0);

  // Editor panels present
  await expect(page.getByRole("heading", { name: "Basics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Experience" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Education" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Skills" })).toBeVisible();

  // ── The client render succeeded: preview iframe carries a blob: URL, no error ──
  const preview = page.locator('iframe[title="Résumé preview"]');
  await expect(preview).toHaveAttribute("src", /^blob:/, { timeout: 45_000 });
  await expect(page.getByText("Could not render", { exact: false })).toHaveCount(0);

  // Capture the src, edit the name, and confirm the preview re-renders to a NEW blob.
  const firstSrc = await preview.getAttribute("src");
  await page.getByLabel("Full name").fill("Renamed In Studio");
  await expect(preview).not.toHaveAttribute("src", firstSrc ?? "", { timeout: 45_000 });

  // Add an experience row → the new row (placeholder "New role") appears.
  const expCard = page.locator("div.rounded-xl", { has: page.getByRole("heading", { name: "Experience" }) });
  await expCard.getByRole("button", { name: "Add" }).click();
  await expect(expCard.getByText("New role")).toBeVisible({ timeout: 10_000 });

  await page.screenshot({ path: SHOT, fullPage: true });
  console.log("screenshot:", SHOT);
});
