import { expect, test } from "@playwright/test";

test.skip(
  !process.env.FADI_UI_STORAGE_STATE,
  "Opt in with an isolated synthetic account/database."
);
test.use({ storageState: process.env.FADI_UI_STORAGE_STATE || { cookies: [], origins: [] } });

for (const mode of ["light", "dark"])
  test(`portfolio dialogs retain labels, focus and visible actions in ${mode}`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => localStorage.setItem("theme", mode), mode);
    await page.goto("/dashboard/portfolio");
    await page.getByRole("heading", { name: "Your portfolio", exact: true }).waitFor();
    await page.locator("summary").filter({ hasText: "Portfolio tools" }).click();
    const trigger = page.getByRole("button", { name: "Settings", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Portfolio settings" });
    await expect(dialog).toBeVisible();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const box = await dialog.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeLessThanOrEqual(844 * 0.91);
      await expect(dialog.getByRole("button", { name: "Save", exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false
      );
    }
    await dialog.getByText("Site title", { exact: true }).click();
    await expect(dialog.getByLabel("Site title", { exact: true })).toBeFocused();
    const unlabelled = await dialog
      .locator("input, textarea, select")
      .evaluateAll(
        (elements) =>
          elements.filter(
            (e) => !(e as HTMLInputElement).labels?.length && !e.getAttribute("aria-label")
          ).length
      );
    expect(unlabelled).toBe(0);
    for (let n = 0; n < 20; n++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    const add = page.getByRole("button", { name: "Add project", exact: true });
    await add.click();
    const item = page.getByRole("dialog", { name: "Add project", exact: true });
    await item.getByLabel("Title", { exact: true }).fill("Unsubmitted UI test item");
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(item.getByRole("button", { name: "Create", exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false
      );
    }
    await page.keyboard.press("Escape");
    await expect(item).toHaveCount(0);
    await expect(add).toBeFocused();
    await expect(page.getByText("Unsubmitted UI test item", { exact: true })).toHaveCount(0);
  });

test("application dialog dismisses by keyboard and hides on browser Back without losing its draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/documents");
  await page.waitForURL("**/dashboard/applications?view=documents");
  await expect(page.getByRole("heading", { name: "Your documents", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Pipeline", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Pipeline", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  const add = page.getByRole("button", { name: "Add", exact: true });
  await add.click();
  const dialog = page.getByRole("dialog", { name: "Add an opportunity" });
  await dialog.getByLabel("Role / job title", { exact: true }).fill("Unsubmitted opportunity");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Your documents", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goForward();
  await expect(dialog.getByLabel("Role / job title", { exact: true })).toHaveValue(
    "Unsubmitted opportunity"
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(add).toBeFocused();
});

test("document history is readable and restoring requires an explicit choice", async ({ page }) => {
  await page.goto("/dashboard/documents");
  await page.waitForURL("**/dashboard/applications?view=documents");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.waitForURL(/\/dashboard\/documents\/[\w-]+$/);
  const editorUrl = page.url();
  await page.getByLabel("Full name", { exact: true }).fill("First UI revision");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Second UI revision");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("article > p").filter({ hasText: "First UI revision" })).toBeVisible();
  await expect(page.getByText('"personal":', { exact: false })).toHaveCount(0);
  const revision = page
    .locator("article")
    .filter({ has: page.locator("p").filter({ hasText: "First UI revision" }) });
  await revision.locator("summary").filter({ hasText: "Preview this version" }).click();
  await expect(revision.getByRole("heading", { name: "First UI revision", level: 3 })).toBeVisible();
  await expect(page.locator("h1:visible")).toHaveCount(1);
  await revision.getByRole("button", { name: /Restore version/ }).click();
  await page.getByRole("button", { name: "Keep current version", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("article > p").filter({ hasText: "Second UI revision" })).toBeVisible();
  await revision.getByRole("button", { name: /Restore version/ }).click();
  await page.getByRole("button", { name: "Restore as new version", exact: true }).click();
  await page.waitForURL(editorUrl);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("First UI revision");
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.locator("article > p").filter({ hasText: "Second UI revision" })).toBeVisible();
  expect(await page.locator("article").count()).toBeGreaterThanOrEqual(4);
});
