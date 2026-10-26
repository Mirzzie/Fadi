import { expect, test } from "@playwright/test";

test.skip(!process.env.FADI_GUIDE_PREVIEW, "Opt in against the development-only component review.");

for (const palette of ["ember", "iris", "cobalt"])
  for (const mode of ["light", "dark"]) {
    test(`shared surfaces: ${palette}/${mode} at narrow and desktop widths`, async ({ page }) => {
      await page.addInitScript(
        ({ palette, mode }) => {
          localStorage.setItem("fadi:palette", palette);
          localStorage.setItem("theme", mode);
        },
        { palette, mode }
      );
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/design/system");
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("main")).toHaveCount(1);
        await expect(page.locator("html")).toHaveAttribute("data-palette", palette);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false
        );
        const input = await page.getByLabel("Working title").boundingBox();
        // Animated subpixel positions can produce 39.99997px for a 40px input.
        expect(input!.height).toBeGreaterThanOrEqual(39.99);
      }
      await page.getByLabel("Working title").fill("A small next step");
      await page.getByRole("button", { name: "Save example", exact: true }).click();
      await expect(
        page.getByText("Example saved locally. Your career record is unchanged.")
      ).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

test("dialogs, context sheets and tabs are bounded and keyboard usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/design/system");
  const trigger = page.getByRole("button", { name: "Review dialog", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(844 * 0.91);
  expect(box!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Open context", exact: true }).click();
  await expect(dialog).toBeVisible();
  const sheet = await dialog.boundingBox();
  expect(sheet!.height).toBeLessThanOrEqual(844);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Recorded outcomes");
});

test("touch-sized controls retain room at 320px", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/design/system");
  for (const control of [
    page.getByLabel("Working title"),
    page.getByRole("button", { name: "Save example", exact: true }),
  ])
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await context.close();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`account and recovery page structure in ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const route of [
      "/auth/sign-in",
      "/auth/sign-up",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/a-page-that-does-not-exist",
    ]) {
      await page.goto(route);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false
        );
      }
    }
  });
}
