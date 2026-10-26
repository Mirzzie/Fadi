import { expect, test } from "@playwright/test";

test("sign-up waits for client handlers before accepting input or submission", async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/_next\/static\/.*\.js(?:\?|$)/, async (route) => {
    await ready;
    await route.continue();
  });
  try {
    await page.goto("/auth/sign-up", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Email", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Password", { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
    release();
    await expect(page.getByLabel("Email", { exact: true })).toBeEnabled({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
    await page.getByLabel("Email", { exact: true }).fill("unsubmitted@example.test");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("unsubmitted@example.test");
  } finally {
    release();
  }
});
